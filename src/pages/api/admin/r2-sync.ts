import type { APIRoute } from "astro";
import { getDb } from "../../../db/getDb";
import { sql } from "drizzle-orm";
import {
  authors,
  contentItems,
  engagementSnapshots,
  insights,
  insightGenerations,
  roundups,
  roundupItems,
  seedHistory,
} from "../../../db/schema";

/**
 * R2-based sync endpoint for large data transfers
 * Avoids request size/timeout limits by using R2 as intermediary
 *
 * Workflow:
 * 1. Export data locally and upload to R2: POST /api/admin/r2-sync { operation: "upload", data: {...} }
 * 2. Trigger sync from R2: POST /api/admin/r2-sync { operation: "sync", syncKey: "..." }
 * 3. Check status: GET /api/admin/r2-sync?syncKey=...
 */

interface SyncStatus {
  syncKey: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: {
    tablesProcessed: number;
    totalTables: number;
    currentTable?: string;
    recordsProcessed: number;
  };
  results?: Record<string, { attempted: number; inserted: number }>;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

/**
 * OPTIONS - Handle CORS preflight
 */
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
};

/**
 * POST - Upload data to R2 or trigger sync from R2
 */
export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const env = locals.runtime.env;
  const r2 = env.DATA_SYNC;
  const cache = env.CACHE;

  const body = await request.json();
  const { operation, data, syncKey, version = 1 } = body;

  try {
    if (operation === "upload") {
      // Upload large JSON payload to R2
      if (!data) {
        return Response.json({ error: "No data provided" }, { status: 400 });
      }

      // Generate unique sync key
      const timestamp = Date.now();
      const key = `sync-${timestamp}-${Math.random().toString(36).substring(7)}`;

      // Store data in R2
      await r2.put(key, JSON.stringify({ version, data, uploadedAt: timestamp }), {
        httpMetadata: {
          contentType: "application/json",
        },
      });

      // Initialize status in KV
      const status: SyncStatus = {
        syncKey: key,
        status: "pending",
        progress: {
          tablesProcessed: 0,
          totalTables: Object.keys(data).length,
          recordsProcessed: 0,
        },
      };
      await cache.put(`sync:status:${key}`, JSON.stringify(status), {
        expirationTtl: 86400, // 24 hours
      });

      return Response.json({
        success: true,
        syncKey: key,
        message: "Data uploaded to R2. Use this key to trigger sync.",
        uploadedTables: Object.keys(data),
        nextStep: `POST /api/admin/r2-sync { "operation": "sync", "syncKey": "${key}" }`,
      });
    } else if (operation === "sync") {
      // Trigger sync from R2
      if (!syncKey) {
        return Response.json({ error: "syncKey required" }, { status: 400 });
      }

      // Get data from R2
      const object = await r2.get(syncKey);
      if (!object) {
        return Response.json({ error: "Sync data not found in R2" }, { status: 404 });
      }

      const payload = await object.json() as {
        version: number;
        data: Record<string, unknown[]>;
        uploadedAt: number;
      };

      // Update status to processing
      const status: SyncStatus = {
        syncKey,
        status: "processing",
        progress: {
          tablesProcessed: 0,
          totalTables: Object.keys(payload.data).length,
          recordsProcessed: 0,
        },
        startedAt: Date.now(),
      };
      await cache.put(`sync:status:${syncKey}`, JSON.stringify(status), {
        expirationTtl: 86400,
      });

      // Process sync (this will be done in background)
      // For now, do it synchronously - can be optimized with Durable Objects later
      const results = await processSyncData(locals, payload.version, payload.data, syncKey);

      // Update final status
      status.status = "completed";
      status.completedAt = Date.now();
      status.results = results;
      await cache.put(`sync:status:${syncKey}`, JSON.stringify(status), {
        expirationTtl: 86400,
      });

      // Clean up R2 object (optional - keep for debugging)
      // await r2.delete(syncKey);

      return Response.json({
        success: true,
        syncKey,
        results,
        duration: status.completedAt - (status.startedAt || 0),
        message: "Sync completed successfully",
      });
    } else if (operation === "export") {
      // Export current database to R2 for download/backup
      const db = getDb(locals);
      const timestamp = Date.now();
      const key = `export-${timestamp}-${Math.random().toString(36).substring(7)}`;

      // Export all tables
      const exportData: Record<string, unknown[]> = {};

      exportData.authors = await db.select().from(authors).all();
      exportData.content_items = await db.select().from(contentItems).all();
      exportData.engagement_snapshots = await db.select().from(engagementSnapshots).all();
      exportData.insights = await db.select().from(insights).all();
      exportData.insight_generations = await db.select().from(insightGenerations).all();
      exportData.roundups = await db.select().from(roundups).all();
      exportData.roundup_items = await db.select().from(roundupItems).all();

      // Store in R2
      await r2.put(key, JSON.stringify({ version: 1, data: exportData, exportedAt: timestamp }), {
        httpMetadata: {
          contentType: "application/json",
        },
      });

      return Response.json({
        success: true,
        exportKey: key,
        stats: Object.entries(exportData).map(([table, records]) => ({
          table,
          count: records.length,
        })),
        message: "Database exported to R2",
        downloadUrl: `/api/admin/r2-sync?operation=download&exportKey=${key}`,
      });
    } else {
      return Response.json({ error: `Unknown operation: ${operation}` }, { status: 400 });
    }
  } catch (error) {
    console.error("R2 sync error:", error);
    return Response.json(
      { error: "R2 sync operation failed", details: String(error) },
      { status: 500 }
    );
  }
};

/**
 * GET - Check sync status or download export
 */
export const GET: APIRoute = async ({ locals, url }) => {
  const user = locals.user;
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const env = locals.runtime.env;
  const cache = env.CACHE;
  const r2 = env.DATA_SYNC;

  const operation = url.searchParams.get("operation");
  const syncKey = url.searchParams.get("syncKey");
  const exportKey = url.searchParams.get("exportKey");

  try {
    if (operation === "download" && exportKey) {
      // Download export from R2
      const object = await r2.get(exportKey);
      if (!object) {
        return Response.json({ error: "Export not found" }, { status: 404 });
      }

      return new Response(object.body, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="export-${exportKey}.json"`,
        },
      });
    } else if (syncKey) {
      // Check sync status
      const statusJson = await cache.get(`sync:status:${syncKey}`);
      if (!statusJson) {
        return Response.json({ error: "Sync status not found" }, { status: 404 });
      }

      const status = JSON.parse(statusJson) as SyncStatus;
      return Response.json({ status });
    } else {
      // List recent syncs
      return Response.json({
        message: "R2-based data sync endpoint",
        usage: {
          upload: "POST { operation: 'upload', data: { authors: [...], content_items: [...] } }",
          sync: "POST { operation: 'sync', syncKey: '...' }",
          export: "POST { operation: 'export' }",
          status: "GET ?syncKey=...",
          download: "GET ?operation=download&exportKey=...",
        },
        benefits: [
          "No request size limits (R2 handles large files)",
          "No timeout issues (upload and sync are separate)",
          "Progress tracking via KV status",
          "Can resume/retry failed syncs",
        ],
      });
    }
  } catch (error) {
    console.error("R2 sync GET error:", error);
    return Response.json(
      { error: "Failed to process request", details: String(error) },
      { status: 500 }
    );
  }
};

/**
 * Process sync data (extracted for reusability)
 */
async function processSyncData(
  locals: App.Locals,
  version: number,
  data: Record<string, unknown[]>,
  syncKey: string
): Promise<Record<string, { attempted: number; inserted: number }>> {
  const db = getDb(locals);
  const cache = locals.runtime.env.CACHE;
  const results: Record<string, { attempted: number; inserted: number }> = {};

  // Helper to update progress
  async function updateProgress(currentTable: string, recordsProcessed: number) {
    const statusJson = await cache.get(`sync:status:${syncKey}`);
    if (statusJson) {
      const status = JSON.parse(statusJson) as SyncStatus;
      status.progress.currentTable = currentTable;
      status.progress.recordsProcessed = recordsProcessed;
      await cache.put(`sync:status:${syncKey}`, JSON.stringify(status), {
        expirationTtl: 86400,
      });
    }
  }

  // Helper to sync table (same logic as original sync endpoint)
  async function syncTable<T extends Record<string, unknown>>(
    tableName: string,
    tableData: T[] | undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: any,
    conflictColumns: string[]
  ) {
    if (!tableData || tableData.length === 0) {
      return { attempted: 0, inserted: 0 };
    }

    await updateProgress(tableName, 0);

    // Check if already synced
    const existingSync = await db
      .select()
      .from(seedHistory)
      .where(
        sql`${seedHistory.seedName} = ${tableName} AND ${seedHistory.seedVersion} = ${version}`
      )
      .limit(1);

    if (existingSync.length > 0) {
      console.log(`Skipping ${tableName} v${version} - already synced`);
      return { attempted: tableData.length, inserted: 0, skipped: true };
    }

    // Clean snake_case fields
    const cleanedData = tableData.map((record) => {
      const cleaned = { ...record };
      if ("platformId" in cleaned && "platform_id" in cleaned) delete cleaned.platform_id;
      if ("authorId" in cleaned && "author_id" in cleaned) delete cleaned.author_id;
      if ("contentId" in cleaned && "content_id" in cleaned) delete cleaned.content_id;
      if ("parentId" in cleaned && "parent_id" in cleaned) delete cleaned.parent_id;
      if ("generationId" in cleaned && "generation_id" in cleaned) delete cleaned.generation_id;
      if ("roundupId" in cleaned && "roundup_id" in cleaned) delete cleaned.roundup_id;
      return cleaned;
    });

    let inserted = 0;
    const batchSize = 100;

    // Process in batches
    for (let i = 0; i < cleanedData.length; i += batchSize) {
      const batch = cleanedData.slice(i, i + batchSize);
      try {
        await db.insert(table).values(batch);
        inserted += batch.length;
        await updateProgress(tableName, inserted);
      } catch (err) {
        console.error(`Batch insert error in ${tableName} at position ${i}:`, err);
      }
    }

    // Record sync in history
    await db.insert(seedHistory).values({
      seedName: tableName,
      seedVersion: version,
      recordCount: inserted,
      appliedAt: Math.floor(Date.now() / 1000),
    });

    return { attempted: tableData.length, inserted };
  }

  // Sync tables in dependency order
  if (data.authors) {
    results.authors = await syncTable(
      "authors",
      data.authors as Record<string, unknown>[],
      authors,
      ["platform", "platformId"]
    );
  }

  if (data.content_items) {
    results.content_items = await syncTable(
      "content_items",
      data.content_items as Record<string, unknown>[],
      contentItems,
      ["platform", "platformId"]
    );
  }

  if (data.engagement_snapshots) {
    results.engagement_snapshots = await syncTable(
      "engagement_snapshots",
      data.engagement_snapshots as Record<string, unknown>[],
      engagementSnapshots,
      ["id"]
    );
  }

  if (data.insight_generations) {
    results.insight_generations = await syncTable(
      "insight_generations",
      data.insight_generations as Record<string, unknown>[],
      insightGenerations,
      ["id"]
    );
  }

  if (data.insights) {
    results.insights = await syncTable(
      "insights",
      data.insights as Record<string, unknown>[],
      insights,
      ["id"]
    );
  }

  if (data.roundups) {
    results.roundups = await syncTable(
      "roundups",
      data.roundups as Record<string, unknown>[],
      roundups,
      ["id"]
    );
  }

  if (data.roundup_items) {
    results.roundup_items = await syncTable(
      "roundup_items",
      data.roundup_items as Record<string, unknown>[],
      roundupItems,
      ["id"]
    );
  }

  return results;
}
