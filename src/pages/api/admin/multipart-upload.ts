import type { APIRoute } from "astro";

/**
 * Multipart upload endpoint for large data sync files
 * Handles chunked uploads to R2 to bypass request size limits
 *
 * POST /api/admin/multipart-upload - Initialize or complete multipart upload
 * PUT /api/admin/multipart-upload - Upload individual parts
 */

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per chunk (R2 minimum is 5MB except last part)

/**
 * POST - Initialize or complete multipart upload
 */
export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const env = locals.runtime.env;
  const r2 = env.DATA_SYNC;

  const body = (await request.json()) as {
    action?: string;
    key?: string;
    uploadId?: string;
    parts?: Array<{ partNumber: number; etag: string }>;
  };
  const { action, key, uploadId, parts } = body;

  try {
    if (action === "start") {
      // Initialize multipart upload
      const timestamp = Date.now();
      const syncKey =
        key || `sync-${timestamp}-${Math.random().toString(36).substring(7)}`;

      const multipartUpload = await r2.createMultipartUpload(syncKey, {
        httpMetadata: {
          contentType: "application/json",
        },
      });

      return Response.json({
        success: true,
        syncKey,
        uploadId: multipartUpload.uploadId,
        message: "Multipart upload initialized",
        chunkSize: CHUNK_SIZE,
        nextStep: "Upload parts using PUT /api/admin/multipart-upload",
      });
    } else if (action === "complete") {
      // Complete multipart upload
      if (!key || !uploadId || !parts) {
        return Response.json(
          { error: "key, uploadId, and parts required" },
          { status: 400 }
        );
      }

      const upload = r2.resumeMultipartUpload(key, uploadId);
      await upload.complete(parts);

      return Response.json({
        success: true,
        syncKey: key,
        message: "Multipart upload completed",
        nextStep: `POST /api/admin/r2-sync { "operation": "sync", "syncKey": "${key}" }`,
      });
    } else if (action === "abort") {
      // Abort multipart upload
      if (!key || !uploadId) {
        return Response.json(
          { error: "key and uploadId required" },
          { status: 400 }
        );
      }

      const upload = r2.resumeMultipartUpload(key, uploadId);
      await upload.abort();

      return Response.json({
        success: true,
        message: "Multipart upload aborted",
      });
    } else {
      return Response.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Multipart upload POST error:", error);
    return Response.json(
      { error: "Multipart operation failed", details: String(error) },
      { status: 500 }
    );
  }
};

/**
 * PUT - Upload individual part
 */
export const PUT: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const env = locals.runtime.env;
  const r2 = env.DATA_SYNC;

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const uploadId = url.searchParams.get("uploadId");
  const partNumber = parseInt(url.searchParams.get("partNumber") || "0");

  if (!key || !uploadId || !partNumber) {
    return Response.json(
      { error: "key, uploadId, and partNumber required" },
      { status: 400 }
    );
  }

  try {
    const upload = r2.resumeMultipartUpload(key, uploadId);

    // Get chunk data from request body
    const chunkData = await request.arrayBuffer();

    // Upload this part
    const uploadedPart = await upload.uploadPart(partNumber, chunkData);

    return Response.json({
      success: true,
      partNumber,
      etag: uploadedPart.etag,
    });
  } catch (error) {
    console.error("Multipart upload PUT error:", error);
    return Response.json(
      { error: "Part upload failed", details: String(error) },
      { status: 500 }
    );
  }
};

/**
 * GET - Get upload status and info
 */
export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  return Response.json({
    message: "Multipart upload endpoint for large data sync files",
    chunkSize: CHUNK_SIZE,
    usage: {
      initialize: {
        method: "POST",
        body: { action: "start", "key (optional)": "custom-key" },
        returns: { syncKey: "string", uploadId: "string" },
      },
      uploadPart: {
        method: "PUT",
        query: { key: "string", uploadId: "string", partNumber: "number" },
        body: "Binary chunk data",
        returns: { partNumber: "number", etag: "string" },
      },
      complete: {
        method: "POST",
        body: {
          action: "complete",
          key: "string",
          uploadId: "string",
          parts: [{ partNumber: 1, etag: "..." }],
        },
      },
      abort: {
        method: "POST",
        body: { action: "abort", key: "string", uploadId: "string" },
      },
    },
    workflow: [
      "1. Client splits large JSON into chunks",
      "2. POST { action: 'start' } to initialize",
      "3. PUT each chunk with partNumber",
      "4. POST { action: 'complete', parts: [...] } to finalize",
      "5. Use syncKey with /api/admin/r2-sync to import data",
    ],
  });
};

/**
 * OPTIONS - Handle CORS preflight
 */
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
};
