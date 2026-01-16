// Update content item fields (manual override for AI classifications)
import type { APIRoute } from "astro";
import { getDb } from "../../../../db/getDb";
import { contentItems } from "../../../../db/schema";
import { eq } from "drizzle-orm";

// Allowed fields that can be manually updated
const ALLOWED_FIELDS = [
  "sentiment",
  "classification", 
  "topic",
  "isWebflowRelated",
  "isQuestion",
  "questionCategory",
  "isFaqCandidate",
  "isShowcase",
  "needsReview",
  "qualityScore",
] as const;

type AllowedField = typeof ALLOWED_FIELDS[number];

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  const db = getDb(locals);
  const user = locals.user;

  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const contentId = parseInt(params.id || "", 10);
  if (isNaN(contentId)) {
    return Response.json({ error: "Invalid content ID" }, { status: 400 });
  }

  let updates: Partial<Record<AllowedField, unknown>>;
  try {
    updates = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Filter to only allowed fields
  const validUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (ALLOWED_FIELDS.includes(key as AllowedField)) {
      validUpdates[key] = value;
    }
  }

  if (Object.keys(validUpdates).length === 0) {
    return Response.json({ 
      error: "No valid fields to update", 
      allowedFields: ALLOWED_FIELDS 
    }, { status: 400 });
  }

  try {
    // Verify item exists
    const [item] = await db
      .select({ id: contentItems.id })
      .from(contentItems)
      .where(eq(contentItems.id, contentId))
      .limit(1);

    if (!item) {
      return Response.json({ error: "Content not found" }, { status: 404 });
    }

    // Apply updates
    await db
      .update(contentItems)
      .set(validUpdates)
      .where(eq(contentItems.id, contentId));

    return Response.json({
      success: true,
      contentId,
      updated: validUpdates,
    });
  } catch (error) {
    console.error("Error updating content:", error);
    return Response.json(
      { error: "Failed to update content", details: String(error) },
      { status: 500 }
    );
  }
};

// GET single content item
export const GET: APIRoute = async ({ locals, params }) => {
  const db = getDb(locals);
  const user = locals.user;

  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const contentId = parseInt(params.id || "", 10);
  if (isNaN(contentId)) {
    return Response.json({ error: "Invalid content ID" }, { status: 400 });
  }

  try {
    const [item] = await db
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, contentId))
      .limit(1);

    if (!item) {
      return Response.json({ error: "Content not found" }, { status: 404 });
    }

    return Response.json(item);
  } catch (error) {
    console.error("Error fetching content:", error);
    return Response.json(
      { error: "Failed to fetch content", details: String(error) },
      { status: 500 }
    );
  }
};
