import type { APIRoute } from "astro";
import { getDb } from "../../db/getDb";
import { authors, contentItems } from "../../db/schema";
import { eq, desc, sql, and, gte, like } from "drizzle-orm";
import { cached, CacheKeys, CacheTTL } from "../../lib/cache";

export const GET: APIRoute = async ({ locals, url }) => {
  const db = getDb(locals);
  const cache = locals.runtime.env.CACHE;

  // Parse query parameters
  const sort = url.searchParams.get("sort") || "score"; // score, posts, recent
  const platform = url.searchParams.get("platform");
  const minPosts = parseInt(url.searchParams.get("min_posts") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const risers = url.searchParams.get("risers") === "true"; // Show rising contributors
  const search = url.searchParams.get("search");
  const subreddit = url.searchParams.get("subreddit");
  const isStaff = url.searchParams.get("is_staff") === "true";
  const multiSubreddit = url.searchParams.get("multi_subreddit") === "true";

  try {
    // Generate cache key from all parameters
    const cacheKey = CacheKeys.authors({
      sort,
      platform: platform || undefined,
      search: search || undefined,
      subreddit: subreddit || undefined,
      isStaff,
      multiSubreddit,
      risers,
      limit,
      offset,
    });

    // Use cached wrapper to get or compute result
    const result = await cached(
      cache,
      cacheKey,
      async () => {
        // This is the existing query logic
    // Build conditions
    const conditions = [];

    if (platform) {
      conditions.push(eq(authors.platform, platform));
    }

    if (minPosts > 1) {
      conditions.push(gte(authors.postCount, minPosts));
    }

    // Add new filter conditions
    if (search) {
      conditions.push(like(authors.username, `%${search}%`));
    }

    if (isStaff) {
      conditions.push(eq(authors.isWebflowStaff, true));
    }

    if (subreddit && subreddit !== "all") {
      // Filter authors who have posted in this subreddit
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ${contentItems}
        WHERE ${contentItems.authorId} = ${authors.id}
        AND ${contentItems.subreddit} = ${subreddit}
      )`);
    }

    if (multiSubreddit) {
      // Only return authors who have posted/commented in multiple subreddits
      // Compute this dynamically from contentItems instead of relying on authors.subreddits
      conditions.push(sql`(
        SELECT COUNT(DISTINCT ${contentItems.subreddit})
        FROM ${contentItems}
        WHERE ${contentItems.authorId} = ${authors.id}
      ) > 1`);
    }

    // Calculate contributor score if needed
    // Score = (high_quality_count * 10) + (post_count * 1) + log(total_engagement + 1)
    const scoreExpression = sql<number>`
      (${authors.highQualityCount} * 10) +
      ${authors.postCount} +
      (CASE WHEN ${authors.totalEngagement} > 0
        THEN CAST(LOG(${authors.totalEngagement} + 1) * 10 AS INTEGER)
        ELSE 0
      END)
    `;

    // Determine sort order
    let orderBy;
    switch (sort) {
      case "posts":
        orderBy = desc(authors.postCount);
        break;
      case "recent":
        orderBy = desc(authors.lastSeen);
        break;
      case "quality":
        orderBy = desc(authors.highQualityCount);
        break;
      default:
        orderBy = desc(authors.contributorScore);
    }

    // For risers, we want authors who have been active recently with improving metrics
    if (risers) {
      const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
      conditions.push(gte(authors.lastSeen, weekAgo));
    }

    // Query authors
    const authorList = await db
      .select({
        id: authors.id,
        platform: authors.platform,
        platformId: authors.platformId,
        username: authors.username,
        displayName: authors.displayName,
        avatarUrl: authors.avatarUrl,
        firstSeen: authors.firstSeen,
        lastSeen: authors.lastSeen,
        postCount: authors.postCount,
        highQualityCount: authors.highQualityCount,
        totalEngagement: authors.totalEngagement,
        contributorScore: authors.contributorScore,
        isWebflowStaff: authors.isWebflowStaff,
        subreddits: authors.subreddits,
      })
      .from(authors)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(authors)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Get recent activity for each author (last 5 posts)
    const authorsWithActivity = await Promise.all(
      authorList.map(async (author) => {
        const recentPosts = await db
          .select({
            id: contentItems.id,
            title: contentItems.title,
            classification: contentItems.classification,
            createdAt: contentItems.createdAt,
            engagementScore: contentItems.engagementScore,
          })
          .from(contentItems)
          .where(eq(contentItems.authorId, author.id))
          .orderBy(desc(contentItems.createdAt))
          .limit(5);

        // Get all distinct subreddits this author has posted/commented in
        const subredditsData = await db
          .select({
            subreddit: contentItems.subreddit,
          })
          .from(contentItems)
          .where(eq(contentItems.authorId, author.id))
          .groupBy(contentItems.subreddit);

        const subredditsList: string[] = subredditsData
          .map((s) => s.subreddit)
          .filter((s): s is string => s !== null);

        // Get comment counts by subreddit
        const commentStats = await db
          .select({
            subreddit: contentItems.subreddit,
            commentCount: sql<number>`count(*)`,
          })
          .from(contentItems)
          .where(
            and(
              eq(contentItems.authorId, author.id),
              eq(contentItems.type, "comment")
            )
          )
          .groupBy(contentItems.subreddit);

        // Create comment count map by subreddit
        const commentCountsBySubreddit: Record<string, number> = {};
        commentStats.forEach((stat) => {
          if (stat.subreddit) {
            commentCountsBySubreddit[stat.subreddit] = stat.commentCount;
          }
        });

        return {
          ...author,
          subredditsList,
          commentCountsBySubreddit,
          recentPosts,
        };
      })
    );

        return {
          authors: authorsWithActivity,
          pagination: {
            total: countResult[0].count,
            limit,
            offset,
            hasMore: offset + authorList.length < countResult[0].count,
          },
        };
      },
      { ttl: CacheTTL.MEDIUM } // Cache for 5 minutes
    );

    return Response.json(result);
  } catch (error) {
    console.error("Authors fetch error:", error);
    return Response.json(
      { error: "Failed to fetch authors", details: String(error) },
      { status: 500 }
    );
  }
};
