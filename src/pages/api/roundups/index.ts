// Roundups API - List and create roundups
import type { APIRoute } from "astro";
import { getDb } from "../../../db/getDb";
import { roundups, roundupItems, contentItems } from "../../../db/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";

// GET - List all roundups with item counts
export const GET: APIRoute = async ({ locals }) => {
  const db = getDb(locals);

  try {
    // Get roundups with item counts
    const roundupList = await db
      .select({
        id: roundups.id,
        title: roundups.title,
        status: roundups.status,
        dateFrom: roundups.dateFrom,
        dateTo: roundups.dateTo,
        createdAt: roundups.createdAt,
        updatedAt: roundups.updatedAt,
        itemCount: sql<number>`(SELECT COUNT(*) FROM roundup_items WHERE roundup_id = ${roundups.id})`,
      })
      .from(roundups)
      .orderBy(desc(roundups.createdAt));

    // Get count of starred posts (not yet in any roundup)
    const starredCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(contentItems)
      .where(eq(contentItems.isRoundupCandidate, true));

    return Response.json({
      roundups: roundupList,
      starredCount: starredCount[0]?.count || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Roundups list error:", error);
    return Response.json(
      { error: "Failed to list roundups", details: String(error) },
      { status: 500 }
    );
  }
};

// POST - Create a new roundup
export const POST: APIRoute = async ({ locals, request }) => {
  const db = getDb(locals);
  const user = locals.user;

  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, dateFrom, dateTo, autoAddStarred = true } = body;

    // Validate required fields
    if (!dateFrom || !dateTo) {
      return Response.json({ error: "dateFrom and dateTo are required" }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    const dateFromTs = typeof dateFrom === "number" ? dateFrom : Math.floor(new Date(dateFrom).getTime() / 1000);
    const dateToTs = typeof dateTo === "number" ? dateTo : Math.floor(new Date(dateTo).getTime() / 1000);

    // Generate default title if not provided
    const defaultTitle = title || `Weekly Roundup - ${new Date(dateFromTs * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })} to ${new Date(dateToTs * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

    // Create the roundup
    const [newRoundup] = await db
      .insert(roundups)
      .values({
        title: defaultTitle,
        status: "draft",
        dateFrom: dateFromTs,
        dateTo: dateToTs,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Optionally auto-add starred posts from the date range
    let addedItems = 0;
    if (autoAddStarred) {
      // Get starred posts in date range
      const starredPosts = await db
        .select({ id: contentItems.id })
        .from(contentItems)
        .where(
          and(
            eq(contentItems.isRoundupCandidate, true),
            gte(contentItems.createdAt, dateFromTs),
            lte(contentItems.createdAt, dateToTs)
          )
        );

      // Add them to the roundup
      if (starredPosts.length > 0) {
        await db.insert(roundupItems).values(
          starredPosts.map((post, index) => ({
            roundupId: newRoundup.id,
            contentId: post.id,
            section: "highlight",
            displayOrder: index,
            createdAt: now,
          }))
        );
        addedItems = starredPosts.length;
      }
    }

    return Response.json({
      success: true,
      roundup: newRoundup,
      addedItems,
    });
  } catch (error) {
    console.error("Create roundup error:", error);
    return Response.json(
      { error: "Failed to create roundup", details: String(error) },
      { status: 500 }
    );
  }
};
