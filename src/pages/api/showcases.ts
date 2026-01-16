// Showcase API - Returns high-quality Show and Tell posts
import type { APIRoute } from "astro";
import { getDb } from "../../db/getDb";
import { contentItems, authors } from "../../db/schema";
import { eq, desc, and, gte } from "drizzle-orm";

export const GET: APIRoute = async ({ locals, url }) => {
  const db = getDb(locals);

  // Get time range from query params (default: 30 days)
  const days = parseInt(url.searchParams.get("days") || "30");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const subredditFilter = url.searchParams.get("subreddit");
  const cutoffTime = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

  // Build conditions
  const conditions = [
    eq(contentItems.isShowcase, true),
    eq(contentItems.isQuestion, false),
    gte(contentItems.createdAt, cutoffTime),
  ];
  if (subredditFilter) {
    conditions.push(eq(contentItems.subreddit, subredditFilter));
  }

  try {
    // Get showcase posts with author info
    // Filter: isShowcase=true, isQuestion=false, flair contains "Show"
    const showcases = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
        summary: contentItems.summary,
        url: contentItems.url,
        showcaseUrl: contentItems.showcaseUrl,
        flair: contentItems.flair,
        qualityScore: contentItems.qualityScore,
        engagementScore: contentItems.engagementScore,
        sentiment: contentItems.sentiment,
        createdAt: contentItems.createdAt,
        authorUsername: authors.username,
        isQuestion: contentItems.isQuestion,
        isRoundupCandidate: contentItems.isRoundupCandidate,
      })
      .from(contentItems)
      .leftJoin(authors, eq(contentItems.authorId, authors.id))
      .where(and(...conditions))
      .orderBy(desc(contentItems.qualityScore), desc(contentItems.engagementScore))
      .limit(limit * 2); // Fetch extra to filter

    // Additional filtering: exclude posts with question marks in title or help-seeking language
    const filteredShowcases = showcases.filter((s) => {
      const title = (s.title || "").toLowerCase();
      // Exclude if title has question mark or help-seeking words
      if (title.includes("?")) return false;
      if (title.includes("help")) return false;
      if (title.includes("issue")) return false;
      if (title.includes("problem")) return false;
      if (title.includes("how to")) return false;
      if (title.includes("how do")) return false;
      if (title.includes("can't")) return false;
      if (title.includes("doesn't work")) return false;
      if (title.includes("not working")) return false;
      // Prefer posts with "Show and Tell" flair
      const flair = (s.flair || "").toLowerCase();
      if (flair && !flair.includes("show")) return false;
      return true;
    }).slice(0, limit);

    // Get showcase stats (use filtered list)
    const totalShowcases = filteredShowcases.length;
    const avgQuality = filteredShowcases.length > 0
      ? filteredShowcases.reduce((sum, s) => sum + (s.qualityScore || 0), 0) / filteredShowcases.length
      : 0;

    return Response.json({
      showcases: filteredShowcases,
      stats: {
        total: totalShowcases,
        avgQuality: Math.round(avgQuality * 10) / 10,
        timeRange: `${days} days`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Showcases error:", error);
    return Response.json(
      { error: "Failed to get showcases", details: String(error) },
      { status: 500 }
    );
  }
};

// DELETE - Remove a post from showcases (set isShowcase = false)
export const DELETE: APIRoute = async ({ locals, request }) => {
  const db = getDb(locals);
  const user = locals.user;

  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id || typeof id !== "number") {
      return Response.json({ error: "Post ID required" }, { status: 400 });
    }

    // Update the post to no longer be a showcase
    await db
      .update(contentItems)
      .set({ isShowcase: false })
      .where(eq(contentItems.id, id));

    return Response.json({
      success: true,
      message: `Post ${id} removed from showcases`,
    });
  } catch (error) {
    console.error("Delete showcase error:", error);
    return Response.json(
      { error: "Failed to remove showcase", details: String(error) },
      { status: 500 }
    );
  }
};
