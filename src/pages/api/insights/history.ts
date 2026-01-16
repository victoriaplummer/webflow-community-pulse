import type { APIRoute } from "astro";
import { getDb } from "../../../db/getDb";
import { insights, insightGenerations, contentItems, authors } from "../../../db/schema";
import { desc, eq, and, inArray } from "drizzle-orm";

export const GET: APIRoute = async ({ locals, url }) => {
  const db = getDb(locals);

  // Get optional filters
  const subredditFilter = url.searchParams.get("subreddit");
  const generationId = url.searchParams.get("generationId");
  const limit = parseInt(url.searchParams.get("limit") || "20");

  try {
    // If generationId is provided, return that specific generation with its insights
    if (generationId) {
      const generation = await db
        .select()
        .from(insightGenerations)
        .where(eq(insightGenerations.id, parseInt(generationId)))
        .limit(1);

      if (generation.length === 0) {
        return Response.json({ error: "Generation not found" }, { status: 404 });
      }

      const generationInsights = await db
        .select()
        .from(insights)
        .where(eq(insights.generationId, parseInt(generationId)))
        .orderBy(
          desc(
            // Order by priority: high > medium > low
            eq(insights.priority, "high")
          ),
          insights.type
        );

      // Parse evidence IDs and fetch content details for each insight
      const parsedInsights = await Promise.all(
        generationInsights.map(async (insight) => {
          const evidenceIds = JSON.parse(insight.evidence || "[]") as number[];

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
        pain_points: parsedInsights.filter((i) => i.type === "pain_point"),
        feature_requests: parsedInsights.filter((i) => i.type === "feature_request"),
        opportunities: parsedInsights.filter((i) => i.type === "opportunity"),
        highlights: parsedInsights.filter((i) => i.type === "highlight"),
        trends: parsedInsights.filter((i) => i.type === "trend"),
      };

      return Response.json({
        generation: generation[0],
        insights: parsedInsights,
        grouped,
        counts: {
          pain_points: grouped.pain_points.length,
          feature_requests: grouped.feature_requests.length,
          opportunities: grouped.opportunities.length,
          highlights: grouped.highlights.length,
          trends: grouped.trends.length,
        },
      });
    }

    // Otherwise, list all generations
    const conditions = [];
    if (subredditFilter) {
      if (subredditFilter === "all") {
        // "all" means generations that analyzed all subreddits (subreddit is null)
        conditions.push(eq(insightGenerations.subreddit, null as unknown as string));
      } else {
        conditions.push(eq(insightGenerations.subreddit, subredditFilter));
      }
    }

    const generations = await db
      .select()
      .from(insightGenerations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(insightGenerations.generatedAt))
      .limit(limit);

    // Get available subreddits that have generations
    const subredditsWithGenerations = await db
      .selectDistinct({ subreddit: insightGenerations.subreddit })
      .from(insightGenerations)
      .orderBy(insightGenerations.subreddit);

    return Response.json({
      generations: generations.map((gen) => ({
        ...gen,
        generatedAtFormatted: new Date(gen.generatedAt * 1000).toLocaleString(),
      })),
      availableSubreddits: [
        { value: "", label: "All Generations" },
        { value: "all", label: "Cross-subreddit (all)" },
        ...subredditsWithGenerations
          .filter((s) => s.subreddit)
          .map((s) => ({
            value: s.subreddit,
            label: `r/${s.subreddit}`,
          })),
      ],
      selectedSubreddit: subredditFilter || null,
      total: generations.length,
    });
  } catch (error) {
    console.error("Insights history error:", error);
    return Response.json(
      { error: "Failed to fetch insights history", details: String(error) },
      { status: 500 }
    );
  }
};
