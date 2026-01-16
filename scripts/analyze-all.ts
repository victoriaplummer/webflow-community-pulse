#!/usr/bin/env npx tsx
/**
 * CLI script to analyze posts that weren't analyzed during backfill
 *
 * Usage:
 *   npx tsx scripts/analyze-all.ts [options]
 *
 * Options:
 *   --url <url>        Base URL (default: http://localhost:4321/pulse)
 *   --subreddit <s>    Filter to specific subreddit (optional)
 *   --batch <n>        Batch size per request (default: 25, max: 50)
 *   --limit <n>        Total posts to analyze (default: unlimited)
 *   --force            Re-analyze ALL posts, not just unanalyzed ones
 *   --dry-run          Show what would be done without making requests
 *   --cookie <cookie>  Session cookie for authentication
 *   --delay <ms>       Delay between batches in ms (default: 1000)
 *
 * Examples:
 *   npx tsx scripts/analyze-all.ts --cookie "pulse_session=abc123"
 *   npx tsx scripts/analyze-all.ts --subreddit webdev --batch 25
 *   npx tsx scripts/analyze-all.ts --force --subreddit framer --limit 100
 */

interface ReanalyzeResult {
  success?: boolean;
  error?: string;
  message?: string;
  analyzed?: number;
  errors?: number;
  foundPosts?: number;
}

// Parse command line arguments
function parseArgs(): {
  url: string;
  subreddit: string | null;
  batch: number;
  limit: number;
  force: boolean;
  dryRun: boolean;
  cookie: string;
  delay: number;
} {
  const args = process.argv.slice(2);
  const options = {
    url: "http://localhost:4321/pulse",
    subreddit: null as string | null,
    batch: 25,
    limit: Infinity,
    force: false,
    dryRun: false,
    cookie: "",
    delay: 1000,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--url":
        options.url = args[++i];
        break;
      case "--subreddit":
        options.subreddit = args[++i];
        break;
      case "--batch":
        options.batch = Math.min(parseInt(args[++i]) || 25, 50);
        break;
      case "--limit":
        options.limit = parseInt(args[++i]) || Infinity;
        break;
      case "--force":
        options.force = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--cookie":
        options.cookie = args[++i];
        break;
      case "--delay":
        options.delay = parseInt(args[++i]) || 1000;
        break;
      case "--help":
      case "-h":
        console.log(`
Analyze Posts CLI

Analyzes posts that weren't analyzed during backfill (have default values).

Usage:
  npx tsx scripts/analyze-all.ts [options]

Options:
  --url <url>        Base URL (default: http://localhost:4321/pulse)
  --subreddit <s>    Filter to specific subreddit (optional, analyzes all if not set)
  --batch <n>        Batch size per request (default: 25, max: 50)
  --limit <n>        Total posts to analyze (default: unlimited)
  --force            Re-analyze ALL posts, even already-analyzed ones
  --dry-run          Show what would be done without making requests
  --cookie <cookie>  Session cookie for authentication (required)
  --delay <ms>       Delay between batches in ms (default: 1000)
  --help, -h         Show this help message

What gets analyzed:
  By default, only posts that appear unanalyzed:
  - Low confidence scores (< 0.5)
  - Missing sentiment/classification
  - Default "general" topic with no audience relevance

  Use --force to re-analyze everything.

Examples:
  # Analyze all unanalyzed posts
  npx tsx scripts/analyze-all.ts --cookie "pulse_session=..."

  # Analyze only r/webdev posts
  npx tsx scripts/analyze-all.ts --subreddit webdev --cookie "..."

  # Re-analyze all r/framer posts (even already analyzed)
  npx tsx scripts/analyze-all.ts --force --subreddit framer --cookie "..."

  # Smaller batches with longer delays (safer for production)
  npx tsx scripts/analyze-all.ts --batch 10 --delay 2000 --cookie "..."

Note: Run against local dev server (npm run dev) for no timeout limits.
`);
        process.exit(0);
    }
  }

  return options;
}

// Progress bar helper
function progressBar(current: number, total: number, width = 30): string {
  if (total === 0 || !isFinite(total)) {
    // Unknown total - show spinner-style bar
    const pos = current % width;
    const bar = "░".repeat(pos) + "█" + "░".repeat(width - pos - 1);
    return `[${bar}] ${current} analyzed`;
  }
  const percent = Math.min(current / total, 1);
  const filled = Math.round(width * percent);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `[${bar}] ${current}/${total}`;
}

// Format duration
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

// Analyze a batch of posts
async function analyzeBatch(
  baseUrl: string,
  subreddit: string | null,
  limit: number,
  force: boolean,
  cookie: string
): Promise<ReanalyzeResult> {
  const url = `${baseUrl}/api/reanalyze`;

  const body: Record<string, unknown> = {
    limit,
    forceAll: force,
  };
  if (subreddit) {
    body.subreddit = subreddit;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookie,
    },
    body: JSON.stringify(body),
  });

  return response.json() as Promise<ReanalyzeResult>;
}

// Main execution
async function main() {
  const options = parseArgs();

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║           Community Pulse - Analyze Posts Script           ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  console.log(`Base URL:      ${options.url}`);
  console.log(`Subreddit:     ${options.subreddit || "all"}`);
  console.log(`Batch size:    ${options.batch}`);
  console.log(`Limit:         ${isFinite(options.limit) ? options.limit : "unlimited"}`);
  console.log(`Force re-analyze: ${options.force}`);
  console.log(`Delay:         ${options.delay}ms between batches`);
  console.log(`Dry run:       ${options.dryRun}`);
  console.log("");

  if (!options.cookie && !options.dryRun) {
    console.error("Error: --cookie is required for authentication.");
    console.error("Get your session cookie from browser DevTools after logging in.");
    console.error("Run with --help for more information.\n");
    process.exit(1);
  }

  const startTime = Date.now();
  let totalAnalyzed = 0;
  let totalErrors = 0;
  let totalFound = 0;
  let batchNumber = 0;
  let continueProcessing = true;

  console.log("─".repeat(60));
  console.log("");

  while (continueProcessing) {
    batchNumber++;
    const remainingLimit = Math.min(options.batch, options.limit - totalAnalyzed);

    if (remainingLimit <= 0) {
      console.log("\nReached specified limit.");
      break;
    }

    process.stdout.write(`\r${progressBar(totalAnalyzed, isFinite(options.limit) ? options.limit : 0)} Batch ${batchNumber}...`);

    if (options.dryRun) {
      console.log(` [DRY RUN - would analyze up to ${remainingLimit} posts]`);
      // Simulate finding some posts
      if (batchNumber >= 3) {
        console.log("\n[DRY RUN complete - would continue until no more posts found]");
        break;
      }
      await new Promise(r => setTimeout(r, 100));
      totalAnalyzed += remainingLimit;
      continue;
    }

    const batchStartTime = Date.now();

    try {
      const result = await analyzeBatch(
        options.url,
        options.subreddit,
        remainingLimit,
        options.force,
        options.cookie
      );

      const duration = formatDuration(Date.now() - batchStartTime);

      if (result.error) {
        console.log(`\n   Error: ${result.error}`);
        totalErrors++;
        continueProcessing = false;
      } else if (result.success) {
        const analyzed = result.analyzed || 0;
        const errors = result.errors || 0;
        const found = result.foundPosts || 0;

        totalAnalyzed += analyzed;
        totalErrors += errors;
        totalFound += found;

        if (found === 0) {
          console.log(`\n   No more posts to analyze.`);
          continueProcessing = false;
        } else {
          console.log(`\n   Batch ${batchNumber}: ${analyzed} analyzed, ${errors} errors (${duration})`);

          // If we found fewer posts than requested, we're done
          if (found < remainingLimit) {
            console.log(`   No more unanalyzed posts found.`);
            continueProcessing = false;
          }
        }
      }
    } catch (err) {
      console.log(`\n   Failed: ${err}`);
      totalErrors++;
      continueProcessing = false;
    }

    // Delay between batches
    if (continueProcessing) {
      await new Promise(r => setTimeout(r, options.delay));
    }
  }

  // Final summary
  console.log("");
  console.log("─".repeat(60));
  console.log("");

  const totalDuration = formatDuration(Date.now() - startTime);

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                         Summary                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`  Total time:      ${totalDuration}`);
  console.log(`  Batches run:     ${batchNumber}`);
  console.log(`  Posts analyzed:  ${totalAnalyzed}`);
  console.log(`  Errors:          ${totalErrors}`);
  console.log("");
}

main().catch(console.error);
