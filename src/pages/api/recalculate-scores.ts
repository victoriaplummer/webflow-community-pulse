// Recalculate contributor scores for all authors based on their posts
import type { APIRoute } from "astro";
import { getDb } from "../../db/getDb";
import { authors, contentItems } from "../../db/schema";
import { eq, sql, and, inArray } from "drizzle-orm";

export const POST: APIRoute = async ({ locals }) => {
  const db = getDb(locals);
  const user = locals.user;

  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    // Get all authors
    const allAuthors = await db.select().from(authors);

    let updated = 0;
    for (const author of allAuthors) {
      // Count posts for this author
      const postCountResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(contentItems)
        .where(eq(contentItems.authorId, author.id));

      // Count high quality posts (thought_leadership or resource)
      const highQualityResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(contentItems)
        .where(
          and(
            eq(contentItems.authorId, author.id),
            inArray(contentItems.classification, ["thought_leadership", "resource"])
          )
        );

      const postCount = postCountResult[0]?.count || 0;
      const highQualityCount = highQualityResult[0]?.count || 0;

      // Score formula: postCount + (highQualityCount * 5)
      const contributorScore = postCount + highQualityCount * 5;

      await db
        .update(authors)
        .set({
          postCount,
          highQualityCount,
          contributorScore,
        })
        .where(eq(authors.id, author.id));

      updated++;
    }

    return Response.json({
      success: true,
      updated,
      message: `Recalculated scores for ${updated} authors`,
    });
  } catch (error) {
    console.error("Recalculate scores error:", error);
    return Response.json(
      { error: "Failed to recalculate scores", details: String(error) },
      { status: 500 }
    );
  }
};

export const GET: APIRoute = async () => {
  return Response.json({
    message: "POST to this endpoint to recalculate all contributor scores",
    description: "Score formula: postCount + (highQualityCount * 5)",
  });
};
