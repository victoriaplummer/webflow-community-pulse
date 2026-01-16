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
 * Sync endpoint - imports data from dev to production
 * Protected by ALLOW_DB_SYNC env var and SYNC_SECRET
 *
 * POST /api/admin/sync
 * Headers: Authorization: Bearer <SYNC_SECRET>
 * Body: { version: 1, data: { authors: [...], content_items: [...], ... } }
 */
export const POST: APIRoute = async ({ locals, request }) => {
  const db = getDb(locals);
  const env = locals.runtime.env;

  // Security checks
  if (env.ALLOW_DB_SYNC !== "true") {
    return Response.json(
      { error: "Sync disabled. Set ALLOW_DB_SYNC=true to enable." },
      { status: 403 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const expectedAuth = `Bearer ${env.SYNC_SECRET}`;

  if (!env.SYNC_SECRET || authHeader !== expectedAuth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { version = 1, data } = body as {
      version?: number;
      data: Record<string, unknown[]>;
    };

    if (!data) {
      return Response.json({ error: "No data provided" }, { status: 400 });
    }

    const results: Record<string, { attempted: number; inserted: number }> = {};

    // Helper to insert with conflict handling
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

      // Check if this version was already synced
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

      let inserted = 0;

      // Insert in batches to avoid memory issues
      const batchSize = 100;
      for (let i = 0; i < tableData.length; i += batchSize) {
        const batch = tableData.slice(i, i + batchSize);

        try {
          // Use raw SQL for ON CONFLICT DO NOTHING since Drizzle's support varies
          for (const row of batch) {
            try {
              await db.insert(table).values(row).onConflictDoNothing();
              inserted++;
            } catch (err) {
              // Row may already exist or have constraint violation, skip it
              console.log(`Skipped row in ${tableName}:`, err);
            }
          }
        } catch (batchError) {
          console.error(`Batch error in ${tableName}:`, batchError);
        }
      }

      // Record this sync
      await db.insert(seedHistory).values({
        seedName: tableName,
        seedVersion: version,
        recordCount: inserted,
        appliedAt: Math.floor(Date.now() / 1000),
      });

      return { attempted: tableData.length, inserted };
    }

    // Sync tables in dependency order (authors before content_items, etc.)

    // 1. Authors (no dependencies)
    if (data.authors) {
      results.authors = await syncTable(
        "authors",
        data.authors as Record<string, unknown>[],
        authors,
        ["platform", "platform_id"]
      );
    }

    // 2. Content items (depends on authors)
    if (data.content_items) {
      results.content_items = await syncTable(
        "content_items",
        data.content_items as Record<string, unknown>[],
        contentItems,
        ["platform", "platform_id"]
      );
    }

    // 3. Engagement snapshots (depends on content_items)
    if (data.engagement_snapshots) {
      results.engagement_snapshots = await syncTable(
        "engagement_snapshots",
        data.engagement_snapshots as Record<string, unknown>[],
        engagementSnapshots,
        ["id"]
      );
    }

    // 4. Insight generations (no dependencies)
    if (data.insight_generations) {
      results.insight_generations = await syncTable(
        "insight_generations",
        data.insight_generations as Record<string, unknown>[],
        insightGenerations,
        ["id"]
      );
    }

    // 5. Insights (depends on insight_generations)
    if (data.insights) {
      results.insights = await syncTable(
        "insights",
        data.insights as Record<string, unknown>[],
        insights,
        ["id"]
      );
    }

    // 6. Roundups (no dependencies)
    if (data.roundups) {
      results.roundups = await syncTable(
        "roundups",
        data.roundups as Record<string, unknown>[],
        roundups,
        ["id"]
      );
    }

    // 7. Roundup items (depends on roundups and content_items)
    if (data.roundup_items) {
      results.roundup_items = await syncTable(
        "roundup_items",
        data.roundup_items as Record<string, unknown>[],
        roundupItems,
        ["id"]
      );
    }

    return Response.json({
      success: true,
      version,
      results,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Sync error:", error);
    return Response.json(
      { error: "Failed to sync data", details: String(error) },
      { status: 500 }
    );
  }
};

/**
 * GET endpoint - returns sync status and history
 */
export const GET: APIRoute = async ({ locals, url }) => {
  const db = getDb(locals);
  const env = locals.runtime.env;

  // Check authorization
  const secret = url.searchParams.get("secret");
  if (secret !== env.SYNC_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const history = await db
      .select()
      .from(seedHistory)
      .orderBy(sql`${seedHistory.appliedAt} DESC`)
      .limit(50);

    return Response.json({
      syncEnabled: env.ALLOW_DB_SYNC === "true",
      history: history.map((h) => ({
        ...h,
        appliedAtFormatted: new Date(h.appliedAt * 1000).toISOString(),
      })),
    });
  } catch (error) {
    console.error("Sync status error:", error);
    return Response.json(
      { error: "Failed to get sync status", details: String(error) },
      { status: 500 }
    );
  }
};
