import type { APIRoute } from "astro";
import { getDb } from "../../db/getDb";
import { contentItems, authors } from "../../db/schema";
import { eq, desc, asc, and, like, sql, or, gte } from "drizzle-orm";

export const GET: APIRoute = async ({ locals, url }) => {
  const db = getDb(locals);

  // Parse query parameters
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
  const mentionedTool = url.searchParams.get("mentioned_tool");

  // Sorting parameters
  const sortBy = url.searchParams.get("sort_by") || "createdAt";
  const sortOrder = url.searchParams.get("sort_order") || "desc";

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
    // Build conditions
    const conditions = [];

    if (sentiment) {
      conditions.push(eq(contentItems.sentiment, sentiment));
    }

    if (classification) {
      conditions.push(eq(contentItems.classification, classification));
    }

    if (topic) {
      conditions.push(eq(contentItems.topic, topic));
    }

    if (subreddit) {
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

    if (mentionedTool) {
      // Search for tool in JSON array (SQLite JSON functions)
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

    return Response.json({
      items,
      pagination: {
        total: countResult[0].count,
        limit,
        offset,
        hasMore: offset + items.length < countResult[0].count,
      },
    });
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
