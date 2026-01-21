import type { APIRoute } from "astro";
import { getDb } from "../../../../db/getDb";
import { authors, contentItems } from "../../../../db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { cached, CacheKeys, CacheTTL } from "../../../../lib/cache";

export const GET: APIRoute = async ({ locals, params, url }) => {
  const authorId = parseInt(params.id || "", 10);
  if (isNaN(authorId)) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const db = getDb(locals);
  const cache = locals.runtime.env.CACHE;

  try {
    // Get filter parameters
    const type = url.searchParams.get("type");

    // Generate cache key
    const cacheKey = CacheKeys.authorProfile(authorId, type || undefined);

    // Use cached wrapper
    const result = await cached(
      cache,
      cacheKey,
      async () => {
    // Get author
    const [author] = await db
      .select()
      .from(authors)
      .where(eq(authors.id, authorId))
      .limit(1);

    if (!author) {
      return Response.json({ error: "Author not found" }, { status: 404 });
    }

    // Get pagination and filter parameters
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const type = url.searchParams.get("type"); // "post" or "comment" or null for all

    // Build where conditions
    const conditions = [eq(contentItems.authorId, authorId)];
    if (type === "post" || type === "comment") {
      conditions.push(eq(contentItems.type, type));
    }

    // Get all posts/comments with pagination
    const posts = await db
      .select()
      .from(contentItems)
      .where(and(...conditions))
      .orderBy(desc(contentItems.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contentItems)
      .where(and(...conditions));

    // Get counts by type
    const [{ postCount }] = await db
      .select({ postCount: sql<number>`count(*)` })
      .from(contentItems)
      .where(
        and(
          eq(contentItems.authorId, authorId),
          eq(contentItems.type, "post")
        )
      );

    const [{ commentCount }] = await db
      .select({ commentCount: sql<number>`count(*)` })
      .from(contentItems)
      .where(
        and(
          eq(contentItems.authorId, authorId),
          eq(contentItems.type, "comment")
        )
      );

    // Get comment counts by subreddit
    const commentStats = await db
      .select({
        subreddit: contentItems.subreddit,
        commentCount: sql<number>`count(*)`,
      })
      .from(contentItems)
      .where(
        and(
          eq(contentItems.authorId, authorId),
          eq(contentItems.type, "comment")
        )
      )
      .groupBy(contentItems.subreddit);

    // Get all distinct subreddits this author has posted/commented in
    const subredditsData = await db
      .select({
        subreddit: contentItems.subreddit,
      })
      .from(contentItems)
      .where(eq(contentItems.authorId, authorId))
      .groupBy(contentItems.subreddit);

    const subredditsList: string[] = subredditsData
      .map((s) => s.subreddit)
      .filter((s): s is string => s !== null);

    // Create comment count map by subreddit
    const commentCountsBySubreddit: Record<string, number> = {};
    commentStats.forEach((stat) => {
      if (stat.subreddit) {
        commentCountsBySubreddit[stat.subreddit] = stat.commentCount;
      }
    });

        return {
          author: { ...author, subredditsList },
          posts,
          stats: {
            postCount,
            commentCount,
            commentCountsBySubreddit,
          },
          pagination: {
            total: count,
            limit,
            offset,
            hasMore: offset + posts.length < count,
          },
        };
      },
      { ttl: CacheTTL.MEDIUM } // Cache for 5 minutes
    );

    return Response.json(result);
  } catch (error) {
    console.error("Author profile fetch error:", error);
    return Response.json(
      { error: "Failed to fetch author profile", details: String(error) },
      { status: 500 }
    );
  }
};
