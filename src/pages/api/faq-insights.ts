// FAQ Insights API - Aggregates question patterns to identify resource opportunities
import type { APIRoute } from "astro";
import { getDb } from "../../db/getDb";
import { contentItems } from "../../db/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";

export const GET: APIRoute = async ({ locals, url }) => {
  const db = getDb(locals);

  // Get time range from query params (default: 30 days)
  const days = parseInt(url.searchParams.get("days") || "30");
  const subredditFilter = url.searchParams.get("subreddit");
  const cutoffTime = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

  // Build base conditions
  const baseConditions = [gte(contentItems.createdAt, cutoffTime)];
  if (subredditFilter) {
    baseConditions.push(eq(contentItems.subreddit, subredditFilter));
  }

  try {
    // Get FAQ candidates grouped by category
    const faqConditions = [...baseConditions, eq(contentItems.isFaqCandidate, true)];
    const faqByCategory = await db
      .select({
        category: contentItems.questionCategory,
        count: sql<number>`count(*)`.as("count"),
        avgQuality: sql<number>`avg(${contentItems.qualityScore})`.as("avg_quality"),
      })
      .from(contentItems)
      .where(and(...faqConditions))
      .groupBy(contentItems.questionCategory)
      .orderBy(desc(sql`count(*)`));

    // Get all question categories (not just FAQ candidates)
    const questionConditions = [...baseConditions, eq(contentItems.isQuestion, true)];
    const allQuestionsByCategory = await db
      .select({
        category: contentItems.questionCategory,
        total: sql<number>`count(*)`.as("total"),
        faqCount: sql<number>`sum(case when ${contentItems.isFaqCandidate} = 1 then 1 else 0 end)`.as("faq_count"),
      })
      .from(contentItems)
      .where(and(...questionConditions))
      .groupBy(contentItems.questionCategory)
      .orderBy(desc(sql`count(*)`));

    // Get recent FAQ candidate posts with suggested resources
    const recentFaqCandidates = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
        summary: contentItems.summary,
        url: contentItems.url,
        questionCategory: contentItems.questionCategory,
        suggestedResource: contentItems.suggestedResource,
        qualityScore: contentItems.qualityScore,
        engagementScore: contentItems.engagementScore,
        createdAt: contentItems.createdAt,
      })
      .from(contentItems)
      .where(and(...faqConditions))
      .orderBy(desc(contentItems.createdAt))
      .limit(50);

    // Get high-quality non-FAQ posts (these are the valuable discussions to keep)
    const highValueConditions = [...baseConditions, eq(contentItems.isFaqCandidate, false), gte(contentItems.qualityScore, 7)];
    const highValuePosts = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
        summary: contentItems.summary,
        url: contentItems.url,
        classification: contentItems.classification,
        qualityScore: contentItems.qualityScore,
        engagementScore: contentItems.engagementScore,
        createdAt: contentItems.createdAt,
      })
      .from(contentItems)
      .where(and(...highValueConditions))
      .orderBy(desc(contentItems.qualityScore))
      .limit(20);

    // Aggregate suggested resources
    const resourceConditions = [...faqConditions, sql`${contentItems.suggestedResource} IS NOT NULL`];
    const resourceSuggestions = await db
      .select({
        suggestedResource: contentItems.suggestedResource,
        count: sql<number>`count(*)`.as("count"),
        category: contentItems.questionCategory,
      })
      .from(contentItems)
      .where(and(...resourceConditions))
      .groupBy(contentItems.suggestedResource, contentItems.questionCategory)
      .orderBy(desc(sql`count(*)`))
      .limit(20);

    // Calculate summary stats
    const totalQuestions = allQuestionsByCategory.reduce((sum, cat) => sum + cat.total, 0);
    const totalFaqCandidates = allQuestionsByCategory.reduce((sum, cat) => sum + (cat.faqCount || 0), 0);
    const faqPercentage = totalQuestions > 0 ? Math.round((totalFaqCandidates / totalQuestions) * 100) : 0;

    // Group FAQ candidates by category for accordion display
    const faqPostsByCategory: Record<string, typeof recentFaqCandidates> = {};
    for (const post of recentFaqCandidates) {
      const category = post.questionCategory || "other";
      if (!faqPostsByCategory[category]) {
        faqPostsByCategory[category] = [];
      }
      faqPostsByCategory[category].push(post);
    }

    // Group FAQ candidates by suggested resource for accordion display
    const faqPostsByResource: Record<string, typeof recentFaqCandidates> = {};
    for (const post of recentFaqCandidates) {
      if (post.suggestedResource) {
        if (!faqPostsByResource[post.suggestedResource]) {
          faqPostsByResource[post.suggestedResource] = [];
        }
        faqPostsByResource[post.suggestedResource].push(post);
      }
    }

    return Response.json({
      summary: {
        totalQuestions,
        totalFaqCandidates,
        faqPercentage,
        timeRange: `${days} days`,
        message: `${faqPercentage}% of questions could be answered with better resources`,
      },
      faqByCategory: faqByCategory.filter(c => c.category), // Filter out nulls
      allQuestionsByCategory: allQuestionsByCategory.filter(c => c.category),
      recentFaqCandidates,
      faqPostsByCategory,
      faqPostsByResource,
      highValuePosts,
      resourceSuggestions: resourceSuggestions.filter(r => r.suggestedResource),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("FAQ insights error:", error);
    return Response.json(
      { error: "Failed to get FAQ insights", details: String(error) },
      { status: 500 }
    );
  }
};
