# Scripts Documentation

This directory contains CLI scripts for managing the Webflow Community Pulse application.

## Data Sync Scripts

### `npm run sync` (Recommended)
**File:** `export-and-upload.js`

Syncs data from local development to production using R2 multipart upload. This is the **recommended method** for syncing large datasets as it handles file sizes beyond request limits.

**Usage:**

⚠️ **Important**: Large datasets hit Cloudflare Worker limits (~500-1000 subrequest limit). Sync ONE table at a time:

```bash
# 1. Sync authors (run 3-4 times until no more inserts)
npm run sync -- \
  --local-cookie="pulse_session=LOCAL" \
  --prod-cookie="pulse_session=PROD" \
  --table=authors

# 2. Sync content_items (run 4-5 times)
npm run sync -- \
  --local-cookie="pulse_session=LOCAL" \
  --prod-cookie="pulse_session=PROD" \
  --table=content_items

# 3. Sync engagement_snapshots (run 4-5 times)
npm run sync -- \
  --local-cookie="pulse_session=LOCAL" \
  --prod-cookie="pulse_session=PROD" \
  --table=engagement_snapshots

# 4. Sync smaller tables (1 run each)
npm run sync -- --local-cookie="..." --prod-cookie="..." --table=insights
npm run sync -- --local-cookie="..." --prod-cookie="..." --table=insight_generations
npm run sync -- --local-cookie="..." --prod-cookie="..." --table=roundups
npm run sync -- --local-cookie="..." --prod-cookie="..." --table=roundup_items
```

**Why multiple runs?**
- Each run processes ~500-1000 records before hitting Worker limits
- Duplicates are skipped automatically via UNIQUE constraints
- Keep running until you see: `Processed X records (duplicates automatically skipped)` with no errors

**Alternative: Sync all tables** (not recommended for large datasets):
```bash
# Will need 10-15 total runs across all tables
npm run sync -- \
  --local-cookie="pulse_session=LOCAL" \
  --prod-cookie="pulse_session=PROD"
```

**Getting your session cookies:**

Local cookie (required for all syncs):
1. Log into `http://localhost:4321/pulse/login`
2. Open DevTools (F12) > Application > Cookies > http://localhost:4321
3. Copy the `pulse_session` cookie value

Production cookie (required for production sync):
1. Log into `https://twirlingtacotales.xyz/pulse/login`
2. Open DevTools (F12) > Application > Cookies > https://twirlingtacotales.xyz
3. Copy the `pulse_session` cookie value

**Environment Variables:**
- `LOCAL_API` - Local dev server URL (default: `http://localhost:4321/pulse`)
- `PROD_API` - Production URL (default: `https://twirlingtacotales.xyz/pulse`)
- `LOCAL_SESSION_COOKIE` - Local session cookie (optional, can use `--local-cookie` flag)
- `PROD_SESSION_COOKIE` - Production session cookie (optional, can use `--prod-cookie` flag)

**How it works:**
1. Exports data from local database
2. Splits into 10MB chunks
3. Uploads to R2 using multipart upload
4. Triggers sync on target environment

---

### `npm run sync:direct`
**File:** `sync-to-prod.ts`

Direct sync method that POSTs data directly to production. Use this for small datasets or when R2 is unavailable.

**Usage:**
```bash
npm run sync:direct -- --prod-url https://your-app.webflow.io/pulse --secret YOUR_SECRET
```

**Options:**
- `--prod-url` - Production URL (required)
- `--secret` - SYNC_SECRET for authentication (required)
- `--tables` - Comma-separated list of tables to sync (optional)
- `--dry-run` - Show what would be synced without actually syncing

**Limitations:**
- May fail with large datasets due to request size limits
- Requires direct network access to production

---

## Backfill Scripts

### `npm run backfill`
**File:** `backfill-all.ts`

Backfills posts from Reddit across all configured subreddits.

**Usage:**
```bash
# Backfill all subreddits (requires dev server running)
npm run dev  # In another terminal
npm run backfill -- --cookie "session=your-session-cookie"

# Backfill specific subreddits
npm run backfill -- --subreddits webflow,framer --pages 5 --cookie "..."

# Dry run
npm run backfill -- --dry-run

# Safe mode (smaller batches to avoid timeouts)
npm run backfill -- --safe --cookie "..."
```

**Options:**
- `--cookie` - Session cookie for authentication (required)
- `--url` - Base URL (default: `http://localhost:4321/pulse`)
- `--pages` - Pages per subreddit (default: 10, max: 10)
- `--subreddits` - Comma-separated list (default: all)
- `--analyze-all` - Analyze all posts with Claude (slower)
- `--safe` - Use smaller batches (3 pages instead of 10)
- `--delay` - Delay between subreddits in ms (default: 2000)
- `--dry-run` - Show what would be done without making requests

**Getting your session cookie:**
1. Log into the app in your browser
2. Open DevTools > Application > Cookies
3. Copy the `session` cookie value

---

## Analysis Scripts

### `npm run analyze`
**File:** `analyze-all.ts`

Analyzes content using Claude AI to extract insights, sentiment, classifications, etc.

**Usage:**
```bash
npm run analyze
```

---

## Subreddit Configuration

The backfill script monitors these subreddit categories:

**Primary:**
- `webflow` - Main community (always fully analyzed)

**Mentions:**
- `webdev`, `web_design`, `nocode` - Find Webflow mentions

**Competitors:**
- `framer`, `wordpress`, `squarespace`, `wix`, `shopify`, `Supabase`

---

## Workflow

### Initial Setup
1. Start dev server: `npm run dev`
2. Log into the app to get session cookie
3. Backfill data: `npm run backfill -- --cookie "session=..."`
4. Analyze content: `npm run analyze`

### Deploying to Production
1. Backfill and analyze locally
2. Sync to production: `npm run sync`
3. Deploy app: `npm run deploy`

### Regular Updates
Backfill runs automatically via scheduled triggers (every 30 minutes). Manual backfills are only needed for:
- Initial data load
- Historical data
- Missed updates

---

## Troubleshooting

### Backfill timeouts
- Use `--safe` flag for smaller batches
- Run against local dev server (no timeout)
- Don't use `--analyze-all` on large subreddits

### Sync failures
- For large datasets, use `npm run sync` (R2 method)
- For small datasets, use `npm run sync:direct`
- Check that `ALLOW_DB_SYNC=true` in production

### Authentication errors
- Make sure your session cookie is valid
- Refresh the cookie by logging in again
- Check that you have admin access
