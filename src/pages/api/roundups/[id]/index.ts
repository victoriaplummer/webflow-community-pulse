// Single roundup API - Get, update, delete roundup
import type { APIRoute } from "astro";
import { getDb } from "../../../../db/getDb";
import { roundups, roundupItems, contentItems, authors } from "../../../../db/schema";
import { eq, desc } from "drizzle-orm";

// GET - Get single roundup with all items
export const GET: APIRoute = async ({ locals, params }) => {
  const db = getDb(locals);
  const roundupId = parseInt(params.id || "", 10);

  if (isNaN(roundupId)) {
    return Response.json({ error: "Invalid roundup ID" }, { status: 400 });
  }

  try {
    // Get the roundup
    const [roundup] = await db
      .select()
      .from(roundups)
      .where(eq(roundups.id, roundupId))
      .limit(1);

    if (!roundup) {
      return Response.json({ error: "Roundup not found" }, { status: 404 });
    }

    // Get items with content details
    const items = await db
      .select({
        id: roundupItems.id,
        section: roundupItems.section,
        pullQuote: roundupItems.pullQuote,
        note: roundupItems.note,
        displayOrder: roundupItems.displayOrder,
        contentId: contentItems.id,
        title: contentItems.title,
        body: contentItems.body,
        summary: contentItems.summary,
        url: contentItems.url,
        subreddit: contentItems.subreddit,
        flair: contentItems.flair,
        classification: contentItems.classification,
        topic: contentItems.topic,
        qualityScore: contentItems.qualityScore,
        engagementScore: contentItems.engagementScore,
        createdAt: contentItems.createdAt,
        authorUsername: authors.username,
      })
      .from(roundupItems)
      .innerJoin(contentItems, eq(roundupItems.contentId, contentItems.id))
      .leftJoin(authors, eq(contentItems.authorId, authors.id))
      .where(eq(roundupItems.roundupId, roundupId))
      .orderBy(roundupItems.section, roundupItems.displayOrder);

    return Response.json({
      roundup,
      items,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get roundup error:", error);
    return Response.json(
      { error: "Failed to get roundup", details: String(error) },
      { status: 500 }
    );
  }
};

// PUT - Update roundup
export const PUT: APIRoute = async ({ locals, params, request }) => {
  const db = getDb(locals);
  const user = locals.user;
  const roundupId = parseInt(params.id || "", 10);

  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  if (isNaN(roundupId)) {
    return Response.json({ error: "Invalid roundup ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { title, status, content } = body;

    const updateData: Record<string, unknown> = {
      updatedAt: Math.floor(Date.now() / 1000),
    };

    if (title !== undefined) updateData.title = title;
    if (status !== undefined) updateData.status = status;
    if (content !== undefined) updateData.content = content;

    const [updated] = await db
      .update(roundups)
      .set(updateData)
      .where(eq(roundups.id, roundupId))
      .returning();

    if (!updated) {
      return Response.json({ error: "Roundup not found" }, { status: 404 });
    }

    return Response.json({
      success: true,
      roundup: updated,
    });
  } catch (error) {
    console.error("Update roundup error:", error);
    return Response.json(
      { error: "Failed to update roundup", details: String(error) },
      { status: 500 }
    );
  }
};

// DELETE - Delete roundup and its items
export const DELETE: APIRoute = async ({ locals, params }) => {
  const db = getDb(locals);
  const user = locals.user;
  const roundupId = parseInt(params.id || "", 10);

  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  if (isNaN(roundupId)) {
    return Response.json({ error: "Invalid roundup ID" }, { status: 400 });
  }

  try {
    // Delete items first (foreign key constraint)
    await db
      .delete(roundupItems)
      .where(eq(roundupItems.roundupId, roundupId));

    // Delete the roundup
    const [deleted] = await db
      .delete(roundups)
      .where(eq(roundups.id, roundupId))
      .returning();

    if (!deleted) {
      return Response.json({ error: "Roundup not found" }, { status: 404 });
    }

    return Response.json({
      success: true,
      message: `Roundup ${roundupId} deleted`,
    });
  } catch (error) {
    console.error("Delete roundup error:", error);
    return Response.json(
      { error: "Failed to delete roundup", details: String(error) },
      { status: 500 }
    );
  }
};
