// Roundup items API - Manage items in a roundup
import type { APIRoute } from "astro";
import { getDb } from "../../../../db/getDb";
import { roundupItems, contentItems, authors, roundups } from "../../../../db/schema";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";

// GET - Get suggested items for a roundup (starred + high quality in date range)
export const GET: APIRoute = async ({ locals, params, url }) => {
  const db = getDb(locals);
  const roundupId = parseInt(params.id || "", 10);

  if (isNaN(roundupId)) {
    return Response.json({ error: "Invalid roundup ID" }, { status: 400 });
  }

  try {
    // Get the roundup to know the date range
    const [roundup] = await db
      .select()
      .from(roundups)
      .where(eq(roundups.id, roundupId))
      .limit(1);

    if (!roundup) {
      return Response.json({ error: "Roundup not found" }, { status: 404 });
    }

    // Get IDs already in this roundup
    const existingIds = await db
      .select({ contentId: roundupItems.contentId })
      .from(roundupItems)
      .where(eq(roundupItems.roundupId, roundupId));

    const existingIdSet = new Set(existingIds.map((r) => r.contentId));

    // Get starred posts in date range
    const starredPosts = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
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
        isRoundupCandidate: contentItems.isRoundupCandidate,
      })
      .from(contentItems)
      .leftJoin(authors, eq(contentItems.authorId, authors.id))
      .where(
        and(
          eq(contentItems.isRoundupCandidate, true),
          gte(contentItems.createdAt, roundup.dateFrom),
          lte(contentItems.createdAt, roundup.dateTo)
        )
      )
      .orderBy(desc(contentItems.qualityScore));

    // Get high-quality posts in date range (auto-suggestions)
    const suggestedPosts = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
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
        isRoundupCandidate: contentItems.isRoundupCandidate,
      })
      .from(contentItems)
      .leftJoin(authors, eq(contentItems.authorId, authors.id))
      .where(
        and(
          gte(contentItems.createdAt, roundup.dateFrom),
          lte(contentItems.createdAt, roundup.dateTo),
          gte(contentItems.qualityScore, 7) // High quality
        )
      )
      .orderBy(desc(contentItems.engagementScore))
      .limit(30);

    // Filter out posts already in the roundup
    const availableStarred = starredPosts.filter((p) => !existingIdSet.has(p.id));
    const availableSuggested = suggestedPosts.filter(
      (p) => !existingIdSet.has(p.id) && !p.isRoundupCandidate
    );

    return Response.json({
      starred: availableStarred,
      suggested: availableSuggested,
      dateRange: {
        from: roundup.dateFrom,
        to: roundup.dateTo,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get suggested items error:", error);
    return Response.json(
      { error: "Failed to get suggested items", details: String(error) },
      { status: 500 }
    );
  }
};

// POST - Add item to roundup
export const POST: APIRoute = async ({ locals, params, request }) => {
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
    const { contentId, section = "highlight", pullQuote, note } = body;

    if (!contentId) {
      return Response.json({ error: "contentId is required" }, { status: 400 });
    }

    // Check if already in roundup
    const [existing] = await db
      .select()
      .from(roundupItems)
      .where(
        and(
          eq(roundupItems.roundupId, roundupId),
          eq(roundupItems.contentId, contentId)
        )
      )
      .limit(1);

    if (existing) {
      return Response.json({ error: "Item already in roundup" }, { status: 400 });
    }

    // Get max display order for this section
    const [maxOrder] = await db
      .select({ max: sql<number>`COALESCE(MAX(display_order), -1)` })
      .from(roundupItems)
      .where(
        and(
          eq(roundupItems.roundupId, roundupId),
          eq(roundupItems.section, section)
        )
      );

    const now = Math.floor(Date.now() / 1000);
    const [newItem] = await db
      .insert(roundupItems)
      .values({
        roundupId,
        contentId,
        section,
        pullQuote,
        note,
        displayOrder: (maxOrder?.max ?? -1) + 1,
        createdAt: now,
      })
      .returning();

    // Update roundup's updatedAt
    await db
      .update(roundups)
      .set({ updatedAt: now })
      .where(eq(roundups.id, roundupId));

    return Response.json({
      success: true,
      item: newItem,
    });
  } catch (error) {
    console.error("Add roundup item error:", error);
    return Response.json(
      { error: "Failed to add item to roundup", details: String(error) },
      { status: 500 }
    );
  }
};

// DELETE - Remove item from roundup
export const DELETE: APIRoute = async ({ locals, params, request }) => {
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
    const { itemId, contentId } = body;

    // Allow deletion by either itemId or contentId
    let condition;
    if (itemId) {
      condition = eq(roundupItems.id, itemId);
    } else if (contentId) {
      condition = and(
        eq(roundupItems.roundupId, roundupId),
        eq(roundupItems.contentId, contentId)
      );
    } else {
      return Response.json({ error: "itemId or contentId required" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(roundupItems)
      .where(condition)
      .returning();

    if (!deleted) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    // Update roundup's updatedAt
    await db
      .update(roundups)
      .set({ updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(roundups.id, roundupId));

    return Response.json({
      success: true,
      message: "Item removed from roundup",
    });
  } catch (error) {
    console.error("Remove roundup item error:", error);
    return Response.json(
      { error: "Failed to remove item from roundup", details: String(error) },
      { status: 500 }
    );
  }
};

// PATCH - Update item (section, order, pullQuote, note)
export const PATCH: APIRoute = async ({ locals, params, request }) => {
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
    const { itemId, section, displayOrder, pullQuote, note } = body;

    if (!itemId) {
      return Response.json({ error: "itemId is required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (section !== undefined) updateData.section = section;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (pullQuote !== undefined) updateData.pullQuote = pullQuote;
    if (note !== undefined) updateData.note = note;

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(roundupItems)
      .set(updateData)
      .where(eq(roundupItems.id, itemId))
      .returning();

    if (!updated) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    // Update roundup's updatedAt
    await db
      .update(roundups)
      .set({ updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(roundups.id, roundupId));

    return Response.json({
      success: true,
      item: updated,
    });
  } catch (error) {
    console.error("Update roundup item error:", error);
    return Response.json(
      { error: "Failed to update item", details: String(error) },
      { status: 500 }
    );
  }
};
