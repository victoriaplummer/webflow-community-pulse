import type { APIRoute } from "astro";
import { getDb } from "../../../db/getDb";
import { contentItems, authors } from "../../../db/schema";
import { sql } from "drizzle-orm";

/**
 * Admin endpoint to fix data issues
 * POST /api/admin/fix-data
 *
 * Body: { operation: string, dryRun?: boolean }
 *
 * Operations:
 * - fix-urls: Fix relative URLs (/r/...) to absolute URLs
 * - fix-subreddits: Update subreddit field based on URL
 * - count-issues: Count how many records need fixing
 */
export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const db = getDb(locals);
  const body = await request.json();
  const { operation, dryRun = false } = body;

  const results = {
    operation,
    dryRun,
    affected: 0,
    details: {} as Record<string, any>,
  };

  try {
    switch (operation) {
      case "count-issues": {
        // Count relative URLs
        const [relativeUrls] = await db
          .select({ count: sql<number>`count(*)` })
          .from(contentItems)
          .where(sql`${contentItems.url} LIKE '/r/%'`);

        // Count potential subreddit mismatches
        const [subredditMismatches] = await db
          .select({ count: sql<number>`count(*)` })
          .from(contentItems)
          .where(sql`
            ${contentItems.platform} = 'reddit'
            AND ${contentItems.subreddit} IS NOT NULL
            AND ${contentItems.url} NOT LIKE '%/r/' || ${contentItems.subreddit} || '/%'
          `);

        results.details = {
          relativeUrls: relativeUrls.count,
          subredditMismatches: subredditMismatches.count,
        };
        break;
      }

      case "fix-urls": {
        if (dryRun) {
          // Show what would be fixed
          const preview = await db
            .select({
              id: contentItems.id,
              platformId: contentItems.platformId,
              subreddit: contentItems.subreddit,
              url: contentItems.url,
            })
            .from(contentItems)
            .where(sql`${contentItems.url} LIKE '/r/%'`)
            .limit(10);

          results.details = {
            preview,
            message: "Dry run - no changes made",
          };
        } else {
          // Fix relative URLs by prepending https://reddit.com
          const result = await db
            .update(contentItems)
            .set({
              url: sql`'https://reddit.com' || ${contentItems.url}`,
            })
            .where(sql`${contentItems.url} LIKE '/r/%'`)
            .returning({ id: contentItems.id });

          results.affected = result.length;
          results.details = {
            message: `Fixed ${result.length} URLs`,
            sampleIds: result.slice(0, 5).map((r) => r.id),
          };
        }
        break;
      }

      case "fix-subreddits": {
        // Extract subreddit from URL and update the field
        // URL format: https://reddit.com/r/SUBREDDIT/comments/...
        if (dryRun) {
          const preview = await db
            .select({
              id: contentItems.id,
              platformId: contentItems.platformId,
              currentSubreddit: contentItems.subreddit,
              url: contentItems.url,
            })
            .from(contentItems)
            .where(sql`
              ${contentItems.platform} = 'reddit'
              AND ${contentItems.subreddit} IS NOT NULL
              AND ${contentItems.url} NOT LIKE '%/r/' || ${contentItems.subreddit} || '/%'
            `)
            .limit(10);

          results.details = {
            preview,
            message: "Dry run - no changes made",
          };
        } else {
          // SQLite string manipulation to extract subreddit from URL
          // URL: https://reddit.com/r/webflow/comments/...
          // Extract: webflow
          const result = await db.execute(sql`
            UPDATE ${contentItems}
            SET subreddit = (
              SELECT SUBSTR(
                ${contentItems.url},
                INSTR(${contentItems.url}, '/r/') + 3,
                INSTR(
                  SUBSTR(${contentItems.url}, INSTR(${contentItems.url}, '/r/') + 3),
                  '/'
                ) - 1
              )
            )
            WHERE ${contentItems.platform} = 'reddit'
            AND ${contentItems.url} LIKE '%/r/%/comments/%'
            AND (
              ${contentItems.subreddit} IS NULL
              OR ${contentItems.url} NOT LIKE '%/r/' || ${contentItems.subreddit} || '/%'
            )
          `);

          results.affected = result.rowsAffected || 0;
          results.details = {
            message: `Fixed ${result.rowsAffected} subreddit tags`,
          };
        }
        break;
      }

      case "fix-all": {
        if (dryRun) {
          return Response.json({
            error: "Use individual operations with dryRun=true to preview changes",
          }, { status: 400 });
        }

        // Run all fixes in sequence
        const urlFix = await db
          .update(contentItems)
          .set({
            url: sql`'https://reddit.com' || ${contentItems.url}`,
          })
          .where(sql`${contentItems.url} LIKE '/r/%'`)
          .returning({ id: contentItems.id });

        const subredditFix = await db.execute(sql`
          UPDATE ${contentItems}
          SET subreddit = (
            SELECT SUBSTR(
              ${contentItems.url},
              INSTR(${contentItems.url}, '/r/') + 3,
              INSTR(
                SUBSTR(${contentItems.url}, INSTR(${contentItems.url}, '/r/') + 3),
                '/'
              ) - 1
            )
          )
          WHERE ${contentItems.platform} = 'reddit'
          AND ${contentItems.url} LIKE '%/r/%/comments/%'
          AND (
            ${contentItems.subreddit} IS NULL
            OR ${contentItems.url} NOT LIKE '%/r/' || ${contentItems.subreddit} || '/%'
          )
        `);

        results.affected = urlFix.length + (subredditFix.rowsAffected || 0);
        results.details = {
          urlsFixed: urlFix.length,
          subredditsFixed: subredditFix.rowsAffected || 0,
        };
        break;
      }

      default:
        return Response.json(
          { error: `Unknown operation: ${operation}` },
          { status: 400 }
        );
    }

    return Response.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Fix data error:", error);
    return Response.json(
      { error: "Failed to fix data", details: String(error) },
      { status: 500 }
    );
  }
};

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  return Response.json({
    message: "Data fix admin endpoint",
    usage: {
      endpoint: "POST /api/admin/fix-data",
      operations: [
        {
          operation: "count-issues",
          description: "Count records that need fixing",
          example: { operation: "count-issues" },
        },
        {
          operation: "fix-urls",
          description: "Fix relative URLs to absolute URLs",
          example: { operation: "fix-urls", dryRun: true },
        },
        {
          operation: "fix-subreddits",
          description: "Extract and fix subreddit tags from URLs",
          example: { operation: "fix-subreddits", dryRun: true },
        },
        {
          operation: "fix-all",
          description: "Run all fixes (no dry run option)",
          example: { operation: "fix-all" },
        },
      ],
      notes: [
        "Always run with dryRun: true first to preview changes",
        "Operations are idempotent - safe to run multiple times",
      ],
    },
  });
};
