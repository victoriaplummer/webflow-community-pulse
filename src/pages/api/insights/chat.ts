// Chat endpoint for insights - ask questions about community data
// Uses tool-based approach so Claude can query the database as needed
import type { APIRoute } from "astro";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "../../../db/getDb";
import { contentItems, authors, insights } from "../../../db/schema";
import { desc, gte, lte, eq, sql, like, and, or, asc } from "drizzle-orm";

// Define the tools Claude can use to query the database
const tools: Anthropic.Tool[] = [
  {
    name: "get_overview_stats",
    description: "Get high-level statistics about the community data including total posts, questions, showcases, sentiment breakdown, and classification breakdown. Always call this first to understand the data scope.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Number of days to look back for time-based stats. Default 30.",
        },
      },
      required: [],
    },
  },
  {
    name: "search_posts",
    description: "Search posts by keyword in title or body. Use this to find posts about specific topics.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query to find in post titles or body",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return. Default 20, max 100.",
        },
        sentiment: {
          type: "string",
          enum: ["positive", "neutral", "negative"],
          description: "Filter by sentiment",
        },
        classification: {
          type: "string",
          enum: ["spam", "self_promo", "low_effort", "discussion", "resource", "thought_leadership"],
          description: "Filter by classification type",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_posts_by_category",
    description: "Get posts filtered by question category (e.g., 'cms', 'animations', 'custom_code', 'seo', 'ecommerce'). Useful for understanding what people ask about specific topics.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          description: "Question category to filter by (e.g., 'cms', 'animations', 'custom_code', 'seo', 'ecommerce', 'hosting', 'pricing', 'design', 'integrations', 'troubleshooting')",
        },
        limit: {
          type: "number",
          description: "Maximum number of results. Default 20, max 100.",
        },
        include_body: {
          type: "boolean",
          description: "Whether to include full post body (can be long). Default false.",
        },
      },
      required: ["category"],
    },
  },
  {
    name: "get_pain_points",
    description: "Get posts with negative sentiment - these represent user frustrations, complaints, and pain points. Essential for understanding what's not working.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of results. Default 30, max 100.",
        },
        days: {
          type: "number",
          description: "Look back period in days. Default all time.",
        },
        include_body: {
          type: "boolean",
          description: "Whether to include full post body. Default false.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_faq_candidates",
    description: "Get posts identified as FAQ candidates - repetitive questions that could be answered with documentation or resources. Useful for identifying content gaps.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of results. Default 30, max 100.",
        },
        category: {
          type: "string",
          description: "Optional: filter by question category",
        },
      },
      required: [],
    },
  },
  {
    name: "get_showcases",
    description: "Get community showcase posts - projects people are sharing. Useful for finding community highlights and inspirational content.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of results. Default 20.",
        },
        min_quality: {
          type: "number",
          description: "Minimum quality score (1-10). Default 0.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_top_contributors",
    description: "Get information about top community contributors based on post count and quality contributions.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Number of contributors to return. Default 10.",
        },
        sort_by: {
          type: "string",
          enum: ["score", "posts", "quality"],
          description: "How to sort: 'score' (contributor score), 'posts' (post count), 'quality' (high quality count). Default 'score'.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_trending_topics",
    description: "Get breakdown of question categories and classifications to understand what topics are trending.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Look back period in days. Default 14.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_recent_posts",
    description: "Get the most recent posts. Use this to see what's happening now in the community.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Number of posts to return. Default 20, max 50.",
        },
        include_body: {
          type: "boolean",
          description: "Whether to include full post body. Default false.",
        },
        only_questions: {
          type: "boolean",
          description: "Only return posts that are questions. Default false.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_high_engagement_posts",
    description: "Get posts with highest engagement scores. These are the most discussed/popular posts.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Number of posts to return. Default 15.",
        },
        days: {
          type: "number",
          description: "Look back period in days. Default 30.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_content_strategy_data",
    description: "Get comprehensive data for making moderation and content strategy decisions. Returns posts grouped by classification with engagement metrics, identifies consolidation opportunities (e.g., weekly megathreads), and highlights content patterns. Use this when asked about reducing clutter, creating megathreads, or improving community organization.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Look back period in days. Default 30.",
        },
        subreddit: {
          type: "string",
          description: "Filter to specific subreddit. Default all.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_subreddit_comparison",
    description: "Compare content patterns across different subreddits. Useful for understanding how different communities discuss similar topics, or comparing Webflow discussions to competitor platforms.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Look back period in days. Default 30.",
        },
      },
      required: [],
    },
  },
];

// Tool execution functions
async function executeTools(db: ReturnType<typeof getDb>, toolName: string, toolInput: Record<string, unknown>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  switch (toolName) {
    case "get_overview_stats": {
      const days = (toolInput.days as number) || 30;
      const cutoff = now - days * 24 * 60 * 60;

      const [total, recent, questions, faqs, showcases, sentiments, classifications] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(contentItems),
        db.select({ count: sql<number>`count(*)` }).from(contentItems).where(gte(contentItems.createdAt, cutoff)),
        db.select({ count: sql<number>`count(*)` }).from(contentItems).where(eq(contentItems.isQuestion, true)),
        db.select({ count: sql<number>`count(*)` }).from(contentItems).where(eq(contentItems.isFaqCandidate, true)),
        db.select({ count: sql<number>`count(*)` }).from(contentItems).where(eq(contentItems.isShowcase, true)),
        db.select({ sentiment: contentItems.sentiment, count: sql<number>`count(*)` })
          .from(contentItems).where(gte(contentItems.createdAt, cutoff)).groupBy(contentItems.sentiment),
        db.select({ classification: contentItems.classification, count: sql<number>`count(*)` })
          .from(contentItems).where(gte(contentItems.createdAt, cutoff)).groupBy(contentItems.classification),
      ]);

      return JSON.stringify({
        total_posts: total[0]?.count || 0,
        posts_last_n_days: recent[0]?.count || 0,
        days_period: days,
        total_questions: questions[0]?.count || 0,
        faq_candidates: faqs[0]?.count || 0,
        showcases: showcases[0]?.count || 0,
        sentiment_breakdown: Object.fromEntries(sentiments.map(s => [s.sentiment || "unknown", s.count])),
        classification_breakdown: Object.fromEntries(classifications.map(c => [c.classification || "unknown", c.count])),
      }, null, 2);
    }

    case "search_posts": {
      const query = toolInput.query as string;
      const limit = Math.min((toolInput.limit as number) || 20, 100);
      const sentiment = toolInput.sentiment as string | undefined;
      const classification = toolInput.classification as string | undefined;

      const conditions = [
        or(
          like(contentItems.title, `%${query}%`),
          like(contentItems.body, `%${query}%`)
        ),
      ];
      if (sentiment) conditions.push(eq(contentItems.sentiment, sentiment));
      if (classification) conditions.push(eq(contentItems.classification, classification));

      const posts = await db.select({
        title: contentItems.title,
        summary: contentItems.summary,
        sentiment: contentItems.sentiment,
        classification: contentItems.classification,
        questionCategory: contentItems.questionCategory,
        qualityScore: contentItems.qualityScore,
        engagementScore: contentItems.engagementScore,
        isQuestion: contentItems.isQuestion,
        isFaqCandidate: contentItems.isFaqCandidate,
        createdAt: contentItems.createdAt,
      }).from(contentItems)
        .where(and(...conditions))
        .orderBy(desc(contentItems.engagementScore))
        .limit(limit);

      return JSON.stringify({ query, results_count: posts.length, posts }, null, 2);
    }

    case "get_posts_by_category": {
      const category = toolInput.category as string;
      const limit = Math.min((toolInput.limit as number) || 20, 100);
      const includeBody = toolInput.include_body as boolean;

      const posts = await db.select({
        title: contentItems.title,
        summary: contentItems.summary,
        body: includeBody ? contentItems.body : sql<string>`null`,
        sentiment: contentItems.sentiment,
        classification: contentItems.classification,
        suggestedResource: contentItems.suggestedResource,
        qualityScore: contentItems.qualityScore,
        engagementScore: contentItems.engagementScore,
        isFaqCandidate: contentItems.isFaqCandidate,
        createdAt: contentItems.createdAt,
      }).from(contentItems)
        .where(eq(contentItems.questionCategory, category))
        .orderBy(desc(contentItems.createdAt))
        .limit(limit);

      return JSON.stringify({ category, results_count: posts.length, posts }, null, 2);
    }

    case "get_pain_points": {
      const limit = Math.min((toolInput.limit as number) || 30, 100);
      const days = toolInput.days as number | undefined;
      const includeBody = toolInput.include_body as boolean;

      const conditions = [eq(contentItems.sentiment, "negative")];
      if (days) {
        conditions.push(gte(contentItems.createdAt, now - days * 24 * 60 * 60));
      }

      const posts = await db.select({
        title: contentItems.title,
        summary: contentItems.summary,
        body: includeBody ? contentItems.body : sql<string>`null`,
        questionCategory: contentItems.questionCategory,
        classification: contentItems.classification,
        engagementScore: contentItems.engagementScore,
        createdAt: contentItems.createdAt,
      }).from(contentItems)
        .where(and(...conditions))
        .orderBy(desc(contentItems.createdAt))
        .limit(limit);

      return JSON.stringify({ pain_points_count: posts.length, posts }, null, 2);
    }

    case "get_faq_candidates": {
      const limit = Math.min((toolInput.limit as number) || 30, 100);
      const category = toolInput.category as string | undefined;

      const conditions = [eq(contentItems.isFaqCandidate, true)];
      if (category) conditions.push(eq(contentItems.questionCategory, category));

      const posts = await db.select({
        title: contentItems.title,
        summary: contentItems.summary,
        questionCategory: contentItems.questionCategory,
        suggestedResource: contentItems.suggestedResource,
        engagementScore: contentItems.engagementScore,
        createdAt: contentItems.createdAt,
      }).from(contentItems)
        .where(and(...conditions))
        .orderBy(desc(contentItems.createdAt))
        .limit(limit);

      // Group by suggested resource
      const byResource: Record<string, number> = {};
      posts.forEach(p => {
        if (p.suggestedResource) {
          byResource[p.suggestedResource] = (byResource[p.suggestedResource] || 0) + 1;
        }
      });

      return JSON.stringify({
        faq_count: posts.length,
        top_resource_needs: Object.entries(byResource).sort((a, b) => b[1] - a[1]).slice(0, 10),
        posts,
      }, null, 2);
    }

    case "get_showcases": {
      const limit = Math.min((toolInput.limit as number) || 20, 50);
      const minQuality = (toolInput.min_quality as number) || 0;

      const conditions = [eq(contentItems.isShowcase, true)];
      if (minQuality > 0) conditions.push(gte(contentItems.qualityScore, minQuality));

      const posts = await db.select({
        title: contentItems.title,
        summary: contentItems.summary,
        showcaseUrl: contentItems.showcaseUrl,
        qualityScore: contentItems.qualityScore,
        engagementScore: contentItems.engagementScore,
        createdAt: contentItems.createdAt,
      }).from(contentItems)
        .where(and(...conditions))
        .orderBy(desc(contentItems.qualityScore))
        .limit(limit);

      return JSON.stringify({ showcase_count: posts.length, posts }, null, 2);
    }

    case "get_top_contributors": {
      const limit = Math.min((toolInput.limit as number) || 10, 30);
      const sortBy = (toolInput.sort_by as string) || "score";

      let orderByField;
      switch (sortBy) {
        case "posts": orderByField = desc(authors.postCount); break;
        case "quality": orderByField = desc(authors.highQualityCount); break;
        default: orderByField = desc(authors.contributorScore);
      }

      const contributors = await db.select({
        username: authors.username,
        postCount: authors.postCount,
        highQualityCount: authors.highQualityCount,
        contributorScore: authors.contributorScore,
        firstSeen: authors.firstSeen,
        lastSeen: authors.lastSeen,
      }).from(authors)
        .orderBy(orderByField)
        .limit(limit);

      return JSON.stringify({ contributors }, null, 2);
    }

    case "get_trending_topics": {
      const days = (toolInput.days as number) || 14;
      const cutoff = now - days * 24 * 60 * 60;

      const [categories, classifications] = await Promise.all([
        db.select({
          category: contentItems.questionCategory,
          count: sql<number>`count(*)`,
        }).from(contentItems)
          .where(and(gte(contentItems.createdAt, cutoff), eq(contentItems.isQuestion, true)))
          .groupBy(contentItems.questionCategory)
          .orderBy(desc(sql`count(*)`))
          .limit(15),
        db.select({
          classification: contentItems.classification,
          count: sql<number>`count(*)`,
        }).from(contentItems)
          .where(gte(contentItems.createdAt, cutoff))
          .groupBy(contentItems.classification)
          .orderBy(desc(sql`count(*)`)),
      ]);

      return JSON.stringify({
        period_days: days,
        question_categories: categories.filter(c => c.category),
        content_types: classifications.filter(c => c.classification),
      }, null, 2);
    }

    case "get_recent_posts": {
      const limit = Math.min((toolInput.limit as number) || 20, 50);
      const includeBody = toolInput.include_body as boolean;
      const onlyQuestions = toolInput.only_questions as boolean;

      const conditions = [];
      if (onlyQuestions) conditions.push(eq(contentItems.isQuestion, true));

      const posts = await db.select({
        title: contentItems.title,
        summary: contentItems.summary,
        body: includeBody ? contentItems.body : sql<string>`null`,
        sentiment: contentItems.sentiment,
        classification: contentItems.classification,
        questionCategory: contentItems.questionCategory,
        qualityScore: contentItems.qualityScore,
        engagementScore: contentItems.engagementScore,
        isQuestion: contentItems.isQuestion,
        isFaqCandidate: contentItems.isFaqCandidate,
        isShowcase: contentItems.isShowcase,
        createdAt: contentItems.createdAt,
      }).from(contentItems)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(contentItems.createdAt))
        .limit(limit);

      return JSON.stringify({ count: posts.length, posts }, null, 2);
    }

    case "get_high_engagement_posts": {
      const limit = Math.min((toolInput.limit as number) || 15, 50);
      const days = (toolInput.days as number) || 30;
      const cutoff = now - days * 24 * 60 * 60;

      const posts = await db.select({
        title: contentItems.title,
        summary: contentItems.summary,
        sentiment: contentItems.sentiment,
        classification: contentItems.classification,
        questionCategory: contentItems.questionCategory,
        engagementScore: contentItems.engagementScore,
        qualityScore: contentItems.qualityScore,
        createdAt: contentItems.createdAt,
      }).from(contentItems)
        .where(gte(contentItems.createdAt, cutoff))
        .orderBy(desc(contentItems.engagementScore))
        .limit(limit);

      return JSON.stringify({ period_days: days, count: posts.length, posts }, null, 2);
    }

    case "get_content_strategy_data": {
      const days = (toolInput.days as number) || 30;
      const subredditFilter = toolInput.subreddit as string | undefined;
      const cutoff = now - days * 24 * 60 * 60;

      const baseConditions = [gte(contentItems.createdAt, cutoff)];
      if (subredditFilter) {
        baseConditions.push(eq(contentItems.subreddit, subredditFilter));
      }

      // Get classification breakdown with metrics
      const classificationStats = await db.select({
        classification: contentItems.classification,
        count: sql<number>`count(*)`,
        avgEngagement: sql<number>`AVG(${contentItems.engagementScore})`,
        avgQuality: sql<number>`AVG(${contentItems.qualityScore})`,
        totalEngagement: sql<number>`SUM(${contentItems.engagementScore})`,
      }).from(contentItems)
        .where(and(...baseConditions))
        .groupBy(contentItems.classification)
        .orderBy(desc(sql`count(*)`));

      // Get weekly posting frequency by classification
      const weekAgo = now - 7 * 24 * 60 * 60;
      const weekConditions = [gte(contentItems.createdAt, weekAgo)];
      if (subredditFilter) {
        weekConditions.push(eq(contentItems.subreddit, subredditFilter));
      }

      const weeklyStats = await db.select({
        classification: contentItems.classification,
        count: sql<number>`count(*)`,
        avgEngagement: sql<number>`AVG(${contentItems.engagementScore})`,
      }).from(contentItems)
        .where(and(...weekConditions))
        .groupBy(contentItems.classification)
        .orderBy(desc(sql`count(*)`));

      // Get FAQ candidate volume by category
      const faqConditions = [...baseConditions, eq(contentItems.isFaqCandidate, true)];
      const faqByCategory = await db.select({
        category: contentItems.questionCategory,
        count: sql<number>`count(*)`,
      }).from(contentItems)
        .where(and(...faqConditions))
        .groupBy(contentItems.questionCategory)
        .orderBy(desc(sql`count(*)`))
        .limit(10);

      // Get low-engagement content (potential clutter)
      const clutterConditions = [...baseConditions, lte(contentItems.engagementScore, 5)];
      const lowEngagementByType = await db.select({
        classification: contentItems.classification,
        count: sql<number>`count(*)`,
        avgQuality: sql<number>`AVG(${contentItems.qualityScore})`,
      }).from(contentItems)
        .where(and(...clutterConditions))
        .groupBy(contentItems.classification)
        .orderBy(desc(sql`count(*)`));

      // Get sentiment breakdown
      const sentimentStats = await db.select({
        sentiment: contentItems.sentiment,
        count: sql<number>`count(*)`,
      }).from(contentItems)
        .where(and(...baseConditions))
        .groupBy(contentItems.sentiment);

      // Calculate consolidation opportunities
      const consolidationOpportunities: Record<string, string> = {};
      const weeklyMap = new Map(weeklyStats.map(w => [w.classification, w]));

      for (const stat of weeklyStats) {
        const weeklyCount = stat.count;
        const avgEng = stat.avgEngagement || 0;

        if (stat.classification === "self_promo" && weeklyCount >= 5) {
          consolidationOpportunities["self_promo"] = `${weeklyCount} self-promo posts/week with avg ${avgEng.toFixed(1)} engagement - consider weekly hiring/services thread`;
        }
        if (stat.classification === "feedback_request" && weeklyCount >= 5) {
          consolidationOpportunities["feedback_request"] = `${weeklyCount} feedback requests/week - consider weekly feedback thread`;
        }
        if (stat.classification === "showcase" && weeklyCount >= 10) {
          consolidationOpportunities["showcase"] = `${weeklyCount} showcases/week with avg ${avgEng.toFixed(1)} engagement - consider weekly showcase thread or keeping as-is (high engagement)`;
        }
        if (stat.classification === "question" && weeklyCount >= 20) {
          const faqCount = faqByCategory.reduce((sum, f) => sum + f.count, 0);
          consolidationOpportunities["questions"] = `${weeklyCount} questions/week, ${faqCount} are FAQ candidates - consider FAQ bot or pinned resources`;
        }
      }

      // Calculate total posts and engagement metrics
      const totalPosts = classificationStats.reduce((sum, c) => sum + c.count, 0);
      const totalEngagement = classificationStats.reduce((sum, c) => sum + (c.totalEngagement || 0), 0);
      const lowEngagementTotal = lowEngagementByType.reduce((sum, c) => sum + c.count, 0);
      const clutterPercentage = totalPosts > 0 ? ((lowEngagementTotal / totalPosts) * 100).toFixed(1) : "0";

      return JSON.stringify({
        period_days: days,
        subreddit: subredditFilter || "all",
        summary: {
          total_posts: totalPosts,
          total_engagement: totalEngagement,
          avg_engagement_per_post: totalPosts > 0 ? (totalEngagement / totalPosts).toFixed(1) : 0,
          low_engagement_posts: lowEngagementTotal,
          clutter_percentage: `${clutterPercentage}%`,
        },
        posts_by_classification: Object.fromEntries(
          classificationStats.map(c => [c.classification || "unknown", {
            count: c.count,
            avg_engagement: (c.avgEngagement || 0).toFixed(1),
            avg_quality: (c.avgQuality || 0).toFixed(1),
            pct_of_total: totalPosts > 0 ? ((c.count / totalPosts) * 100).toFixed(1) + "%" : "0%",
          }])
        ),
        weekly_volume: Object.fromEntries(
          weeklyStats.map(w => [w.classification || "unknown", {
            posts_this_week: w.count,
            avg_engagement: (w.avgEngagement || 0).toFixed(1),
          }])
        ),
        consolidation_opportunities: consolidationOpportunities,
        faq_candidates_by_category: Object.fromEntries(
          faqByCategory.filter(f => f.category).map(f => [f.category, f.count])
        ),
        low_engagement_breakdown: Object.fromEntries(
          lowEngagementByType.map(l => [l.classification || "unknown", {
            count: l.count,
            avg_quality: (l.avgQuality || 0).toFixed(1),
          }])
        ),
        sentiment_breakdown: Object.fromEntries(
          sentimentStats.map(s => [s.sentiment || "unknown", s.count])
        ),
      }, null, 2);
    }

    case "get_subreddit_comparison": {
      const days = (toolInput.days as number) || 30;
      const cutoff = now - days * 24 * 60 * 60;

      // Get stats by subreddit
      const subredditStats = await db.select({
        subreddit: contentItems.subreddit,
        count: sql<number>`count(*)`,
        avgEngagement: sql<number>`AVG(${contentItems.engagementScore})`,
        avgQuality: sql<number>`AVG(${contentItems.qualityScore})`,
        avgRelevance: sql<number>`AVG(${contentItems.audienceRelevance})`,
        webflowMentions: sql<number>`SUM(CASE WHEN ${contentItems.mentionsWebflow} = 1 THEN 1 ELSE 0 END)`,
      }).from(contentItems)
        .where(gte(contentItems.createdAt, cutoff))
        .groupBy(contentItems.subreddit)
        .orderBy(desc(sql`count(*)`));

      // Get classification breakdown per subreddit
      const classificationBySubreddit = await db.select({
        subreddit: contentItems.subreddit,
        classification: contentItems.classification,
        count: sql<number>`count(*)`,
      }).from(contentItems)
        .where(gte(contentItems.createdAt, cutoff))
        .groupBy(contentItems.subreddit, contentItems.classification)
        .orderBy(contentItems.subreddit, desc(sql`count(*)`));

      // Get topic breakdown per subreddit
      const topicBySubreddit = await db.select({
        subreddit: contentItems.subreddit,
        topic: contentItems.topic,
        count: sql<number>`count(*)`,
      }).from(contentItems)
        .where(gte(contentItems.createdAt, cutoff))
        .groupBy(contentItems.subreddit, contentItems.topic)
        .orderBy(contentItems.subreddit, desc(sql`count(*)`));

      // Get sentiment by subreddit
      const sentimentBySubreddit = await db.select({
        subreddit: contentItems.subreddit,
        sentiment: contentItems.sentiment,
        count: sql<number>`count(*)`,
      }).from(contentItems)
        .where(gte(contentItems.createdAt, cutoff))
        .groupBy(contentItems.subreddit, contentItems.sentiment);

      // Organize data by subreddit
      const subredditData: Record<string, {
        stats: { count: number; avgEngagement: string; avgQuality: string; avgRelevance: string; webflowMentions: number };
        classifications: Record<string, number>;
        topics: Record<string, number>;
        sentiment: Record<string, number>;
      }> = {};

      for (const stat of subredditStats) {
        const sub = stat.subreddit || "unknown";
        subredditData[sub] = {
          stats: {
            count: stat.count,
            avgEngagement: (stat.avgEngagement || 0).toFixed(1),
            avgQuality: (stat.avgQuality || 0).toFixed(1),
            avgRelevance: (stat.avgRelevance || 0).toFixed(1),
            webflowMentions: stat.webflowMentions || 0,
          },
          classifications: {},
          topics: {},
          sentiment: {},
        };
      }

      for (const row of classificationBySubreddit) {
        const sub = row.subreddit || "unknown";
        if (subredditData[sub]) {
          subredditData[sub].classifications[row.classification || "unknown"] = row.count;
        }
      }

      for (const row of topicBySubreddit) {
        const sub = row.subreddit || "unknown";
        if (subredditData[sub]) {
          subredditData[sub].topics[row.topic || "unknown"] = row.count;
        }
      }

      for (const row of sentimentBySubreddit) {
        const sub = row.subreddit || "unknown";
        if (subredditData[sub]) {
          subredditData[sub].sentiment[row.sentiment || "unknown"] = row.count;
        }
      }

      return JSON.stringify({
        period_days: days,
        subreddits: subredditData,
      }, null, 2);
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

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

  let body: { message: string; history?: Array<{ role: string; content: string }> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.message || typeof body.message !== "string") {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  const systemPrompt = `You are an AI assistant for a Community Pulse dashboard that monitors Reddit communities (r/webflow and related web dev subreddits). You help community managers and DevRel teams understand community sentiment, identify trends, and find opportunities to engage.

You have access to tools that let you query the community database. Use them to answer questions accurately:

1. **Always start with get_overview_stats** to understand the data scope
2. **Use specific tools** based on what the user asks:
   - Pain points/complaints → get_pain_points
   - FAQ/documentation needs → get_faq_candidates
   - Specific topics → search_posts or get_posts_by_category
   - Community highlights → get_showcases
   - Trending topics → get_trending_topics
   - Top members → get_top_contributors
   - Recent activity → get_recent_posts
   - Popular content → get_high_engagement_posts
   - **Moderation/strategy questions** → get_content_strategy_data (use this for questions about reducing clutter, weekly megathreads, consolidating post types, etc.)
   - **Cross-subreddit analysis** → get_subreddit_comparison (use this to compare patterns across r/webflow, r/webdev, r/framer, etc.)

3. **Go deeper when needed** - if initial results are interesting, query for more details
4. **Reference specific posts** when making points
5. **Be actionable** - suggest what the team could do based on findings
6. **For strategy questions**, use get_content_strategy_data to get concrete numbers on post volumes, engagement by type, and consolidation opportunities before making recommendations

Format your responses with clear markdown: use headers, bullet points, and bold for emphasis.`;

  try {
    const client = new Anthropic({ apiKey: anthropicKey });

    // Build message history
    const messages: Anthropic.MessageParam[] = [];
    if (body.history && Array.isArray(body.history)) {
      for (const msg of body.history.slice(-10)) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }
    messages.push({ role: "user", content: body.message });

    // Run agentic loop with tools
    let response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    });

    // Process tool calls in a loop
    const maxIterations = 10;
    let iterations = 0;

    while (response.stop_reason === "tool_use" && iterations < maxIterations) {
      iterations++;

      // Find tool use blocks
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      // Execute tools and build results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        const result = await executeTools(db, toolUse.name, toolUse.input as Record<string, unknown>);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // Continue conversation with tool results
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });

      response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages,
      });
    }

    // Extract final text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    const assistantMessage = textBlocks.map(b => b.text).join("\n");

    return Response.json({
      success: true,
      message: assistantMessage,
      tool_calls: iterations,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return Response.json(
      { error: "Failed to process chat", details: String(error) },
      { status: 500 }
    );
  }
};
