#!/usr/bin/env npx tsx

/**
 * Sync Dev to Prod Script
 *
 * Exports data from local dev database and syncs it to production.
 *
 * Usage:
 *   npm run sync-to-prod -- --prod-url https://your-app.webflow.io/pulse --secret YOUR_SECRET
 *
 * Options:
 *   --local-url   Local dev URL (default: http://localhost:4321/pulse)
 *   --prod-url    Production URL (required)
 *   --secret      SYNC_SECRET for authentication (required)
 *   --tables      Comma-separated list of tables to sync (default: all)
 *   --version     Sync version number (default: 1)
 *   --dry-run     Show what would be synced without actually syncing
 *   --output      Save export to file instead of syncing
 */

import { parseArgs } from "util";

const { values: args } = parseArgs({
  options: {
    "local-url": { type: "string", default: "http://localhost:4321/pulse" },
    "prod-url": { type: "string" },
    secret: { type: "string" },
    tables: { type: "string" },
    version: { type: "string", default: "1" },
    "dry-run": { type: "boolean", default: false },
    output: { type: "string" },
    help: { type: "boolean", default: false },
  },
});

if (args.help) {
  console.log(`
Sync Dev to Prod Script

Exports data from local dev database and syncs it to production.

Usage:
  npm run sync-to-prod -- --prod-url https://your-app.webflow.io/pulse --secret YOUR_SECRET

Options:
  --local-url   Local dev URL (default: http://localhost:4321/pulse)
  --prod-url    Production URL (required unless using --output)
  --secret      SYNC_SECRET for authentication (required unless using --output)
  --tables      Comma-separated list of tables to sync (default: all)
  --version     Sync version number (default: 1)
  --dry-run     Show what would be synced without actually syncing
  --output      Save export to file instead of syncing

Examples:
  # Sync all tables to production
  npm run sync-to-prod -- --prod-url https://myapp.webflow.io/pulse --secret mysecret

  # Sync only authors and content_items
  npm run sync-to-prod -- --prod-url https://myapp.webflow.io/pulse --secret mysecret --tables authors,content_items

  # Export to file for inspection
  npm run sync-to-prod -- --output ./backup.json

  # Dry run to see what would be synced
  npm run sync-to-prod -- --prod-url https://myapp.webflow.io/pulse --secret mysecret --dry-run
`);
  process.exit(0);
}

const localUrl = args["local-url"];
const prodUrl = args["prod-url"];
const secret = args.secret;
const tables = args.tables;
const version = parseInt(args.version || "1");
const dryRun = args["dry-run"];
const outputFile = args.output;

async function main() {
  console.log("🔄 Dev to Prod Sync\n");

  // Validate args
  if (!outputFile && !prodUrl) {
    console.error("❌ Error: --prod-url is required (or use --output to export to file)");
    process.exit(1);
  }

  if (!outputFile && !secret) {
    console.error("❌ Error: --secret is required for syncing to prod");
    process.exit(1);
  }

  // Step 1: Export from local
  console.log(`📤 Exporting from ${localUrl}...`);

  const exportUrl = new URL("/api/admin/export", localUrl);
  if (tables) {
    exportUrl.searchParams.set("tables", tables);
  }

  let exportData;
  try {
    const exportRes = await fetch(exportUrl.toString());
    if (!exportRes.ok) {
      const error = await exportRes.text();
      throw new Error(`Export failed: ${exportRes.status} - ${error}`);
    }
    exportData = await exportRes.json();
  } catch (error) {
    console.error(`❌ Failed to export from local: ${error}`);
    console.log("\n💡 Make sure your local dev server is running: npm run dev");
    process.exit(1);
  }

  console.log("\n📊 Export Summary:");
  for (const [table, count] of Object.entries(exportData.counts)) {
    console.log(`   ${table}: ${count} records`);
  }

  const totalRecords = Object.values(exportData.counts as Record<string, number>).reduce(
    (a, b) => a + b,
    0
  );
  console.log(`   ─────────────────`);
  console.log(`   Total: ${totalRecords} records\n`);

  // If output file specified, save and exit
  if (outputFile) {
    const fs = await import("fs");
    fs.writeFileSync(outputFile, JSON.stringify(exportData, null, 2));
    console.log(`💾 Saved export to ${outputFile}`);
    process.exit(0);
  }

  // Dry run - just show what would be synced
  if (dryRun) {
    console.log("🔍 DRY RUN - Would sync the above data to:");
    console.log(`   ${prodUrl}/api/admin/sync`);
    console.log(`   Version: ${version}`);
    console.log("\n   No changes made.");
    process.exit(0);
  }

  // Step 2: Sync to production
  console.log(`📥 Syncing to ${prodUrl}...`);

  const syncUrl = new URL("/api/admin/sync", prodUrl);
  const syncBody = {
    version,
    data: exportData.data,
  };

  try {
    const syncRes = await fetch(syncUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(syncBody),
    });

    if (!syncRes.ok) {
      const error = await syncRes.text();
      throw new Error(`Sync failed: ${syncRes.status} - ${error}`);
    }

    const syncResult = await syncRes.json();

    console.log("\n✅ Sync Complete!\n");
    console.log("📊 Sync Results:");
    for (const [table, result] of Object.entries(
      syncResult.results as Record<string, { attempted: number; inserted: number; skipped?: boolean }>
    )) {
      const status = result.skipped
        ? "⏭️  skipped (already synced)"
        : `✓ ${result.inserted}/${result.attempted} inserted`;
      console.log(`   ${table}: ${status}`);
    }

    console.log(`\n   Synced at: ${syncResult.syncedAt}`);
  } catch (error) {
    console.error(`\n❌ Sync failed: ${error}`);
    console.log("\n💡 Troubleshooting:");
    console.log("   1. Make sure ALLOW_DB_SYNC=true is set in production environment");
    console.log("   2. Verify SYNC_SECRET matches what you're passing with --secret");
    console.log("   3. Check that the production URL is correct");
    process.exit(1);
  }
}

main().catch(console.error);
