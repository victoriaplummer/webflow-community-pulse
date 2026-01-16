#!/usr/bin/env npx tsx
/**
 * CLI script to backfill posts from all configured subreddits
 *
 * Usage:
 *   npx tsx scripts/backfill-all.ts [options]
 *
 * Options:
 *   --url <url>        Base URL (default: http://localhost:4321/pulse)
 *   --pages <n>        Pages per subreddit (default: 10, max: 10)
 *   --analyze-all      Analyze all posts, not just Webflow-related
 *   --subreddits <s>   Comma-separated list of subreddits (default: all)
 *   --dry-run          Show what would be done without making requests
 *   --cookie <cookie>  Session cookie for authentication
 *   --safe             Use smaller batches to avoid timeouts (3 pages instead of 10)
 *   --delay <ms>       Delay between subreddits in ms (default: 2000)
 *
 * Timeout Prevention:
 *   The Cloudflare Worker has a CPU time limit. Each Claude analysis takes 1-3s.
 *   To avoid timeouts:
 *   - Use --safe for smaller batches (3 pages = ~300 posts max)
 *   - Use --pages 5 for medium batches
 *   - Don't use --analyze-all on large subreddits
 *   - Run against local dev server (npm run dev) which has no timeout
 *
 * Examples:
 *   npx tsx scripts/backfill-all.ts --cookie "session=abc123"
 *   npx tsx scripts/backfill-all.ts --subreddits webflow,framer --pages 5
 *   npx tsx scripts/backfill-all.ts --safe --cookie "..."  # Smaller batches
 *   npx tsx scripts/backfill-all.ts --url https://your-app.webflow.io/pulse
 */

// Subreddit configuration matching BackfillPanel.tsx
const SUBREDDIT_CONFIG = {
  primary: {
    label: "Primary",
    subreddits: ["webflow"],
    analyzeAll: false, // Always fully analyzed since it's the main subreddit
  },
  mentions: {
    label: "Find Webflow Mentions",
    subreddits: ["webdev", "web_design", "nocode"],
    analyzeAll: false, // Only analyze Webflow-related posts
  },
  competitors: {
    label: "Competitor Platforms",
    subreddits: ["framer", "wordpress", "squarespace", "wix", "shopify", "Supabase"],
    analyzeAll: false, // Only analyze Webflow-related posts by default
  },
};

// Get all subreddits in order
const ALL_SUBREDDITS = [
  ...SUBREDDIT_CONFIG.primary.subreddits,
  ...SUBREDDIT_CONFIG.mentions.subreddits,
  ...SUBREDDIT_CONFIG.competitors.subreddits,
];

interface BackfillResult {
  success?: boolean;
  error?: string;
  requiresAuth?: boolean;
  authUrl?: string;
  results?: {
    processed: number;
    skipped: number;
    errors: number;
    pages: number;
    oldestPostDate: string | null;
    newestPostDate: string | null;
    paginationLimited?: boolean;
  };
  message?: string;
}

// Parse command line arguments
function parseArgs(): {
  url: string;
  pages: number;
  analyzeAll: boolean;
  subreddits: string[];
  dryRun: boolean;
  cookie: string;
  delay: number;
} {
  const args = process.argv.slice(2);
  const options = {
    url: "http://localhost:4321/pulse",
    pages: 10,
    analyzeAll: false,
    subreddits: ALL_SUBREDDITS,
    dryRun: false,
    cookie: "",
    delay: 2000,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--url":
        options.url = args[++i];
        break;
      case "--pages":
        options.pages = Math.min(parseInt(args[++i]) || 10, 10);
        break;
      case "--analyze-all":
        options.analyzeAll = true;
        break;
      case "--subreddits":
        options.subreddits = args[++i].split(",").map(s => s.trim());
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--cookie":
        options.cookie = args[++i];
        break;
      case "--safe":
        options.pages = 3; // Smaller batches to avoid timeouts
        options.delay = 3000; // Longer delay between subreddits
        break;
      case "--delay":
        options.delay = parseInt(args[++i]) || 2000;
        break;
      case "--help":
      case "-h":
        console.log(`
Backfill All Subreddits CLI

Usage:
  npx tsx scripts/backfill-all.ts [options]

Options:
  --url <url>        Base URL (default: http://localhost:4321/pulse)
  --pages <n>        Pages per subreddit (default: 10, max: 10)
  --analyze-all      Analyze all posts with Claude, not just Webflow-related
  --subreddits <s>   Comma-separated list of subreddits (default: all)
  --dry-run          Show what would be done without making requests
  --cookie <cookie>  Session cookie for authentication (required)
  --safe             Use smaller batches (3 pages) to avoid Worker timeouts
  --delay <ms>       Delay between subreddits in ms (default: 2000)
  --help, -h         Show this help message

Timeout Prevention:
  Cloudflare Workers have CPU time limits. For large backfills:
  - Use --safe for smaller batches (3 pages = ~300 posts max)
  - Run against local dev server (no timeout): npm run dev
  - Avoid --analyze-all on large subreddits

Configured subreddits:
  Primary:     ${SUBREDDIT_CONFIG.primary.subreddits.join(", ")}
  Mentions:    ${SUBREDDIT_CONFIG.mentions.subreddits.join(", ")}
  Competitors: ${SUBREDDIT_CONFIG.competitors.subreddits.join(", ")}

Examples:
  # Backfill all subreddits (requires running dev server)
  npm run dev  # In another terminal
  npx tsx scripts/backfill-all.ts --cookie "session=your-session-cookie"

  # Backfill only specific subreddits
  npx tsx scripts/backfill-all.ts --subreddits webflow,framer --pages 5 --cookie "..."

  # Dry run to see what would happen
  npx tsx scripts/backfill-all.ts --dry-run

Note: You need to get your session cookie from the browser after logging in.
      Open DevTools > Application > Cookies and copy the session cookie value.
`);
        process.exit(0);
    }
  }

  return options;
}

// Progress bar helper
function progressBar(current: number, total: number, width = 30): string {
  const percent = current / total;
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

// Main backfill function
async function backfillSubreddit(
  baseUrl: string,
  subreddit: string,
  pages: number,
  analyzeAll: boolean,
  cookie: string
): Promise<BackfillResult> {
  const url = `${baseUrl}/api/backfill`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookie,
    },
    body: JSON.stringify({
      subreddit,
      pages,
      postsPerPage: 100,
      listing: "new",
      analyzeAll: subreddit.toLowerCase() !== "webflow" && analyzeAll,
    }),
  });

  return response.json() as Promise<BackfillResult>;
}

// Main execution
async function main() {
  const options = parseArgs();

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║           Community Pulse - Bulk Backfill Script           ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  console.log(`Base URL:      ${options.url}`);
  console.log(`Pages/sub:     ${options.pages} (up to ${options.pages * 100} posts)`);
  console.log(`Delay:         ${options.delay}ms between subreddits`);
  console.log(`Analyze all:   ${options.analyzeAll}`);
  console.log(`Subreddits:    ${options.subreddits.join(", ")}`);
  console.log(`Dry run:       ${options.dryRun}`);
  console.log("");

  if (!options.cookie && !options.dryRun) {
    console.error("Error: --cookie is required for authentication.");
    console.error("Get your session cookie from browser DevTools after logging in.");
    console.error("Run with --help for more information.\n");
    process.exit(1);
  }

  const totalSubreddits = options.subreddits.length;
  const startTime = Date.now();

  const totals = {
    processed: 0,
    skipped: 0,
    errors: 0,
  };

  console.log("─".repeat(60));
  console.log("");

  for (let i = 0; i < options.subreddits.length; i++) {
    const subreddit = options.subreddits[i];
    const progress = progressBar(i, totalSubreddits);

    // Clear line and show progress
    process.stdout.write(`\r${progress} Processing r/${subreddit}...`);
    process.stdout.write(" ".repeat(20)); // Clear any leftover text
    process.stdout.write(`\r${progress} Processing r/${subreddit}...`);

    if (options.dryRun) {
      console.log(` [DRY RUN - would fetch ${options.pages * 100} posts]`);
      await new Promise(r => setTimeout(r, 100));
      continue;
    }

    const subStartTime = Date.now();

    try {
      const result = await backfillSubreddit(
        options.url,
        subreddit,
        options.pages,
        options.analyzeAll,
        options.cookie
      );

      const duration = formatDuration(Date.now() - subStartTime);

      if (result.requiresAuth) {
        console.log(`\n   Auth required! Visit: ${result.authUrl}`);
        console.log("   Authorize Reddit access and try again.\n");
        process.exit(1);
      }

      if (result.error) {
        console.log(`\n   Error: ${result.error}`);
        totals.errors++;
      } else if (result.success && result.results) {
        const r = result.results;
        totals.processed += r.processed;
        totals.skipped += r.skipped;
        totals.errors += r.errors;

        console.log(`\n   Done in ${duration}: ${r.processed} new, ${r.skipped} skipped, ${r.errors} errors`);
        if (r.oldestPostDate && r.newestPostDate) {
          const oldest = new Date(r.oldestPostDate).toLocaleDateString();
          const newest = new Date(r.newestPostDate).toLocaleDateString();
          console.log(`   Date range: ${oldest} - ${newest}`);
        }
        if (r.paginationLimited) {
          console.log(`   (Pagination limited by Arcade API)`);
        }
      }
    } catch (err) {
      console.log(`\n   Failed: ${err}`);
      totals.errors++;
    }

    // Delay between subreddits to avoid rate limiting
    if (i < options.subreddits.length - 1) {
      const delaySeconds = options.delay / 1000;
      process.stdout.write(`   Waiting ${delaySeconds}s before next subreddit...`);
      await new Promise(r => setTimeout(r, options.delay));
      process.stdout.write("\r" + " ".repeat(50) + "\r");
    }
  }

  // Final progress
  console.log("");
  console.log(progressBar(totalSubreddits, totalSubreddits) + " Complete!");
  console.log("");
  console.log("─".repeat(60));
  console.log("");

  const totalDuration = formatDuration(Date.now() - startTime);

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                         Summary                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`  Total time:      ${totalDuration}`);
  console.log(`  Posts processed: ${totals.processed}`);
  console.log(`  Posts skipped:   ${totals.skipped}`);
  console.log(`  Errors:          ${totals.errors}`);
  console.log("");
}

main().catch(console.error);
