/**
 * Export local database and upload to R2 using multipart upload
 * Handles large datasets that exceed Worker subrequest limits
 *
 * Usage:
 *   # Sync all tables (may require multiple runs due to Worker limits)
 *   node scripts/export-and-upload.js --local-cookie="pulse_session=local" --prod-cookie="pulse_session=prod" --target=production
 *
 *   # Sync one table at a time (RECOMMENDED for large datasets)
 *   node scripts/export-and-upload.js --local-cookie="..." --prod-cookie="..." --target=production --table=authors
 *   node scripts/export-and-upload.js --local-cookie="..." --prod-cookie="..." --target=production --table=content_items
 *
 * Options:
 *   --local-cookie   Local session cookie (required)
 *   --prod-cookie    Production session cookie (required for production target)
 *   --target         "production" or omit for local (default: local)
 *   --table          Sync only this table (authors, content_items, engagement_snapshots, etc.)
 *   --limit          Limit records per table (for testing)
 *   --version        Sync version number (default: 1, not used anymore)
 *
 * Table names:
 *   authors, content_items, engagement_snapshots, insights,
 *   insight_generations, roundups, roundup_items
 *
 * Worker Limits:
 *   Cloudflare Workers have ~500-1000 subrequest limit per invocation.
 *   Each database operation = 1 subrequest. Large tables need multiple runs:
 *   - authors (7,014 records): Run 3-4 times until complete
 *   - content_items (9,252 records): Run 4-5 times until complete
 *   - Each run processes ~500-1000 records, skips duplicates automatically
 *
 * Environment:
 *   LOCAL_API=http://localhost:4321/pulse
 *   PROD_API=https://worker-url.webflow.services/pulse
 */

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
const LOCAL_API = process.env.LOCAL_API || "http://localhost:4321/pulse";
const PROD_API = process.env.PROD_API || "https://2a092163-0dfa-4bff-b2e5-b5ba987257a3.wf-app-prod.cosmic.webflow.services/pulse";

// Parse command line args
const args = process.argv.slice(2).reduce((acc, arg) => {
  const firstEquals = arg.indexOf("=");
  if (firstEquals === -1) {
    acc[arg.replace("--", "")] = true;
  } else {
    const key = arg.substring(0, firstEquals);
    const value = arg.substring(firstEquals + 1);
    acc[key.replace("--", "")] = value;
  }
  return acc;
}, {});

const TARGET_API = args.target === "production" ? PROD_API : LOCAL_API;
const LOCAL_COOKIE = args["local-cookie"] || args.cookie || process.env.LOCAL_SESSION_COOKIE;
const PROD_COOKIE = args["prod-cookie"] || process.env.PROD_SESSION_COOKIE;
const VERSION = parseInt(args.version || "1");
const TABLE = args.table; // Optional: sync only specific table
const LIMIT = args.limit ? parseInt(args.limit) : null; // Optional: limit records per table

// Determine which cookie to use based on target
const TARGET_COOKIE = args.target === "production" ? PROD_COOKIE : LOCAL_COOKIE;

if (!LOCAL_COOKIE) {
  console.error("❌ Error: Local session cookie required for authentication");
  console.error(
    "Usage: npm run sync -- --local-cookie=\"pulse_session=local-value\" --prod-cookie=\"pulse_session=prod-value\""
  );
  console.error(
    "\nGet your session cookies from browser DevTools after logging in:"
  );
  console.error("  Local cookie:");
  console.error("    1. Log into http://localhost:4321/pulse/login");
  console.error("    2. Open DevTools > Application > Cookies");
  console.error("    3. Copy the 'pulse_session' cookie value");
  console.error("\n  Production cookie:");
  console.error("    1. Log into https://twirlingtacotales.xyz/pulse/login");
  console.error("    2. Open DevTools > Application > Cookies");
  console.error("    3. Copy the 'pulse_session' cookie value");
  process.exit(1);
}

if (args.target === "production" && !PROD_COOKIE) {
  console.error("❌ Error: Production cookie required when syncing to production");
  console.error(
    "Usage: npm run sync -- --local-cookie=\"pulse_session=local-value\" --prod-cookie=\"pulse_session=prod-value\""
  );
  process.exit(1);
}

async function exportData() {
  console.log("📦 Exporting data from local database...");
  console.log(`   URL: ${LOCAL_API}/api/admin/r2-sync`);
  console.log(`   Cookie: ${LOCAL_COOKIE.substring(0, 30)}...`);

  const response = await fetch(`${LOCAL_API}/api/admin/r2-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: LOCAL_COOKIE,
    },
    body: JSON.stringify({ operation: "export" }),
  });

  const text = await response.text();

  if (!response.ok) {
    console.error("Response status:", response.status);
    console.error("Response text (first 200 chars):", text.substring(0, 200));
    throw new Error(`Export failed: ${response.statusText}`);
  }

  let result;
  try {
    result = JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse JSON response");
    console.error("Response status:", response.status);
    console.error("Response headers:", Object.fromEntries(response.headers.entries()));
    console.error("Response text (first 500 chars):", text.substring(0, 500));
    throw new Error("Invalid JSON response from export endpoint");
  }

  console.log("✅ Export complete:", result.stats);

  return result.exportKey;
}

async function downloadExport(exportKey) {
  console.log("⬇️  Downloading export data...");

  const response = await fetch(
    `${LOCAL_API}/api/admin/r2-sync?operation=download&exportKey=${exportKey}`,
    {
      headers: {
        Cookie: LOCAL_COOKIE,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }

  const data = await response.json();
  console.log("✅ Downloaded export data");

  return data;
}

async function uploadMultipart(data, targetApi) {
  console.log("🚀 Starting multipart upload...");

  // Update version if specified
  if (VERSION > 1) {
    console.log(`   Updating version from ${data.version} to ${VERSION}`);
    data.version = VERSION;
  }

  // Filter to specific table if requested
  if (TABLE) {
    console.log(`   Filtering to table: ${TABLE}`);
    const filteredData = {};
    if (data.data[TABLE]) {
      filteredData[TABLE] = data.data[TABLE];
      data.data = filteredData;
      console.log(`   Filtered to ${Object.keys(data.data).length} table(s)`);
    } else {
      throw new Error(`Table "${TABLE}" not found in export data`);
    }
  }

  // Limit records if specified
  if (LIMIT && data.data) {
    console.log(`   Limiting to ${LIMIT} records per table`);
    for (const [tableName, records] of Object.entries(data.data)) {
      if (Array.isArray(records) && records.length > LIMIT) {
        data.data[tableName] = records.slice(0, LIMIT);
        console.log(`   ${tableName}: ${LIMIT} of ${records.length} records`);
      }
    }
  }

  const jsonString = JSON.stringify(data);
  const totalSize = Buffer.byteLength(jsonString, "utf8");
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

  console.log(`📊 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📦 Chunks: ${totalChunks}`);

  // Initialize multipart upload
  console.log(`   Initializing upload to: ${targetApi}/api/admin/multipart-upload`);
  const initResponse = await fetch(`${targetApi}/api/admin/multipart-upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: TARGET_COOKIE,
    },
    body: JSON.stringify({ action: "start" }),
  });

  if (!initResponse.ok) {
    const text = await initResponse.text();
    console.error("Initialize response status:", initResponse.status);
    console.error("Response text (first 200 chars):", text.substring(0, 200));
    throw new Error(`Failed to initialize upload: ${initResponse.statusText}`);
  }

  const initText = await initResponse.text();
  let initData;
  try {
    initData = JSON.parse(initText);
  } catch (e) {
    console.error("Failed to parse init response as JSON");
    console.error("Response text (first 500 chars):", initText.substring(0, 500));
    throw new Error("Invalid JSON response from multipart upload init");
  }

  const { syncKey, uploadId } = initData;
  console.log(`✅ Upload initialized: ${syncKey}`);

  // Upload chunks
  const parts = [];
  const buffer = Buffer.from(jsonString, "utf8");

  for (let i = 0; i < totalChunks; i++) {
    const partNumber = i + 1;
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalSize);
    const chunk = buffer.slice(start, end);

    process.stdout.write(`⬆️  Uploading part ${partNumber}/${totalChunks}... `);

    const partResponse = await fetch(
      `${targetApi}/api/admin/multipart-upload?key=${syncKey}&uploadId=${uploadId}&partNumber=${partNumber}`,
      {
        method: "PUT",
        body: chunk,
        headers: {
          "Content-Type": "application/octet-stream",
          Cookie: TARGET_COOKIE,
        },
      }
    );

    if (!partResponse.ok) {
      throw new Error(
        `Failed to upload part ${partNumber}: ${partResponse.statusText}`
      );
    }

    const { etag } = await partResponse.json();
    parts.push({ partNumber, etag });

    console.log(`✓ (${((end / totalSize) * 100).toFixed(1)}%)`);
  }

  // Complete multipart upload
  console.log("🔗 Completing multipart upload...");

  const completeResponse = await fetch(
    `${targetApi}/api/admin/multipart-upload`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: TARGET_COOKIE,
      },
      body: JSON.stringify({
        action: "complete",
        key: syncKey,
        uploadId,
        parts,
      }),
    }
  );

  if (!completeResponse.ok) {
    throw new Error(
      `Failed to complete upload: ${completeResponse.statusText}`
    );
  }

  console.log("✅ Upload complete!");

  return syncKey;
}

async function triggerSync(syncKey, targetApi) {
  console.log("🔄 Triggering sync on target environment...");

  const response = await fetch(`${targetApi}/api/admin/r2-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: TARGET_COOKIE,
    },
    body: JSON.stringify({
      operation: "sync",
      syncKey,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Sync failed!");
    console.error("Status:", response.status);
    console.error("Response (first 1000 chars):", text.substring(0, 1000));
    throw new Error(`Sync failed: ${response.statusText}`);
  }

  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse sync response as JSON");
    console.error("Response text (first 1000 chars):", text.substring(0, 1000));
    throw new Error("Invalid JSON response from sync endpoint");
  }

  console.log("✅ Sync complete!");
  console.log("📊 Results:", result.results);

  return result;
}

async function checkStatus(syncKey, targetApi) {
  const response = await fetch(
    `${targetApi}/api/admin/r2-sync?syncKey=${syncKey}`,
    {
      headers: {
        Cookie: TARGET_COOKIE,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Status check failed: ${response.statusText}`);
  }

  const { status } = await response.json();
  return status;
}

async function main() {
  console.log("🌟 Webflow Community Pulse - Data Export & Upload\n");
  console.log(`📍 Target: ${TARGET_API}`);
  console.log(`📍 Local: ${LOCAL_API}`);
  console.log(`🔑 Using ${args.target === "production" ? "production" : "local"} cookie for target`);
  console.log(`📦 Sync version: ${VERSION}\n`);

  try {
    // Step 1: Export from local
    const exportKey = await exportData();

    // Step 2: Download export data
    const data = await downloadExport(exportKey);

    // Step 3: Upload to target using multipart
    const syncKey = await uploadMultipart(data, TARGET_API);

    // Step 4: Trigger sync
    const result = await triggerSync(syncKey, TARGET_API);

    console.log("\n🎉 All done!");
    console.log(`\nSync Key: ${syncKey}`);
    console.log("You can check status with:");
    console.log(`  curl "${TARGET_API}/api/admin/r2-sync?syncKey=${syncKey}"`);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  exportData,
  downloadExport,
  uploadMultipart,
  triggerSync,
  checkStatus,
};
