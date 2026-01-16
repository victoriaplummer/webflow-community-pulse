import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";
import { Download, Loader2, CheckCircle, AlertCircle, Info, Globe, RefreshCw } from "lucide-react";

// Subreddit presets organized by category
const SUBREDDIT_PRESETS = {
  primary: {
    label: "Primary",
    description: "Full analysis for Webflow community",
    subreddits: [
      { value: "webflow", label: "r/webflow", description: "Main Webflow community" },
    ],
  },
  mentions: {
    label: "Find Webflow Mentions",
    description: "Broader web dev communities",
    subreddits: [
      { value: "webdev", label: "r/webdev", description: "Web developers" },
      { value: "web_design", label: "r/web_design", description: "Web designers" },
      { value: "nocode", label: "r/nocode", description: "No-code enthusiasts" },
    ],
  },
  competitors: {
    label: "Competitor Platforms",
    description: "Monitor alternative platforms",
    subreddits: [
      { value: "framer", label: "r/framer", description: "Framer users" },
      { value: "wordpress", label: "r/wordpress", description: "WordPress users" },
      { value: "squarespace", label: "r/squarespace", description: "Squarespace users" },
      { value: "wix", label: "r/wix", description: "Wix users" },
      { value: "shopify", label: "r/shopify", description: "Shopify users" },
      { value: "Supabase", label: "r/Supabase", description: "Supabase users" },
    ],
  },
};

interface BackfillResults {
  processed: number;
  skipped: number;
  errors: number;
  pages: number;
  oldestPostDate: string | null;
  newestPostDate: string | null;
  paginationLimited?: boolean;
}

interface BackfillResponse {
  success?: boolean;
  results?: BackfillResults;
  message?: string;
  error?: string;
  requiresAuth?: boolean;
  authUrl?: string;
}

interface ReanalyzeResponse {
  success?: boolean;
  message?: string;
  analyzed?: number;
  errors?: number;
  foundPosts?: number;
  error?: string;
}

export function BackfillPanel() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BackfillResponse | null>(null);
  const [pages, setPages] = useState("10");
  const [postsPerPage, setPostsPerPage] = useState("100");
  const [listing, setListing] = useState("new");
  const [timeRange, setTimeRange] = useState("THIS_MONTH");
  const [subreddit, setSubreddit] = useState("webflow");
  const [customSubreddit, setCustomSubreddit] = useState("");
  const [analyzeAll, setAnalyzeAll] = useState(false);

  // Re-analyze state
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeResults, setReanalyzeResults] = useState<ReanalyzeResponse | null>(null);

  // Check if we're using a custom subreddit
  const isCustomSubreddit = subreddit === "custom";
  const effectiveSubreddit = isCustomSubreddit ? customSubreddit : subreddit;
  const isPrimarySubreddit = effectiveSubreddit.toLowerCase() === "webflow";

  const handleBackfill = async () => {
    if (!effectiveSubreddit) {
      setResults({ error: "Please enter a subreddit name" });
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const body: Record<string, unknown> = {
        pages: parseInt(pages),
        postsPerPage: parseInt(postsPerPage),
        subreddit: effectiveSubreddit,
        listing,
        analyzeAll: !isPrimarySubreddit && analyzeAll,
      };
      // Only include timeRange for top/controversial
      if (listing === "top" || listing === "controversial") {
        body.timeRange = timeRange;
      }

      const response = await fetch("/pulse/api/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      setResults(data);
    } catch (error) {
      setResults({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleReanalyze = async () => {
    if (!effectiveSubreddit) {
      setReanalyzeResults({ error: "Please select a subreddit first" });
      return;
    }

    setReanalyzing(true);
    setReanalyzeResults(null);

    try {
      const response = await fetch("/pulse/api/reanalyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subreddit: effectiveSubreddit,
          limit: 50,
        }),
      });

      const data = await response.json();
      setReanalyzeResults(data);
    } catch (error) {
      setReanalyzeResults({ error: String(error) });
    } finally {
      setReanalyzing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-500" />
          <CardTitle>Backfill Posts</CardTitle>
        </div>
        <CardDescription>
          Import posts from Reddit communities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Subreddit Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Subreddit</label>
          <Select value={subreddit} onValueChange={(value) => {
            setSubreddit(value);
            // Reset analyzeAll when switching to primary
            if (value === "webflow") {
              setAnalyzeAll(false);
            }
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Select a subreddit" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SUBREDDIT_PRESETS).map(([key, category]) => (
                <SelectGroup key={key}>
                  <SelectLabel className="text-xs text-muted-foreground">{category.label}</SelectLabel>
                  {category.subreddits.map((sub) => (
                    <SelectItem key={sub.value} value={sub.value}>
                      {sub.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
              <SelectGroup>
                <SelectLabel className="text-xs text-muted-foreground">Other</SelectLabel>
                <SelectItem value="custom">Custom subreddit...</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Custom subreddit input */}
          {isCustomSubreddit && (
            <Input
              placeholder="Enter subreddit name (without r/)"
              value={customSubreddit}
              onChange={(e) => setCustomSubreddit(e.target.value.replace(/^r\//, ""))}
              className="mt-2"
            />
          )}
        </div>

        {/* Analyze All toggle - only show for non-primary subreddits */}
        {!isPrimarySubreddit && effectiveSubreddit && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <input
              type="checkbox"
              id="analyzeAll"
              checked={analyzeAll}
              onChange={(e) => setAnalyzeAll(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300"
            />
            <div className="space-y-1">
              <label htmlFor="analyzeAll" className="text-sm font-medium text-amber-800 dark:text-amber-200 cursor-pointer">
                Analyze all posts (Full community pulse)
              </label>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {analyzeAll
                  ? "All posts will be analyzed with Claude. This uses more API credits but gives you full visibility into the community."
                  : "Only posts mentioning Webflow or related topics will be analyzed. Faster and uses fewer credits."}
              </p>
            </div>
          </div>
        )}

        {/* Tip */}
        <div className="flex gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-400">
            <strong>Tip:</strong> Use "Top" + "All Time" to fetch older high-engagement posts.
            Posts already in the database will be skipped.
          </p>
        </div>

        {/* Listing Type & Time Range */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Sort by</label>
            <Select value={listing} onValueChange={setListing}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New (most recent)</SelectItem>
                <SelectItem value="hot">Hot</SelectItem>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="rising">Rising</SelectItem>
                <SelectItem value="controversial">Controversial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Time range</label>
            <Select
              value={timeRange}
              onValueChange={setTimeRange}
              disabled={listing !== "top" && listing !== "controversial"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NOW">Now</SelectItem>
                <SelectItem value="TODAY">Today</SelectItem>
                <SelectItem value="THIS_WEEK">This Week</SelectItem>
                <SelectItem value="THIS_MONTH">This Month</SelectItem>
                <SelectItem value="THIS_YEAR">This Year</SelectItem>
                <SelectItem value="ALL_TIME">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pagination Options */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Pages to fetch</label>
            <Select value={pages} onValueChange={setPages}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 pages</SelectItem>
                <SelectItem value="10">10 pages (recommended)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Posts per page</label>
            <Select value={postsPerPage} onValueChange={setPostsPerPage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 posts</SelectItem>
                <SelectItem value="50">50 posts</SelectItem>
                <SelectItem value="100">100 posts (max)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Will attempt to fetch up to {parseInt(pages) * parseInt(postsPerPage)} posts from r/{effectiveSubreddit || "..."}
          ({pages} pages × {postsPerPage} posts per page)
        </p>

        {/* Submit Button */}
        <Button
          onClick={handleBackfill}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Backfilling...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Start Backfill
            </>
          )}
        </Button>

        {/* Results */}
        {results && (
          <div className="mt-4 p-4 rounded-lg bg-muted/50 space-y-3">
            {results.error ? (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-medium">{results.error}</span>
              </div>
            ) : results.requiresAuth ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-orange-600">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">Reddit authorization required</span>
                </div>
                <a
                  href={results.authUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-orange-600 text-white hover:bg-orange-700 h-9 px-4"
                >
                  Authorize Reddit
                </a>
              </div>
            ) : results.success && results.results ? (
              <>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">Backfill complete!</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-background rounded">
                    <div className="text-2xl font-bold text-green-600">
                      {results.results.processed}
                    </div>
                    <div className="text-xs text-muted-foreground">Processed</div>
                  </div>
                  <div className="p-2 bg-background rounded">
                    <div className="text-2xl font-bold text-yellow-600">
                      {results.results.skipped}
                    </div>
                    <div className="text-xs text-muted-foreground">Skipped</div>
                  </div>
                  <div className="p-2 bg-background rounded">
                    <div className="text-2xl font-bold text-red-600">
                      {results.results.errors}
                    </div>
                    <div className="text-xs text-muted-foreground">Errors</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Pages fetched: {results.results.pages}</p>
                  {results.results.oldestPostDate && (
                    <p>
                      Date range: {new Date(results.results.oldestPostDate).toLocaleDateString()}
                      {" - "}
                      {results.results.newestPostDate && new Date(results.results.newestPostDate).toLocaleDateString()}
                    </p>
                  )}
                  {results.results.paginationLimited && (
                    <p className="text-amber-600">
                      Arcade API pagination limited - only ~100 posts can be fetched per session
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{results.message}</p>
            )}
          </div>
        )}

        {/* Re-analyze Section */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-medium">Re-analyze Posts</h4>
              <p className="text-xs text-muted-foreground">
                Analyze posts that were skipped or got default values
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReanalyze}
              disabled={reanalyzing || !effectiveSubreddit}
            >
              {reanalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-analyze r/{effectiveSubreddit || "..."}
                </>
              )}
            </Button>
          </div>

          {reanalyzeResults && (
            <div className="p-3 rounded-lg bg-muted/50">
              {reanalyzeResults.error ? (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{reanalyzeResults.error}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">
                    {reanalyzeResults.message}
                    {reanalyzeResults.errors ? ` (${reanalyzeResults.errors} errors)` : ""}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
