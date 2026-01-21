import type { APIRoute } from "astro";
import { getDb } from "../../../../db/getDb";
import { authors } from "../../../../db/schema";
import { eq } from "drizzle-orm";

// Mark author as Webflow staff
export const POST: APIRoute = async ({ locals, params }) => {
  const user = locals.user;
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const authorId = parseInt(params.id || "", 10);
  if (isNaN(authorId)) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const db = getDb(locals);

  try {
    await db
      .update(authors)
      .set({ isWebflowStaff: true })
      .where(eq(authors.id, authorId));

    return Response.json({ success: true, isStaff: true });
  } catch (error) {
    console.error("Staff marking error:", error);
    return Response.json(
      { error: "Failed to mark as staff", details: String(error) },
      { status: 500 }
    );
  }
};

// Unmark author as Webflow staff
export const DELETE: APIRoute = async ({ locals, params }) => {
  const user = locals.user;
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const authorId = parseInt(params.id || "", 10);
  if (isNaN(authorId)) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const db = getDb(locals);

  try {
    await db
      .update(authors)
      .set({ isWebflowStaff: false })
      .where(eq(authors.id, authorId));

    return Response.json({ success: true, isStaff: false });
  } catch (error) {
    console.error("Staff unmarking error:", error);
    return Response.json(
      { error: "Failed to unmark as staff", details: String(error) },
      { status: 500 }
    );
  }
};
