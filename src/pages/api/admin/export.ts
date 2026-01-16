import type { APIRoute } from "astro";
import { getDb } from "../../../db/getDb";
import {
  authors,
  contentItems,
  engagementSnapshots,
  insights,
  insightGenerations,
  roundups,
  roundupItems,
} from "../../../db/schema";

/**
 * Export endpoint - dumps local database data as JSON
 * Used to export dev data for syncing to production
 *
 * GET /api/admin/export?tables=authors,content_items
 * GET /api/admin/export (exports all tables)
 */
export const GET: APIRoute = async ({ locals, url }) => {
  const db = getDb(locals);
  const env = locals.runtime.env;

  // Only allow in development or with secret
  const secret = url.searchParams.get("secret");
  const isLocalDev = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const allowExport = env.ALLOW_DB_SYNC === "true" || isLocalDev;

  if (!allowExport && secret !== env.SYNC_SECRET) {
    return Response.json({ error: "Export not allowed" }, { status: 403 });
  }

  const requestedTables = url.searchParams.get("tables")?.split(",") || [];
  const exportAll = requestedTables.length === 0;

  try {
    const exportData: Record<string, unknown[]> = {};

    // Export authors
    if (exportAll || requestedTables.includes("authors")) {
      exportData.authors = await db.select().from(authors);
    }

    // Export content_items
    if (exportAll || requestedTables.includes("content_items")) {
      exportData.content_items = await db.select().from(contentItems);
    }

    // Export engagement_snapshots
    if (exportAll || requestedTables.includes("engagement_snapshots")) {
      exportData.engagement_snapshots = await db.select().from(engagementSnapshots);
    }

    // Export insight_generations
    if (exportAll || requestedTables.includes("insight_generations")) {
      exportData.insight_generations = await db.select().from(insightGenerations);
    }

    // Export insights
    if (exportAll || requestedTables.includes("insights")) {
      exportData.insights = await db.select().from(insights);
    }

    // Export roundups
    if (exportAll || requestedTables.includes("roundups")) {
      exportData.roundups = await db.select().from(roundups);
    }

    // Export roundup_items
    if (exportAll || requestedTables.includes("roundup_items")) {
      exportData.roundup_items = await db.select().from(roundupItems);
    }

    // Calculate counts
    const counts: Record<string, number> = {};
    for (const [table, data] of Object.entries(exportData)) {
      counts[table] = data.length;
    }

    return Response.json({
      success: true,
      exportedAt: new Date().toISOString(),
      counts,
      data: exportData,
    });
  } catch (error) {
    console.error("Export error:", error);
    return Response.json(
      { error: "Failed to export data", details: String(error) },
      { status: 500 }
    );
  }
};
