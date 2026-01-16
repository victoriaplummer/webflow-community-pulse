Absolutely — here’s a **clean, agency-grade PR plan** you could actually drop into GitHub. This assumes **Webflow Cloud + Drizzle + SQLite (D1)** and no Wrangler access.

---

# PR: Add Idempotent Database Seeding for Webflow Cloud

## Summary

This PR introduces a **safe, repeatable database seeding system** using Drizzle ORM to support environment-scoped databases in Webflow Cloud.

The goal is to:

- Backfill required baseline data in production
- Allow new reference data added in dev to be promoted to prod
- Avoid copying dev databases or relying on Wrangler
- Ensure seeds are safe to re-run (idempotent)

---

## Problem

Webflow Cloud databases are **environment-scoped**, meaning:

- Local/dev data does **not** exist in preview/production
- Deploying only applies schema migrations
- There is no automatic mechanism to promote dev rows to prod

Without a seeding strategy, production starts empty and diverges from dev over time.

---

## Solution Overview

Introduce a **versioned, idempotent seed runner** that:

- Uses Drizzle schema + inserts/upserts
- Runs manually or via CI after deploy
- Only inserts new reference data (never overwrites user data)
- Tracks which seed versions have been applied

---

## Scope

✅ Included

- Seed infrastructure
- One-time admin seed endpoint
- Seed version tracking

🚫 Not included

- Copying full dev DB state
- Seeding user-generated content
- Build-time seeding

---

## Implementation Plan

### 1. Add seed history table

Used to track which seed versions have been applied.

```ts
// db/schema/seedHistory.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const seedHistory = sqliteTable("seed_history", {
  id: integer("id").primaryKey(),
  seedName: text("seed_name").notNull(),
  seedVersion: integer("seed_version").notNull(),
  appliedAt: integer("applied_at").notNull(),
});
```

---

### 2. Create seed runner

Encapsulates all seed logic and ensures idempotency.

```ts
// db/seeds/runSeeds.ts
import { db } from "../db";
import { seedHistory } from "../schema/seedHistory";
import { eq, and } from "drizzle-orm";

export async function runSeed(
  seedName: string,
  version: number,
  fn: () => Promise<void>
) {
  const existing = await db
    .select()
    .from(seedHistory)
    .where(
      and(
        eq(seedHistory.seedName, seedName),
        eq(seedHistory.seedVersion, version)
      )
    );

  if (existing.length > 0) {
    return { skipped: true };
  }

  await fn();

  await db.insert(seedHistory).values({
    seedName,
    seedVersion: version,
    appliedAt: Date.now(),
  });

  return { applied: true };
}
```

---

### 3. Add seed files (example)

Each seed is versioned and uses **upserts / on-conflict behavior**.

```ts
// db/seeds/roles.ts
import { db } from "../db";
import { roles } from "../schema/roles";
import { runSeed } from "./runSeeds";

export async function seedRoles() {
  await runSeed("roles", 1, async () => {
    await db
      .insert(roles)
      .values([
        { slug: "admin", name: "Admin" },
        { slug: "editor", name: "Editor" },
      ])
      .onConflictDoNothing();
  });
}
```

---

### 4. Central seed entrypoint

Controls execution order and grouping.

```ts
// db/seeds/index.ts
import { seedRoles } from "./roles";
// import other seeds here

export async function runAllSeeds() {
  await seedRoles();
  // await seedPlans();
  // await seedFeatureFlags();
}
```

---

### 5. Add protected admin seed endpoint

Runs seeds **only when explicitly enabled**.

```ts
// app/api/admin/seed/route.ts
import { runAllSeeds } from "@/db/seeds";

export async function POST(req: Request) {
  if (process.env.ALLOW_DB_SEED !== "true") {
    return new Response("Seeding disabled", { status: 403 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.SEED_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  await runAllSeeds();

  return Response.json({ success: true });
}
```

---

## Deployment Flow

### Initial deployment

1. Deploy app (migrations run, DB is empty)
2. Temporarily set:

   ```
   ALLOW_DB_SEED=true
   SEED_SECRET=...
   ```

3. Call:

   ```bash
   curl -X POST /api/admin/seed \
     -H "Authorization: Bearer <secret>"
   ```

4. Disable `ALLOW_DB_SEED`

---

### Subsequent deploys with new seed data

1. Add new rows to seed files
2. Bump seed version number
3. Deploy
4. Call seed endpoint again
5. Only new data is inserted

---

## Safety Guarantees

- ✅ Idempotent (safe to re-run)
- ✅ No dev → prod DB copying
- ✅ No prod user data overwritten
- ✅ Fully versioned + auditable
- ✅ Works without Wrangler

---

## Why this is agency-grade

- Predictable across clients and environments
- Reviewable in PRs
- Matches how professional teams handle **data migrations**
- Compatible with Webflow Cloud constraints

---

## Follow-ups (optional)

- Add CI step to auto-run seed endpoint after deploy
- Add seed logging/metrics
- Split seeds by domain (`core`, `billing`, `cms`)

---

If you want, next I can:

- Convert this into a **real GitHub PR description**
- Adapt it to **your exact Drizzle schema**
- Add a **data-migration pattern** for cases where seed data needs updates, not just inserts
