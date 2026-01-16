// Re-analyze posts that weren't fully analyzed
import type { APIRoute } from "astro";
import { getDb } from "../../db/getDb";
import { contentItems } from "../../db/schema";
import { analyzeContent } from "../../lib/claude";
import { eq, and, or, isNull, lte } from "drizzle-orm";

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
    limit?: number;
    subreddit?: string;
    forceAll?: boolean; // Re-analyze all posts, even if already analyzed
  } = {};

  try {
    const body = await request.json();
    options = { ...options, ...body };
  } catch {
    // Use defaults
  }

  const limit = Math.min(options.limit || 50, 100);

  try {
    // Find posts that need re-analysis:
    // - Low confidence scores (< 0.5)
    // - NULL sentiment/classification
    // - Default values with no summary
    const conditions = [];

    if (options.subreddit) {
      conditions.push(eq(contentItems.subreddit, options.subreddit));
    }

    if (!options.forceAll) {
      // Only get posts that appear unanalyzed (have default values from backfill)
      // Default values set during backfill:
      // - sentimentConfidence: 0.5, classificationConfidence: 0.5
      // - topic: "general", classification: "discussion", sentiment: "neutral"
      // - summary: "", audienceRelevance: 5
      conditions.push(
        or(
          // Low/default confidence (backfill sets 0.5)
          lte(contentItems.sentimentConfidence, 0.5),
          lte(contentItems.classificationConfidence, 0.5),
          // Missing data
          isNull(contentItems.sentiment),
          isNull(contentItems.classification),
          isNull(contentItems.summary),
          // Empty summary (backfill sets empty string)
          eq(contentItems.summary, ""),
          // Default values combo (wasn't analyzed)
          and(
            eq(contentItems.topic, "general"),
            eq(contentItems.classification, "discussion")
          )
        )
      );
    }

    const postsToAnalyze = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
        body: contentItems.body,
        subreddit: contentItems.subreddit,
        flair: contentItems.flair,
      })
      .from(contentItems)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(limit);

    if (postsToAnalyze.length === 0) {
      return Response.json({
        success: true,
        message: "No posts need re-analysis",
        analyzed: 0,
      });
    }

    const results = {
      analyzed: 0,
      errors: 0,
    };

    for (const post of postsToAnalyze) {
      try {
        const analysis = await analyzeContent(anthropicKey, {
          title: post.title,
          body: post.body || "(link post)",
          subreddit: post.subreddit,
          flair: post.flair,
        });

        await db
          .update(contentItems)
          .set({
            sentiment: analysis.sentiment,
            sentimentConfidence: analysis.sentimentConfidence,
            classification: analysis.classification,
            classificationConfidence: analysis.classificationConfidence,
            topic: analysis.topic,
            keywords: JSON.stringify(analysis.keywords),
            isWebflowRelated: analysis.isWebflowRelated,
            needsReview: analysis.needsReview,
            summary: analysis.summary,
            qualityScore: analysis.qualityScore,
            isQuestion: analysis.isQuestion,
            questionCategory: analysis.questionCategory,
            isFaqCandidate: analysis.isFaqCandidate,
            suggestedResource: analysis.suggestedResource,
            isShowcase: analysis.isShowcase,
            showcaseUrl: analysis.showcaseUrl,
            mentionsWebflow: analysis.mentionsWebflow,
            mentionedTools: JSON.stringify(analysis.mentionedTools),
            audienceRelevance: analysis.audienceRelevance,
          })
          .where(eq(contentItems.id, post.id));

        results.analyzed++;

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error analyzing post ${post.id}:`, error);
        results.errors++;
      }
    }

    return Response.json({
      success: true,
      message: `Re-analyzed ${results.analyzed} posts`,
      ...results,
      foundPosts: postsToAnalyze.length,
    });
  } catch (error) {
    console.error("Re-analyze error:", error);
    return Response.json(
      { error: "Re-analysis failed", details: String(error) },
      { status: 500 }
    );
  }
};

export const GET: APIRoute = async () => {
  return Response.json({
    message: "POST to this endpoint to re-analyze posts that weren't fully analyzed",
    options: {
      limit: "Maximum posts to analyze (default: 50, max: 100)",
      subreddit: "Filter to specific subreddit (optional)",
      forceAll: "If true, re-analyze ALL posts regardless of current state (default: false)",
    },
    examples: {
      reanalyzeWebdev: {
        description: "Re-analyze unanalyzed r/webdev posts",
        body: {
          subreddit: "webdev",
          limit: 50,
        },
      },
      forceReanalyze: {
        description: "Force re-analyze all posts in a subreddit",
        body: {
          subreddit: "webdev",
          limit: 25,
          forceAll: true,
        },
      },
    },
  });
};
