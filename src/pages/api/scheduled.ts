// Scheduled trigger handler for cron jobs
// This endpoint is called by the cron trigger defined in wrangler.json
// It can also be called manually for testing

import type { APIRoute } from "astro";
import { getDb } from "../../db/getDb";
import { contentItems, authors, engagementSnapshots, users } from "../../db/schema";
import { createArcadeClient } from "../../lib/arcade";
import { isWebflowRelated } from "../../lib/reddit";
import { analyzeContent } from "../../lib/claude";
import { eq, and, desc } from "drizzle-orm";

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

// Ingestion limits
const MAX_TOTAL_POSTS = 25;
const MAX_POSTS_PER_SUBREDDIT = 10;
const SUBREDDITS_TO_CHECK = ["webflow"];

async function runIngestion(db: ReturnType<typeof getDb>, env: Record<string, string>) {
  const arcadeKey = env.ARCADE_API_KEY;
  const anthropicKey = env.ANTHROPIC_API_KEY;

  if (!arcadeKey || !anthropicKey) {
    console.error("Missing API keys for scheduled ingestion");
    return { error: "Missing API keys" };
  }

  // Get the first user to use as the Arcade userId
  // In production, you might want a service account or specific user
  const firstUser = await db.select().from(users).limit(1);
  if (firstUser.length === 0) {
    console.log("No users found, skipping scheduled ingestion");
    return { error: "No users found" };
  }

  const userId = firstUser[0].email;
  const arcade = createArcadeClient(arcadeKey, userId);

  // Check if Reddit is authorized for this user
  const authCheck = await arcade.checkAuthorization();
  if (!authCheck.authorized) {
    console.log("Reddit not authorized for scheduled ingestion");
    return { error: "Reddit authorization required" };
  }

  const results = {
    processed: 0,
    skipped: 0,
    errors: 0,
    subreddits: {} as Record<string, number>,
  };

  for (const subreddit of SUBREDDITS_TO_CHECK) {
    if (results.processed >= MAX_TOTAL_POSTS) break;

    try {
      const posts = await arcade.getSubredditPosts(subreddit, "new", MAX_POSTS_PER_SUBREDDIT);
      results.subreddits[subreddit] = 0;

      for (const post of posts) {
        if (results.processed >= MAX_TOTAL_POSTS) break;

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
              })
              .returning();
            authorId = newAuthor[0].id;
          } else {
            authorId = authorRecord[0].id;
            await db
              .update(authors)
              .set({
                lastSeen: now,
                postCount: authorRecord[0].postCount + 1,
              })
              .where(eq(authors.id, authorId));
          }

          const postTitle = decodeHtmlEntities(post.title);
          const postBody = post.selftext || "";
          const contentText = `${postTitle}\n\n${postBody}`;
          const webflowRelated = subreddit === "webflow" || isWebflowRelated(contentText);
          const postFlair = post.link_flair_text || post.flair || null;

          let analysis = {
            sentiment: "neutral" as const,
            sentimentConfidence: 0.5,
            classification: "discussion" as const,
            classificationConfidence: 0.5,
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
              subreddit,
              flair: postFlair,
            });
          }

          const newContent = await db
            .insert(contentItems)
            .values({
              platform: "reddit",
              platformId: post.id,
              type: "post",
              title: postTitle,
              body: postBody || "",
              url: post.url || `https://reddit.com${post.permalink}`,
              subreddit,
              flair: postFlair,
              authorId,
              createdAt: Math.floor(post.created_utc),
              ingestedAt: now,
              sentiment: analysis.sentiment,
              sentimentConfidence: analysis.sentimentConfidence,
              classification: analysis.classification,
              classificationConfidence: analysis.classificationConfidence,
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

          await db.insert(engagementSnapshots).values({
            contentId: newContent[0].id,
            capturedAt: now,
            upvotes: post.score,
            comments: post.num_comments,
          });

          results.processed++;
          results.subreddits[subreddit]++;
        } catch (postError) {
          console.error(`Error processing post ${post.id}:`, postError);
          results.errors++;
        }
      }
    } catch (subredditError) {
      console.error(`Error fetching r/${subreddit}:`, subredditError);
    }
  }

  return results;
}

// Manual trigger endpoint (for testing)
export const POST: APIRoute = async ({ locals }) => {
  const db = getDb(locals);
  const env = locals.runtime.env as unknown as Record<string, string>;

  console.log("Running scheduled ingestion manually...");
  const results = await runIngestion(db, env);

  return Response.json({
    success: true,
    source: "manual",
    results,
    timestamp: new Date().toISOString(),
  });
};

// Export the scheduled handler for Cloudflare cron triggers
export async function scheduled(event: ScheduledEvent, env: Record<string, string>, ctx: ExecutionContext) {
  console.log("Cron trigger fired at:", new Date().toISOString());
  // Note: In Astro/Cloudflare, the scheduled handler needs access to DB
  // This is handled differently - see Astro's cloudflare adapter docs
  // For now, we rely on manual triggers or external cron services
}
