import type { APIRoute } from "astro";
import { getDb } from "../../db/getDb";
import { contentItems, authors } from "../../db/schema";
import { eq, desc, asc, and, like, sql, or, gte } from "drizzle-orm";
import { cached, cacheKey, CacheTTL } from "../../lib/cache";

export const GET: APIRoute = async ({ locals, url }) => {
  const db = getDb(locals);
  const cache = locals.runtime.env.CACHE;

  // Parse query parameters (now supporting arrays via comma-separated values)
  const sentiments = url.searchParams.get("sentiments")?.split(",").filter(Boolean) || [];
  const classifications = url.searchParams.get("classifications")?.split(",").filter(Boolean) || [];
  const topics = url.searchParams.get("topics")?.split(",").filter(Boolean) || [];
  const subreddits = url.searchParams.get("subreddits")?.split(",").filter(Boolean) || [];

  // Legacy single-value support (fallback)
  const sentiment = url.searchParams.get("sentiment");
  const classification = url.searchParams.get("classification");
  const topic = url.searchParams.get("topic");
  const subreddit = url.searchParams.get("subreddit");

  const webflowOnly = url.searchParams.get("webflow_only") === "true";
  const needsReview = url.searchParams.get("needs_review") === "true";
  const search = url.searchParams.get("search");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  // Multi-platform monitoring filters
  const mentionsWebflow = url.searchParams.get("mentions_webflow");
  const minAudienceRelevance = url.searchParams.get("min_audience_relevance");
  const mentionedTools = url.searchParams.get("mentioned_tools")?.split(",").filter(Boolean) || [];
  const mentionedTool = url.searchParams.get("mentioned_tool"); // Legacy single value

  // Sorting parameters
  const sortBy = url.searchParams.get("sort_by") || "createdAt";
  const sortOrder = url.searchParams.get("sort_order") || "desc";

  // Generate cache key from all parameters
  const contentCacheKey = cacheKey(
    "content",
    sentiments.join("-"),
    classifications.join("-"),
    topics.join("-"),
    subreddits.join("-"),
    sentiment, // Legacy
    classification, // Legacy
    topic, // Legacy
    subreddit, // Legacy
    webflowOnly,
    needsReview,
    search,
    mentionsWebflow,
    minAudienceRelevance,
    mentionedTools.join("-"),
    mentionedTool, // Legacy
    sortBy,
    sortOrder,
    limit,
    offset
  );

  // Map sort field to column
  const sortColumns: Record<string, typeof contentItems.createdAt> = {
    createdAt: contentItems.createdAt,
    engagementScore: contentItems.engagementScore,
    qualityScore: contentItems.qualityScore,
    sentiment: contentItems.sentiment,
    classification: contentItems.classification,
  };
  const sortColumn = sortColumns[sortBy] || contentItems.createdAt;

  try {
    // Use cached wrapper to get or compute result
    const result = await cached(
      cache,
      contentCacheKey,
      async () => {
        // Build conditions
        const conditions = [];

    // Multiselect filters (array support)
    if (sentiments.length > 0) {
      conditions.push(or(...sentiments.map(s => eq(contentItems.sentiment, s))));
    } else if (sentiment) {
      // Legacy single value support
      conditions.push(eq(contentItems.sentiment, sentiment));
    }

    if (classifications.length > 0) {
      conditions.push(or(...classifications.map(c => eq(contentItems.classification, c))));
    } else if (classification) {
      conditions.push(eq(contentItems.classification, classification));
    }

    if (topics.length > 0) {
      conditions.push(or(...topics.map(t => eq(contentItems.topic, t))));
    } else if (topic) {
      conditions.push(eq(contentItems.topic, topic));
    }

    if (subreddits.length > 0) {
      conditions.push(or(...subreddits.map(s => eq(contentItems.subreddit, s))));
    } else if (subreddit) {
      conditions.push(eq(contentItems.subreddit, subreddit));
    }

    if (webflowOnly) {
      conditions.push(eq(contentItems.isWebflowRelated, true));
    }

    if (needsReview) {
      conditions.push(eq(contentItems.needsReview, true));
    }

    if (search) {
      conditions.push(
        or(
          like(contentItems.title, `%${search}%`),
          like(contentItems.body, `%${search}%`)
        )
      );
    }

    // Multi-platform monitoring filters
    if (mentionsWebflow === "true") {
      conditions.push(eq(contentItems.mentionsWebflow, true));
    } else if (mentionsWebflow === "false") {
      conditions.push(eq(contentItems.mentionsWebflow, false));
    }

    if (minAudienceRelevance) {
      const minRelevance = parseInt(minAudienceRelevance);
      if (!isNaN(minRelevance)) {
        conditions.push(gte(contentItems.audienceRelevance, minRelevance));
      }
    }

    if (mentionedTools.length > 0) {
      // Search for any of the tools in JSON array
      conditions.push(or(...mentionedTools.map(tool => like(contentItems.mentionedTools, `%"${tool}"%`))));
    } else if (mentionedTool) {
      // Legacy single value support
      conditions.push(like(contentItems.mentionedTools, `%"${mentionedTool}"%`));
    }

    // Query with joins
    const items = await db
      .select({
        id: contentItems.id,
        platform: contentItems.platform,
        platformId: contentItems.platformId,
        type: contentItems.type,
        title: contentItems.title,
        body: contentItems.body,
        url: contentItems.url,
        subreddit: contentItems.subreddit,
        createdAt: contentItems.createdAt,
        ingestedAt: contentItems.ingestedAt,
        sentiment: contentItems.sentiment,
        sentimentConfidence: contentItems.sentimentConfidence,
        classification: contentItems.classification,
        classificationConfidence: contentItems.classificationConfidence,
        topic: contentItems.topic,
        needsReview: contentItems.needsReview,
        engagementScore: contentItems.engagementScore,
        isWebflowRelated: contentItems.isWebflowRelated,
        qualityScore: contentItems.qualityScore,
        summary: contentItems.summary,
        flair: contentItems.flair,
        isRoundupCandidate: contentItems.isRoundupCandidate,
        // Multi-platform monitoring fields
        mentionsWebflow: contentItems.mentionsWebflow,
        mentionedTools: contentItems.mentionedTools,
        audienceRelevance: contentItems.audienceRelevance,
        authorUsername: authors.username,
        authorId: authors.id,
      })
      .from(contentItems)
      .leftJoin(authors, eq(contentItems.authorId, authors.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(contentItems)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

        return {
          items,
          pagination: {
            total: countResult[0].count,
            limit,
            offset,
            hasMore: offset + items.length < countResult[0].count,
          },
        };
      },
      { ttl: CacheTTL.MEDIUM } // Cache for 5 minutes
    );

    return Response.json(result);
  } catch (error) {
    console.error("Content fetch error:", error);
    return Response.json(
      { error: "Failed to fetch content", details: String(error) },
      { status: 500 }
    );
  }
};

// Get single content item by ID
export const getStaticPaths = () => [];
