# R2-Based Data Sync Guide

This guide explains how to sync large datasets between local development and production using R2 storage.

## Why R2 Sync?

When using Webflow Cloud on Workers for Platforms, you don't have direct database access. R2 sync solves three key problems:

1. **Request Size Limits** - HTTP requests are limited to 100MB
2. **Timeout Issues** - Large data imports would timeout
3. **No Wrangler CLI** - Can't use `wrangler d1 execute` commands

## Architecture

```
Local DB → Export API → R2 Bucket (chunked) → Production Import API → Production DB
```

## Setup

### 1. Add R2 Bucket Binding

Already configured in `wrangler.json`:

```json
{
  "r2_buckets": [
    {
      "binding": "DATA_SYNC",
      "bucket_name": "community-pulse-sync",
      "preview_bucket_name": "community-pulse-sync-preview"
    }
  ]
}
```

### 2. Environment Variables

Create `.env` file:

```bash
# For the export script
LOCAL_API=http://localhost:4321
PROD_API=https://your-production-url.com
```

## Usage

### Method 1: Automated Script (Recommended)

The script handles everything automatically with progress tracking:

```bash
# Export local and upload to local R2 (for testing)
node scripts/export-and-upload.js

# Export local and upload to production R2
node scripts/export-and-upload.js --target=production
```

What it does:
1. Exports all tables from local database
2. Downloads the export as JSON
3. Splits into 10MB chunks
4. Uploads chunks to R2 using multipart upload
5. Triggers sync to import into database
6. Shows progress and results

### Method 2: Manual API Calls

#### Step 1: Export Local Data

```bash
curl -X POST http://localhost:4321/api/admin/r2-sync \
  -H "Content-Type: application/json" \
  -d '{"operation": "export"}' \
  | jq .
```

Save the `exportKey` from the response.

#### Step 2: Download Export (Optional)

```bash
curl "http://localhost:4321/api/admin/r2-sync?operation=download&exportKey=export-123..." \
  -o local-export.json
```

#### Step 3: Upload to Production R2

For small files (<10MB):
```bash
curl -X POST https://your-prod-url.com/api/admin/r2-sync \
  -H "Content-Type: application/json" \
  -d @local-export.json
```

For large files (>10MB), use multipart upload:

1. Initialize:
```bash
curl -X POST https://your-prod-url.com/api/admin/multipart-upload \
  -H "Content-Type: application/json" \
  -d '{"action": "start"}' \
  | jq .
```

2. Upload chunks (use script or tool like split + curl)

3. Complete:
```bash
curl -X POST https://your-prod-url.com/api/admin/multipart-upload \
  -H "Content-Type: application/json" \
  -d '{
    "action": "complete",
    "key": "sync-123...",
    "uploadId": "upload-id...",
    "parts": [{"partNumber": 1, "etag": "..."}]
  }'
```

#### Step 4: Trigger Sync

```bash
curl -X POST https://your-prod-url.com/api/admin/r2-sync \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "sync",
    "syncKey": "export-123..."
  }' \
  | jq .
```

#### Step 5: Check Status

```bash
curl "https://your-prod-url.com/api/admin/r2-sync?syncKey=export-123..." \
  | jq .
```

## API Endpoints

### `/api/admin/r2-sync`

**POST - Operations:**
- `export` - Export current database to R2
- `upload` - Upload JSON data to R2
- `sync` - Import data from R2 into database

**GET:**
- `?operation=download&exportKey=...` - Download export file
- `?syncKey=...` - Check sync status

### `/api/admin/multipart-upload`

**POST:**
- `action: start` - Initialize multipart upload
- `action: complete` - Finalize multipart upload
- `action: abort` - Cancel multipart upload

**PUT:**
- Upload individual chunks (query params: `key`, `uploadId`, `partNumber`)

## Troubleshooting

### "Upload failed: 413 Content Too Large"

Your data is too large for single-part upload. Use the automated script which handles multipart uploads:

```bash
node scripts/export-and-upload.js --target=production
```

### "Sync failed: Already synced"

The version has already been imported. The system tracks sync history to prevent duplicates. To force re-sync:

1. Delete the seed_history record for that version
2. Increment the version number in your export

### "Authentication required"

Make sure you're logged in to the application. The endpoints require authentication via `locals.user`.

### Check R2 Contents

You can list files in R2 and see what's stored:

```bash
# Via Cloudflare dashboard
# Or create an admin endpoint to list R2 objects
```

## Best Practices

1. **Test locally first** - Always test sync workflow locally before running on production
2. **Check stats** - Review table counts before and after sync
3. **Backup first** - Export production data before importing new data
4. **Use versions** - Increment version numbers for each sync to track history
5. **Monitor size** - Keep exports under 500MB for reliability

## File Sizes

Typical export sizes:
- 1,000 posts = ~2 MB
- 10,000 posts = ~20 MB
- 100,000 posts = ~200 MB

R2 handles files up to 5TB, so you're covered for massive datasets.

## Cost

R2 is extremely cheap:
- Storage: $0.015/GB/month
- Class A operations (writes): $4.50/million
- Class B operations (reads): $0.36/million

A typical sync costs less than $0.01.
