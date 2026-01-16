import type { APIRoute } from "astro";
import { getDb } from "../../db/getDb";
import { insights, contentItems, authors, insightGenerations } from "../../db/schema";
import { desc, eq, inArray, isNotNull } from "drizzle-orm";

export const GET: APIRoute = async ({ locals }) => {
  const db = getDb(locals);

  try {
    // Get the latest generation
    const latestGeneration = await db
      .select()
      .from(insightGenerations)
      .orderBy(desc(insightGenerations.generatedAt))
      .limit(1);

    if (latestGeneration.length === 0) {
      return Response.json({
        insights: [],
        generatedAt: null,
        message: "No insights generated yet. Click 'Generate Insights' to analyze recent content.",
      });
    }

    const generationId = latestGeneration[0].id;
    const generatedAt = latestGeneration[0].generatedAt;

    // Get insights for the latest generation only
    const allInsights = await db
      .select()
      .from(insights)
      .where(eq(insights.generationId, generationId))
      .orderBy(desc(insights.generatedAt));

    if (allInsights.length === 0) {
      return Response.json({
        insights: [],
        generatedAt: null,
        message: "No insights generated yet. Click 'Generate Insights' to analyze recent content.",
      });
    }

    // Parse evidence IDs and fetch content details for each insight
    const insightsWithEvidence = await Promise.all(
      allInsights.map(async (insight) => {
        const evidenceIds = JSON.parse(insight.evidence) as number[];

        // Fetch the actual content items for evidence
        let evidenceItems: Array<{
          id: number;
          title: string | null;
          url: string;
          authorUsername: string | null;
        }> = [];

        if (evidenceIds.length > 0) {
          evidenceItems = await db
            .select({
              id: contentItems.id,
              title: contentItems.title,
              url: contentItems.url,
              authorUsername: authors.username,
            })
            .from(contentItems)
            .leftJoin(authors, eq(contentItems.authorId, authors.id))
            .where(inArray(contentItems.id, evidenceIds));
        }

        return {
          id: insight.id,
          type: insight.type,
          title: insight.title,
          description: insight.description,
          priority: insight.priority,
          evidence: evidenceItems,
        };
      })
    );

    // Group insights by type
    const grouped = {
      pain_points: insightsWithEvidence.filter((i) => i.type === "pain_point"),
      feature_requests: insightsWithEvidence.filter((i) => i.type === "feature_request"),
      opportunities: insightsWithEvidence.filter((i) => i.type === "opportunity"),
      highlights: insightsWithEvidence.filter((i) => i.type === "highlight"),
      trends: insightsWithEvidence.filter((i) => i.type === "trend"),
    };

    // Count by priority
    const stats = {
      total: insightsWithEvidence.length,
      high: insightsWithEvidence.filter((i) => i.priority === "high").length,
      medium: insightsWithEvidence.filter((i) => i.priority === "medium").length,
      low: insightsWithEvidence.filter((i) => i.priority === "low").length,
    };

    return Response.json({
      insights: grouped,
      stats,
      generatedAt,
      generation: {
        id: latestGeneration[0].id,
        subreddit: latestGeneration[0].subreddit,
        periodDays: latestGeneration[0].periodDays,
        contentAnalyzed: latestGeneration[0].contentAnalyzed,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Insights fetch error:", error);
    return Response.json(
      { error: "Failed to fetch insights", details: String(error) },
      { status: 500 }
    );
  }
};
