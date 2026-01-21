import type { APIRoute } from "astro";
import { getDb } from "../../db/getDb";
import { contentItems } from "../../db/schema";
import { sql } from "drizzle-orm";
import { cached, CacheTTL } from "../../lib/cache";

/**
 * Get list of all subreddits in the database
 * Used for populating filter dropdowns
 */
export const GET: APIRoute = async ({ locals }) => {
  const db = getDb(locals);
  const cache = locals.runtime.env.CACHE;

  try {
    const result = await cached(
      cache,
      "subreddits:list",
      async () => {
        // Get all distinct subreddits
        const subreddits = await db
          .select({
            subreddit: contentItems.subreddit,
            count: sql<number>`count(*)`,
          })
          .from(contentItems)
          .where(sql`${contentItems.subreddit} IS NOT NULL`)
          .groupBy(contentItems.subreddit)
          .orderBy(sql`count(*) DESC`);

        return subreddits
          .filter((s) => s.subreddit !== null)
          .map((s) => ({
            name: s.subreddit,
            count: s.count,
          }));
      },
      { ttl: CacheTTL.LONG } // Cache for 10 minutes
    );

    return Response.json({
      subreddits: result,
    });
  } catch (error) {
    console.error("Subreddits fetch error:", error);
    return Response.json(
      { error: "Failed to fetch subreddits", details: String(error) },
      { status: 500 }
    );
  }
};
