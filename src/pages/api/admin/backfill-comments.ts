import type { APIRoute } from "astro";
import { getDb } from "../../../db/getDb";
import { contentItems, authors } from "../../../db/schema";
import { createArcadeClient } from "../../../lib/arcade";
import { eq, and, sql } from "drizzle-orm";
import { invalidateAuthorCaches, invalidateContentCaches } from "../../../lib/cache";

/**
 * Backfill comments for existing posts
 * POST /api/admin/backfill-comments
 *
 * Query params:
 * - limit: Max number of posts to process (default: 10, max: 50)
 * - offset: Skip first N posts (for pagination)
 */
export const POST: APIRoute = async ({ locals, url }) => {
  const db = getDb(locals);
  const env = locals.runtime.env;
  const user = locals.user;

  // Require authentication
  if (!user) {
    return Response.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Get API keys
  const arcadeKey = env.ARCADE_API_KEY;
  const anthropicKey = env.ANTHROPIC_API_KEY;

  if (!arcadeKey || !anthropicKey) {
    return Response.json(
      { error: "API keys not configured" },
      { status: 500 }
    );
  }

  // Create Arcade client
  const arcade = createArcadeClient(arcadeKey, user.email);

  // Check Reddit authorization
  const authCheck = await arcade.checkAuthorization();
  if (!authCheck.authorized) {
    return Response.json(
      {
        requiresAuth: true,
        authUrl: authCheck.authUrl,
        authId: authCheck.authId,
        message: "Reddit authorization required",
      },
      { status: 401 }
    );
  }

  // Get pagination params
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "10"),
    50
  );
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const results = {
    postsProcessed: 0,
    commentsAdded: 0,
    commentsSkipped: 0,
    errors: 0,
    errorDetails: [] as string[],
  };

  try {
    // Fetch posts that don't have comments yet (or all posts)
    const posts = await db
      .select({
        id: contentItems.id,
        platformId: contentItems.platformId,
        subreddit: contentItems.subreddit,
        title: contentItems.title,
      })
      .from(contentItems)
      .where(
        and(
          eq(contentItems.platform, "reddit"),
          eq(contentItems.type, "post")
        )
      )
      .limit(limit)
      .offset(offset);

    console.log(`Processing ${posts.length} posts starting at offset ${offset}`);

    // Process each post
    for (const post of posts) {
      try {
        console.log(`Fetching comments for post ${post.platformId}...`);

        // Fetch comments from Reddit
        const comments = await arcade.getPostComments(post.platformId);
        console.log(`Found ${comments.length} comments for post ${post.platformId}`);

        // Process each comment
        for (const comment of comments) {
          try {
            // Check if comment already exists
            const existing = await db
              .select()
              .from(contentItems)
              .where(
                and(
                  eq(contentItems.platform, "reddit"),
                  eq(contentItems.platformId, comment.id)
                )
              )
              .limit(1);

            if (existing.length > 0) {
              results.commentsSkipped++;
              continue;
            }

            // Get or create author
            let authorRecord = await db
              .select()
              .from(authors)
              .where(
                and(
                  eq(authors.platform, "reddit"),
                  eq(authors.platformId, comment.author)
                )
              )
              .limit(1);

            let authorId: number;
            const now = Math.floor(Date.now() / 1000);

            if (authorRecord.length === 0) {
              const newAuthor = await db
                .insert(authors)
                .values({
                  platform: "reddit",
                  platformId: comment.author,
                  username: comment.author,
                  firstSeen: now,
                  lastSeen: now,
                  postCount: 1,
                  isWebflowStaff: false,
                  subreddits: post.subreddit ? JSON.stringify([post.subreddit]) : null,
                })
                .returning();
              authorId = newAuthor[0].id;
            } else {
              authorId = authorRecord[0].id;

              // Update author stats
              let subredditsList: string[] = [];
              if (authorRecord[0].subreddits) {
                try {
                  subredditsList = JSON.parse(authorRecord[0].subreddits);
                } catch (e) {
                  subredditsList = [];
                }
              }

              if (post.subreddit && !subredditsList.includes(post.subreddit)) {
                subredditsList.push(post.subreddit);
              }

              await db
                .update(authors)
                .set({
                  lastSeen: now,
                  postCount: authorRecord[0].postCount + 1,
                  subreddits: JSON.stringify(subredditsList),
                })
                .where(eq(authors.id, authorId));
            }

            // Insert comment
            await db.insert(contentItems).values({
              platform: "reddit",
              platformId: comment.id,
              type: "comment",
              title: null,
              body: comment.body,
              url: `https://reddit.com${post.platformId}/comment/${comment.id}`,
              subreddit: post.subreddit,
              flair: null,
              authorId,
              parentId: post.id, // Link to parent post
              createdAt: Math.floor(comment.created_utc),
              ingestedAt: now,
              engagementScore: comment.score,
              isWebflowRelated: true, // Inherit from parent post
              needsReview: false,
              sentiment: "neutral",
              classification: "discussion",
            });

            results.commentsAdded++;

            // Invalidate caches for this author, content, and subreddits list
            const cache = env.CACHE;
            if (cache) {
              await Promise.all([
                invalidateAuthorCaches(cache, authorId),
                invalidateContentCaches(cache),
                cache.delete("subreddits:list"),
              ]);
            }
          } catch (commentError) {
            console.error(`Error processing comment ${comment.id}:`, commentError);
            results.errors++;
            results.errorDetails.push(
              `Comment ${comment.id}: ${String(commentError)}`
            );
          }
        }

        results.postsProcessed++;
      } catch (postError) {
        console.error(`Error processing post ${post.platformId}:`, postError);
        results.errors++;
        results.errorDetails.push(
          `Post ${post.platformId}: ${String(postError)}`
        );
      }
    }

    return Response.json({
      success: true,
      results,
      pagination: {
        limit,
        offset,
        nextOffset: offset + limit,
        hasMore: posts.length === limit,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Backfill error:", error);
    return Response.json(
      { error: "Failed to backfill comments", details: String(error) },
      { status: 500 }
    );
  }
};

export const GET: APIRoute = async ({ locals }) => {
  const db = getDb(locals);
  const user = locals.user;

  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    // Get stats about posts and comments
    const [{ totalPosts }] = await db
      .select({ totalPosts: sql<number>`count(*)` })
      .from(contentItems)
      .where(
        and(
          eq(contentItems.platform, "reddit"),
          eq(contentItems.type, "post")
        )
      );

    const [{ totalComments }] = await db
      .select({ totalComments: sql<number>`count(*)` })
      .from(contentItems)
      .where(
        and(
          eq(contentItems.platform, "reddit"),
          eq(contentItems.type, "comment")
        )
      );

    return Response.json({
      stats: {
        totalPosts,
        totalComments,
        averageCommentsPerPost: totalPosts > 0 ? (totalComments / totalPosts).toFixed(2) : 0,
      },
      message: "Use POST to start backfilling comments",
      usage: "POST /api/admin/backfill-comments?limit=10&offset=0",
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to get stats", details: String(error) },
      { status: 500 }
    );
  }
};
