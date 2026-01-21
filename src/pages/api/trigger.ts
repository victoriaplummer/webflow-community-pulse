import type { APIRoute } from "astro";
import { getDb } from "../../db/getDb";
import { contentItems, authors, engagementSnapshots } from "../../db/schema";
import { createArcadeClient, AuthorizationRequiredError } from "../../lib/arcade";
import { isWebflowRelated, getSubreddits } from "../../lib/reddit";
import { analyzeContent } from "../../lib/claude";
import { eq, and } from "drizzle-orm";
import { invalidateAuthorCaches, invalidateContentCaches } from "../../lib/cache";

// Decode HTML entities in text
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export const POST: APIRoute = async ({ locals }) => {
  const db = getDb(locals);
  const env = locals.runtime.env;
  const user = locals.user;

  // User should always exist due to middleware, but check anyway
  if (!user) {
    return Response.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Get API keys from environment
  const arcadeKey = env.ARCADE_API_KEY;
  const anthropicKey = env.ANTHROPIC_API_KEY;

  if (!arcadeKey) {
    return Response.json(
      { error: "ARCADE_API_KEY not configured" },
      { status: 500 }
    );
  }

  if (!anthropicKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  // Create Arcade client for Reddit access using user's email as userId
  const arcade = createArcadeClient(arcadeKey, user.email);

  // Check if Reddit authorization is needed first
  const authCheck = await arcade.checkAuthorization();
  if (!authCheck.authorized) {
    return Response.json(
      {
        requiresAuth: true,
        authUrl: authCheck.authUrl,
        authId: authCheck.authId,
        message: "Reddit authorization required. Please click the link to authorize.",
      },
      { status: 401 }
    );
  }

  // Ingestion limits to prevent overload
  const MAX_TOTAL_POSTS = 50; // Max posts to process per trigger
  const MAX_POSTS_PER_SUBREDDIT = 10; // Max posts to fetch per subreddit
  const SUBREDDITS_TO_CHECK = ["webflow"]; // Start with just webflow for now

  const results = {
    processed: 0,
    skipped: 0,
    errors: 0,
    subreddits: {} as Record<string, number>,
    errorDetails: [] as string[],
    postsFound: {} as Record<string, number>,
    limits: {
      maxTotal: MAX_TOTAL_POSTS,
      maxPerSubreddit: MAX_POSTS_PER_SUBREDDIT,
      subredditsChecked: SUBREDDITS_TO_CHECK,
    },
  };

  try {
    // Fetch posts from subreddits using Arcade SDK
    for (const subreddit of SUBREDDITS_TO_CHECK) {
      // Stop if we've hit the total limit
      if (results.processed >= MAX_TOTAL_POSTS) {
        console.log(`Hit max total posts limit (${MAX_TOTAL_POSTS}), stopping`);
        break;
      }

      try {
        console.log(`Starting fetch for r/${subreddit}...`);
        const posts = await arcade.getSubredditPosts(subreddit, "new", MAX_POSTS_PER_SUBREDDIT);
        results.subreddits[subreddit] = 0;
        results.postsFound[subreddit] = posts.length;
        console.log(`Found ${posts.length} posts in r/${subreddit}`);

        for (const post of posts) {
          try {
            // Check if already exists
            const existing = await db
              .select()
              .from(contentItems)
              .where(
                and(
                  eq(contentItems.platform, "reddit"),
                  eq(contentItems.platformId, post.id)
                )
              )
              .limit(1);

            if (existing.length > 0) {
              results.skipped++;
              continue;
            }

            // Get or create author
            let authorRecord = await db
              .select()
              .from(authors)
              .where(
                and(
                  eq(authors.platform, "reddit"),
                  eq(authors.platformId, post.author)
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
                  platformId: post.author,
                  username: post.author,
                  firstSeen: now,
                  lastSeen: now,
                  postCount: 1,
                  isWebflowStaff: false,
                  subreddits: JSON.stringify([post.subreddit]),
                })
                .returning();
              authorId = newAuthor[0].id;
            } else {
              authorId = authorRecord[0].id;

              // Parse and update subreddits array
              let subredditsList: string[] = [];
              if (authorRecord[0].subreddits) {
                try {
                  subredditsList = JSON.parse(authorRecord[0].subreddits);
                } catch (e) {
                  subredditsList = [];
                }
              }

              // Add subreddit if not already in the list
              if (!subredditsList.includes(post.subreddit)) {
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

            // Decode HTML entities and get post content
            const postTitle = decodeHtmlEntities(post.title);
            const postBody = post.selftext || await arcade.getPostContent(post.id);

            // Analyze content with Claude
            const contentText = `${postTitle}\n\n${postBody}`;
            const webflowRelated =
              post.subreddit === "webflow" || isWebflowRelated(contentText);

            // Get flair from post
            const postFlair = post.link_flair_text || post.flair || null;

            // Only analyze webflow-related content to save API costs
            let analysis = {
              sentiment: "neutral" as const,
              sentimentConfidence: 0.5,
              classification: "discussion" as const,
              classificationConfidence: 0.5,
              topic: "general" as const,
              keywords: [] as string[],
              isWebflowRelated: webflowRelated,
              needsReview: false,
              summary: "",
              qualityScore: 5,
              isQuestion: false,
              questionCategory: null as string | null,
              isFaqCandidate: false,
              suggestedResource: null as string | null,
              isShowcase: false,
              showcaseUrl: null as string | null,
            };

            if (webflowRelated) {
              analysis = await analyzeContent(anthropicKey, {
                title: postTitle,
                body: postBody || "(link post)",
                subreddit: post.subreddit,
                flair: postFlair,
              });
            }

            // Insert content item
            const newContent = await db
              .insert(contentItems)
              .values({
                platform: "reddit",
                platformId: post.id,
                type: "post",
                title: postTitle,
                body: postBody || "",
                url: `https://reddit.com${post.permalink}`,
                subreddit: post.subreddit,
                flair: postFlair,
                authorId,
                createdAt: Math.floor(post.created_utc),
                ingestedAt: now,
                sentiment: analysis.sentiment,
                sentimentConfidence: analysis.sentimentConfidence,
                classification: analysis.classification,
                classificationConfidence: analysis.classificationConfidence,
                topic: analysis.topic,
                needsReview: analysis.needsReview,
                keywords: JSON.stringify(analysis.keywords),
                isWebflowRelated: analysis.isWebflowRelated,
                engagementScore: post.score + post.num_comments * 2,
                summary: analysis.summary,
                qualityScore: analysis.qualityScore,
                isQuestion: analysis.isQuestion,
                questionCategory: analysis.questionCategory,
                isFaqCandidate: analysis.isFaqCandidate,
                suggestedResource: analysis.suggestedResource,
                isShowcase: analysis.isShowcase,
                showcaseUrl: analysis.showcaseUrl,
              })
              .returning();

            // Record engagement snapshot
            await db.insert(engagementSnapshots).values({
              contentId: newContent[0].id,
              capturedAt: now,
              upvotes: post.score,
              comments: post.num_comments,
            });

            // Update author high quality count and recalculate contributor score
            if (
              analysis.classification === "tutorial" ||
              analysis.classification === "resource" ||
              analysis.classification === "showcase"
            ) {
              const currentAuthor = await db
                .select({ postCount: authors.postCount, highQualityCount: authors.highQualityCount })
                .from(authors)
                .where(eq(authors.id, authorId))
                .limit(1);

              const newHighQualityCount = (currentAuthor[0]?.highQualityCount || 0) + 1;
              const postCount = currentAuthor[0]?.postCount || 1;
              // Score formula: postCount + (highQualityCount * 5)
              const newScore = postCount + newHighQualityCount * 5;

              await db
                .update(authors)
                .set({
                  highQualityCount: newHighQualityCount,
                  contributorScore: newScore,
                })
                .where(eq(authors.id, authorId));
            } else {
              // Also update score for regular posts (just based on post count)
              const currentAuthor = await db
                .select({ postCount: authors.postCount, highQualityCount: authors.highQualityCount })
                .from(authors)
                .where(eq(authors.id, authorId))
                .limit(1);

              const postCount = currentAuthor[0]?.postCount || 1;
              const highQualityCount = currentAuthor[0]?.highQualityCount || 0;
              const newScore = postCount + highQualityCount * 5;

              await db
                .update(authors)
                .set({ contributorScore: newScore })
                .where(eq(authors.id, authorId));
            }

            results.processed++;
            results.subreddits[subreddit]++;

            // Invalidate caches for this author, content, and subreddits list
            const cache = locals.runtime.env.CACHE;
            if (cache) {
              await Promise.all([
                invalidateAuthorCaches(cache, authorId),
                invalidateContentCaches(cache),
                cache.delete("subreddits:list"),
              ]);
            }
          } catch (postError) {
            console.error(`Error processing post ${post.id}:`, postError);
            results.errors++;
            results.errorDetails.push(`Post ${post.id}: ${String(postError)}`);
          }
        }
      } catch (subredditError) {
        console.error(`Error fetching r/${subreddit}:`, subredditError);
        results.errorDetails.push(`r/${subreddit}: ${String(subredditError)}`);
      }
    }

    return Response.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Trigger error:", error);
    return Response.json(
      { error: "Failed to process content", details: String(error) },
      { status: 500 }
    );
  }
};

export const GET: APIRoute = async () => {
  return Response.json({
    message: "Use POST to trigger content ingestion",
    endpoint: "/api/trigger",
  });
};
