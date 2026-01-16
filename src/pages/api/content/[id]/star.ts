// Toggle star/roundup candidate status on a content item
import type { APIRoute } from "astro";
import { getDb } from "../../../../db/getDb";
import { contentItems } from "../../../../db/schema";
import { eq } from "drizzle-orm";

export const POST: APIRoute = async ({ locals, params }) => {
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
    // Get current state
    const [item] = await db
      .select({ isRoundupCandidate: contentItems.isRoundupCandidate })
      .from(contentItems)
      .where(eq(contentItems.id, contentId))
      .limit(1);

    if (!item) {
      return Response.json({ error: "Content not found" }, { status: 404 });
    }

    // Toggle the star status
    const newStatus = !item.isRoundupCandidate;

    await db
      .update(contentItems)
      .set({ isRoundupCandidate: newStatus })
      .where(eq(contentItems.id, contentId));

    return Response.json({
      success: true,
      contentId,
      isRoundupCandidate: newStatus,
    });
  } catch (error) {
    console.error("Error toggling star:", error);
    return Response.json(
      { error: "Failed to toggle star", details: String(error) },
      { status: 500 }
    );
  }
};
