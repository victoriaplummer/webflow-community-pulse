// Backfill endpoint to fetch older posts
// Note: Reddit API typically only allows fetching ~1000 most recent posts
// For posts older than that, we'd need Reddit's search API with date filters

import type { APIRoute } from "astro";
import { getDb } from "../../db/getDb";
import { contentItems, authors, engagementSnapshots } from "../../db/schema";
import { createArcadeClient } from "../../lib/arcade";
import { isWebflowRelated } from "../../lib/reddit";
import { analyzeContent } from "../../lib/claude";
import { eq, and } from "drizzle-orm";

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export const POST: APIRoute = async ({ locals, request }) => {
  const db = getDb(locals);
  const env = locals.runtime.env;
  const user = locals.user;

  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  // Parse request body for options
  let options: {
    pages: number;
    postsPerPage: number;
    subreddit: string;
    listing: "hot" | "new" | "rising" | "top" | "controversial";
    timeRange?: "NOW" | "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "THIS_YEAR" | "ALL_TIME";
    analyzeAll?: boolean; // If true, analyze all posts even if not webflow-related
  } = { pages: 5, postsPerPage: 100, subreddit: "webflow", listing: "new", analyzeAll: false };

  try {
    const body = await request.json();
    options = { ...options, ...body };
  } catch {
    // Use defaults
  }

  const arcadeKey = env.ARCADE_API_KEY;
  const anthropicKey = env.ANTHROPIC_API_KEY;

  if (!arcadeKey || !anthropicKey) {
    return Response.json({ error: "Missing API keys" }, { status: 500 });
  }

  const arcade = createArcadeClient(arcadeKey, user.email);

  // Check authorization
  const authCheck = await arcade.checkAuthorization();
  if (!authCheck.authorized) {
    return Response.json({
      requiresAuth: true,
      authUrl: authCheck.authUrl,
      authId: authCheck.authId,
      message: "Reddit authorization required",
    }, { status: 401 });
  }

  const results = {
    processed: 0,
    skipped: 0,
    errors: 0,
    pages: 0,
    oldestPostDate: null as string | null,
    newestPostDate: null as string | null,
    paginationLimited: false,
  };

  // Reddit API limitation: can only paginate through ~1000 most recent posts
  const MAX_PAGES = Math.min(options.pages, 10);
  const POSTS_PER_PAGE = Math.min(options.postsPerPage, 100);
  let cursor: string | undefined;
  let lastPageFirstPostId: string | undefined;

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      console.log(`Backfill: Fetching page ${page + 1} for r/${options.subreddit}...`);

      // Fetch posts using pagination
      // Note: Reddit API only allows access to ~1000 most recent posts
      // Using 'top' with time_range can help access different post sets
      const response = await arcade.getSubredditPostsWithCursor(
        options.subreddit,
        options.listing,
        POSTS_PER_PAGE,
        cursor,
        options.timeRange
      );

      if (!response.posts || response.posts.length === 0) {
        console.log("No more posts to fetch (reached Reddit's pagination limit)");
        break;
      }

      // Check if we're getting the same page again (pagination not working)
      const firstPostId = response.posts[0]?.id;
      if (firstPostId && firstPostId === lastPageFirstPostId) {
        console.log("Detected duplicate page - Arcade pagination may not be supported. Stopping.");
        results.paginationLimited = true;
        break;
      }
      lastPageFirstPostId = firstPostId;

      results.pages++;

      for (const post of response.posts) {
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
              .set({ lastSeen: now, postCount: authorRecord[0].postCount + 1 })
              .where(eq(authors.id, authorId));
          }

          const postTitle = decodeHtmlEntities(post.title);
          const postBody = post.selftext || "";
          const contentText = `${postTitle}\n\n${postBody}`;
          const webflowRelated = options.subreddit === "webflow" || isWebflowRelated(contentText);
          const postFlair = post.link_flair_text || post.flair || null;

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
            // Multi-platform monitoring fields
            mentionsWebflow: false,
            mentionedTools: [] as string[],
            audienceRelevance: 5,
          };

          // Determine whether to analyze this post
          // - Primary subreddit (webflow): always analyze
          // - Other subreddits: only analyze if analyzeAll is explicitly set
          // This makes backfill FAST - use the analyze script to analyze later
          const isPrimarySubreddit = post.subreddit.toLowerCase() === "webflow";
          const shouldAnalyze = isPrimarySubreddit || options.analyzeAll;

          if (shouldAnalyze) {
            analysis = await analyzeContent(anthropicKey, {
              title: postTitle,
              body: postBody || "(link post)",
              subreddit: post.subreddit,
              flair: postFlair,
            });
          }

          const [insertedContent] = await db.insert(contentItems).values({
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
            // Multi-platform monitoring fields
            mentionsWebflow: analysis.mentionsWebflow,
            mentionedTools: JSON.stringify(analysis.mentionedTools),
            audienceRelevance: analysis.audienceRelevance,
          }).returning({ id: contentItems.id });

          await db.insert(engagementSnapshots).values({
            contentId: insertedContent.id,
            capturedAt: now,
            upvotes: post.score,
            comments: post.num_comments,
          });

          // Update highQualityCount and contributorScore for high-quality posts
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

          // Track post dates
          const postDate = new Date(post.created_utc * 1000).toISOString();
          if (!results.oldestPostDate || postDate < results.oldestPostDate) {
            results.oldestPostDate = postDate;
          }
          if (!results.newestPostDate || postDate > results.newestPostDate) {
            results.newestPostDate = postDate;
          }

          results.processed++;
        } catch (postError) {
          console.error(`Error processing post ${post.id}:`, postError);
          results.errors++;
        }
      }

      // Update cursor for next page
      cursor = response.cursor;
      if (!cursor) {
        console.log("No more pages available");
        break;
      }

      // Small delay between pages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return Response.json({
      success: true,
      results,
      message: `Backfilled ${results.processed} posts across ${results.pages} pages`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Backfill error:", error);
    return Response.json({
      error: "Backfill failed",
      details: String(error),
      partialResults: results,
    }, { status: 500 });
  }
};

export const GET: APIRoute = async () => {
  return Response.json({
    message: "POST to this endpoint to backfill recent posts",
    options: {
      pages: "Number of pages to fetch (default: 5, max: 10)",
      postsPerPage: "Posts per page (default: 100, max: 100)",
      subreddit: "Subreddit to backfill (default: webflow)",
      analyzeAll: "If true, analyze posts with Claude during backfill. Default: false for non-webflow subreddits. Use /api/reanalyze or the analyze script for batch analysis.",
    },
    workflow: {
      step1: "Backfill posts (fast) - fetches and stores with default values",
      step2: "Analyze posts (separate) - use POST /api/reanalyze or `npm run analyze`",
      note: "This two-step approach avoids timeouts and is much faster for large backfills",
    },
    subredditPresets: {
      primary: {
        description: "Full analysis for Webflow community",
        subreddits: ["webflow"],
      },
      mentions: {
        description: "Find Webflow mentions in broader web dev communities",
        subreddits: ["webdev", "web_design", "nocode"],
      },
      competitors: {
        description: "Monitor competitor/alternative platform discussions",
        subreddits: ["wordpress", "squarespace", "framer", "wix", "shopify", "Supabase"],
      },
    },
    examples: {
      maxBackfill: {
        description: "Fetch maximum recent posts from r/webflow",
        body: {
          pages: 10,
          postsPerPage: 100,
          subreddit: "webflow",
        },
      },
      quickBackfill: {
        description: "Quick backfill of recent posts from r/webflow",
        body: {
          pages: 5,
          postsPerPage: 100,
          subreddit: "webflow",
        },
      },
      webdevMentions: {
        description: "Find Webflow mentions in r/webdev (only analyze Webflow-related)",
        body: {
          pages: 5,
          postsPerPage: 100,
          subreddit: "webdev",
          analyzeAll: false,
        },
      },
      framerPulse: {
        description: "Full pulse of r/framer (analyze all posts)",
        body: {
          pages: 3,
          postsPerPage: 100,
          subreddit: "framer",
          analyzeAll: true,
        },
      },
    },
    limitation: "Reddit API only allows access to ~1000 most recent posts. Date-filtered search is not available via Arcade. Posts already in the database will be skipped.",
  });
};
