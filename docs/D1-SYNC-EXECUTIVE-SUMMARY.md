# Database Sync Blocker: Need Direct D1 Access

## TL;DR

**Current state**: Takes 10-18 minutes and 15-20 manual command executions to sync our database to production

**Why**: Cloudflare Workers have a hard limit of ~500-1000 subrequests per invocation. Our database has 16,539 records. Every database INSERT = 1 subrequest. Math doesn't work.

**What we need**: Direct Cloudflare D1 API access OR Wrangler CLI access

**Impact if we get it**: Sync time drops from 10-18 minutes → 1-2 minutes (automated, single command)

---

## The Numbers

```
Current Database:
- 16,539 records across 7 tables
- 10.13 MB of data
- Represents $50-100 in AI analysis costs (already spent)

Current Sync Process:
- Time: 10-18 minutes per sync
- Manual steps: 15-20 command executions
- Error rate: High (easy to miss tables)
- Developer experience: Extremely poor

With Direct D1 API:
- Time: 1-2 minutes per sync
- Manual steps: 1 command
- Error rate: Zero (automated)
- Developer experience: Standard database workflow
```

---

## What We Tried

1. ❌ **Direct JSON upload** → Hit Worker subrequest limit
2. ❌ **R2 storage intermediary** → Still hit limit (D1 queries count as subrequests)
3. ❌ **Resumable micro-batches** → Works but requires 33+ manual runs (20-30 minutes)
4. ✅ **Table-by-table** → Current workaround, still painful (10-18 minutes)

**The problem isn't our code** - it's that we're using Workers (edge compute) for a backend data operation (bulk database sync). This is architectural mismatch.

---

## The Ask

**Option 1** (Preferred): Enable direct D1 API access
- Give us: Database ID, Account ID, API token
- We'll call: `POST https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{db}/query`
- This is Cloudflare's official API: https://developers.cloudflare.com/api/resources/d1/

**Option 2**: Enable Wrangler CLI for Webflow Cloud apps
- Let us run: `wrangler d1 execute DB --file=sync.sql --remote`
- Standard tool all Cloudflare customers use

**Timeline**: Next 1-2 weeks ideally (currently blocking efficient development)

---

## Why This Matters

### Developer Velocity
- Currently syncing prod DB is so painful we avoid it
- Leads to dev/prod drift
- Slows down testing and iteration

### This is Standard Practice
Every cloud database offers direct API access:
- AWS RDS Data API
- Google Cloud SQL REST API
- Supabase PostgREST
- PlanetScale SQL API
- **Cloudflare D1 API** ← we just need access to it

### Platform Opportunity
Other Webflow Cloud customers probably hit this too. Consider making D1 API access a platform feature.

---

## Technical Context

Workers are **designed** for edge compute (API requests, routing, etc.). They have hard limits:
- 50-1,000 subrequests per invocation
- 30 seconds CPU time
- Every database call = 1 subrequest

For bulk data operations (database syncs, migrations, backfills), you need **backend compute**:
- D1 API runs in Cloudflare's backend
- No Worker limits
- Can process millions of rows in one SQL statement

**We're trying to use the wrong tool** because it's the only tool Webflow Cloud exposes.

---

## Questions?

See full technical details: [`D1-SYNC-REQUIREMENTS.md`](./D1-SYNC-REQUIREMENTS.md)

**Bottom line**: We built a database app on Webflow Cloud. We need standard database tooling. Can the platform team help enable this?
