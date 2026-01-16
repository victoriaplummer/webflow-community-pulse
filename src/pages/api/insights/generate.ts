import type { APIRoute } from "astro";
import { getDb } from "../../../db/getDb";
import { insights, insightGenerations, contentItems, authors } from "../../../db/schema";
import { generateInsights } from "../../../lib/claude";
import { desc, gte, eq, and } from "drizzle-orm";

export const POST: APIRoute = async ({ locals, request }) => {
  const db = getDb(locals);
  const env = locals.runtime.env;
  const user = locals.user;

  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const anthropicKey = env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  // Parse request body for options
  let options: {
    subreddit?: string;
    periodDays?: number;
  } = {};

  try {
    const body = await request.json();
    options = { ...options, ...body };
  } catch {
    // Use defaults
  }

  const periodDays = options.periodDays || 14;
  const subredditFilter = options.subreddit || null;

  try {
    // Get content from the specified period
    const periodAgo = Math.floor(Date.now() / 1000) - periodDays * 24 * 60 * 60;

    // Build query conditions
    const conditions = [gte(contentItems.createdAt, periodAgo)];
    if (subredditFilter) {
      conditions.push(eq(contentItems.subreddit, subredditFilter));
    }

    const recentContent = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
        body: contentItems.body,
        url: contentItems.url,
        sentiment: contentItems.sentiment,
        classification: contentItems.classification,
        qualityScore: contentItems.qualityScore,
        questionCategory: contentItems.questionCategory,
        isFaqCandidate: contentItems.isFaqCandidate,
        isShowcase: contentItems.isShowcase,
        authorUsername: authors.username,
        subreddit: contentItems.subreddit,
        createdAt: contentItems.createdAt,
      })
      .from(contentItems)
      .leftJoin(authors, eq(contentItems.authorId, authors.id))
      .where(and(...conditions))
      .orderBy(desc(contentItems.createdAt))
      .limit(200); // Get up to 200 recent items

    if (recentContent.length === 0) {
      return Response.json({
        success: false,
        error: `No content found${subredditFilter ? ` in r/${subredditFilter}` : ""} in the last ${periodDays} days. Ingest some posts first.`,
      });
    }

    console.log(`Generating insights from ${recentContent.length} content items${subredditFilter ? ` in r/${subredditFilter}` : ""}...`);

    // Generate insights using Claude
    const result = await generateInsights(anthropicKey, recentContent);

    if (result.insights.length === 0) {
      return Response.json({
        success: false,
        error: "Failed to generate insights. Please try again.",
      });
    }

    const now = Math.floor(Date.now() / 1000);

    // Create a new generation record (keeps history!)
    const [generation] = await db.insert(insightGenerations).values({
      subreddit: subredditFilter,
      periodDays,
      contentAnalyzed: recentContent.length,
      insightCount: result.insights.length,
      generatedAt: now,
    }).returning();

    // Insert new insights linked to this generation
    for (const insight of result.insights) {
      await db.insert(insights).values({
        generationId: generation.id,
        type: insight.type,
        title: insight.title,
        description: insight.description,
        evidence: JSON.stringify(insight.evidence),
        priority: insight.priority,
        subreddit: subredditFilter,
        generatedAt: now,
      });
    }

    // Count by type for response
    const counts = {
      pain_points: result.insights.filter((i) => i.type === "pain_point").length,
      feature_requests: result.insights.filter((i) => i.type === "feature_request").length,
      opportunities: result.insights.filter((i) => i.type === "opportunity").length,
      highlights: result.insights.filter((i) => i.type === "highlight").length,
      trends: result.insights.filter((i) => i.type === "trend").length,
    };

    return Response.json({
      success: true,
      message: `Generated ${result.insights.length} insights`,
      generationId: generation.id,
      subreddit: subredditFilter,
      counts,
      contentAnalyzed: recentContent.length,
      periodDays,
      generatedAt: now,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Insights generation error:", error);
    return Response.json(
      { error: "Failed to generate insights", details: String(error) },
      { status: 500 }
    );
  }
};

export const GET: APIRoute = async () => {
  return Response.json({
    message: "POST to this endpoint to generate community insights",
    description: "Analyzes recent content and generates actionable insights for DevRel/Community Managers",
    options: {
      subreddit: "Filter to specific subreddit (optional, null = all)",
      periodDays: "Number of days of content to analyze (default: 14)",
    },
    examples: {
      allSubreddits: {
        description: "Generate insights from all subreddits",
        body: {},
      },
      webflowOnly: {
        description: "Generate insights from r/webflow only",
        body: { subreddit: "webflow" },
      },
      lastWeek: {
        description: "Generate insights from last 7 days",
        body: { periodDays: 7 },
      },
    },
  });
};
