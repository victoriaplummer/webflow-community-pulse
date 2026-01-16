import type { APIRoute } from "astro";
import { getDb } from "../../db/getDb";
import { summaries, contentItems, authors } from "../../db/schema";
import { desc, eq, gte, and, sql } from "drizzle-orm";
import { generateSummary } from "../../lib/claude";

// GET - Fetch latest summary or summary by type
export const GET: APIRoute = async ({ locals, url }) => {
  const db = getDb(locals);

  const type = url.searchParams.get("type") || "daily"; // daily | weekly
  const latest = url.searchParams.get("latest") !== "false";

  try {
    if (latest) {
      const summary = await db
        .select()
        .from(summaries)
        .where(eq(summaries.summaryType, type))
        .orderBy(desc(summaries.generatedAt))
        .limit(1);

      if (summary.length === 0) {
        return Response.json(
          { error: "No summary found", type },
          { status: 404 }
        );
      }

      return Response.json({
        summary: {
          ...summary[0],
          content: JSON.parse(summary[0].content),
        },
      });
    }

    // Get all summaries of type
    const allSummaries = await db
      .select()
      .from(summaries)
      .where(eq(summaries.summaryType, type))
      .orderBy(desc(summaries.generatedAt))
      .limit(10);

    return Response.json({
      summaries: allSummaries.map((s) => ({
        ...s,
        content: JSON.parse(s.content),
      })),
    });
  } catch (error) {
    console.error("Summary fetch error:", error);
    return Response.json(
      { error: "Failed to fetch summary", details: String(error) },
      { status: 500 }
    );
  }
};

// POST - Generate new summary
export const POST: APIRoute = async ({ locals, request }) => {
  const db = getDb(locals);
  const env = locals.runtime.env;

  const anthropicKey = env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const type = body.type || "daily";
    const now = Math.floor(Date.now() / 1000);

    // Calculate period
    let periodStart: number;
    if (type === "weekly") {
      periodStart = now - 7 * 24 * 60 * 60;
    } else {
      periodStart = now - 24 * 60 * 60;
    }

    // Fetch content from period
    const items = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
        body: contentItems.body,
        url: contentItems.url,
        subreddit: contentItems.subreddit,
        sentiment: contentItems.sentiment,
        classification: contentItems.classification,
        engagementScore: contentItems.engagementScore,
        authorId: contentItems.authorId,
        authorUsername: authors.username,
      })
      .from(contentItems)
      .leftJoin(authors, eq(contentItems.authorId, authors.id))
      .where(
        and(
          gte(contentItems.createdAt, periodStart),
          eq(contentItems.isWebflowRelated, true)
        )
      )
      .orderBy(desc(contentItems.engagementScore))
      .limit(100);

    if (items.length === 0) {
      return Response.json(
        { error: "No content found for period" },
        { status: 400 }
      );
    }

    // Generate summary with Claude
    const summaryContent = await generateSummary(
      anthropicKey,
      items.map((item) => ({
        title: item.title,
        body: item.body,
        url: item.url,
        subreddit: item.subreddit,
        sentiment: item.sentiment,
        classification: item.classification,
        authorUsername: item.authorUsername || undefined,
      }))
    );

    // Calculate additional stats
    const stats = {
      totalItems: items.length,
      sentimentBreakdown: {
        positive: items.filter((i) => i.sentiment === "positive").length,
        neutral: items.filter((i) => i.sentiment === "neutral").length,
        negative: items.filter((i) => i.sentiment === "negative").length,
      },
      classificationBreakdown: {
        thought_leadership: items.filter(
          (i) => i.classification === "thought_leadership"
        ).length,
        resource: items.filter((i) => i.classification === "resource").length,
        discussion: items.filter((i) => i.classification === "discussion")
          .length,
        spam: items.filter((i) => i.classification === "spam").length,
        self_promo: items.filter((i) => i.classification === "self_promo")
          .length,
        low_effort: items.filter((i) => i.classification === "low_effort")
          .length,
      },
      topSubreddits: Object.entries(
        items.reduce(
          (acc, item) => {
            const sub = item.subreddit || "unknown";
            acc[sub] = (acc[sub] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        )
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    };

    // Store summary
    const fullContent = {
      ...summaryContent,
      stats,
      periodStart,
      periodEnd: now,
    };

    const newSummary = await db
      .insert(summaries)
      .values({
        periodStart,
        periodEnd: now,
        summaryType: type,
        content: JSON.stringify(fullContent),
        generatedAt: now,
      })
      .returning();

    return Response.json({
      success: true,
      summary: {
        ...newSummary[0],
        content: fullContent,
      },
    });
  } catch (error) {
    console.error("Summary generation error:", error);
    return Response.json(
      { error: "Failed to generate summary", details: String(error) },
      { status: 500 }
    );
  }
};
