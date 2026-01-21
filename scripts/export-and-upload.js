/**
 * Export local database and upload to R2 using multipart upload
 * Handles large datasets that exceed request size limits
 *
 * Usage:
 *   node scripts/export-and-upload.js [--target=production]
 *
 * Environment:
 *   LOCAL_API=http://localhost:4321
 *   PROD_API=https://your-production-url.com
 */

const fs = require('fs');
const path = require('path');

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
const LOCAL_API = process.env.LOCAL_API || 'http://localhost:4321';
const PROD_API = process.env.PROD_API || 'https://your-production-url.com';

// Parse command line args
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  acc[key.replace('--', '')] = value || true;
  return acc;
}, {});

const TARGET_API = args.target === 'production' ? PROD_API : LOCAL_API;

async function exportData() {
  console.log('📦 Exporting data from local database...');

  const response = await fetch(`${LOCAL_API}/api/admin/r2-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'export' }),
  });

  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }

  const result = await response.json();
  console.log('✅ Export complete:', result.stats);

  return result.exportKey;
}

async function downloadExport(exportKey) {
  console.log('⬇️  Downloading export data...');

  const response = await fetch(
    `${LOCAL_API}/api/admin/r2-sync?operation=download&exportKey=${exportKey}`
  );

  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('✅ Downloaded export data');

  return data;
}

async function uploadMultipart(data, targetApi) {
  console.log('🚀 Starting multipart upload...');

  const jsonString = JSON.stringify(data);
  const totalSize = Buffer.byteLength(jsonString, 'utf8');
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

  console.log(`📊 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📦 Chunks: ${totalChunks}`);

  // Initialize multipart upload
  const initResponse = await fetch(`${targetApi}/api/admin/multipart-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'start' }),
  });

  if (!initResponse.ok) {
    throw new Error(`Failed to initialize upload: ${initResponse.statusText}`);
  }

  const { syncKey, uploadId } = await initResponse.json();
  console.log(`✅ Upload initialized: ${syncKey}`);

  // Upload chunks
  const parts = [];
  const buffer = Buffer.from(jsonString, 'utf8');

  for (let i = 0; i < totalChunks; i++) {
    const partNumber = i + 1;
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalSize);
    const chunk = buffer.slice(start, end);

    process.stdout.write(`⬆️  Uploading part ${partNumber}/${totalChunks}... `);

    const partResponse = await fetch(
      `${targetApi}/api/admin/multipart-upload?key=${syncKey}&uploadId=${uploadId}&partNumber=${partNumber}`,
      {
        method: 'PUT',
        body: chunk,
        headers: { 'Content-Type': 'application/octet-stream' },
      }
    );

    if (!partResponse.ok) {
      throw new Error(`Failed to upload part ${partNumber}: ${partResponse.statusText}`);
    }

    const { etag } = await partResponse.json();
    parts.push({ partNumber, etag });

    console.log(`✓ (${((end / totalSize) * 100).toFixed(1)}%)`);
  }

  // Complete multipart upload
  console.log('🔗 Completing multipart upload...');

  const completeResponse = await fetch(`${targetApi}/api/admin/multipart-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'complete',
      key: syncKey,
      uploadId,
      parts,
    }),
  });

  if (!completeResponse.ok) {
    throw new Error(`Failed to complete upload: ${completeResponse.statusText}`);
  }

  console.log('✅ Upload complete!');

  return syncKey;
}

async function triggerSync(syncKey, targetApi) {
  console.log('🔄 Triggering sync on target environment...');

  const response = await fetch(`${targetApi}/api/admin/r2-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operation: 'sync',
      syncKey,
    }),
  });

  if (!response.ok) {
    throw new Error(`Sync failed: ${response.statusText}`);
  }

  const result = await response.json();
  console.log('✅ Sync complete!');
  console.log('📊 Results:', result.results);

  return result;
}

async function checkStatus(syncKey, targetApi) {
  const response = await fetch(`${targetApi}/api/admin/r2-sync?syncKey=${syncKey}`);

  if (!response.ok) {
    throw new Error(`Status check failed: ${response.statusText}`);
  }

  const { status } = await response.json();
  return status;
}

async function main() {
  console.log('🌟 Webflow Community Pulse - Data Export & Upload\n');
  console.log(`📍 Target: ${TARGET_API}\n`);

  try {
    // Step 1: Export from local
    const exportKey = await exportData();

    // Step 2: Download export data
    const data = await downloadExport(exportKey);

    // Step 3: Upload to target using multipart
    const syncKey = await uploadMultipart(data, TARGET_API);

    // Step 4: Trigger sync
    const result = await triggerSync(syncKey, TARGET_API);

    console.log('\n🎉 All done!');
    console.log(`\nSync Key: ${syncKey}`);
    console.log('You can check status with:');
    console.log(`  curl "${TARGET_API}/api/admin/r2-sync?syncKey=${syncKey}"`);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { exportData, downloadExport, uploadMultipart, triggerSync, checkStatus };
