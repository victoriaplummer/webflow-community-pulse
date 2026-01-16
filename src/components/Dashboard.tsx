import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import {
  Activity,
  Users,
  FileText,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Link as LinkIcon,
  LogOut,
  HelpCircle,
  Lightbulb,
  Sparkles,
  Star,
  X,
  Filter,
} from "lucide-react";
import { StarButton } from "./StarButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  formatRelativeTime,
  getClassificationColor,
  getClassificationLabel,
  getSentimentColor,
  truncateText,
} from "../lib/utils";

interface UserInfo {
  id: number;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

interface StatsData {
  overview: {
    totalContent: number;
    totalAuthors: number;
    contentToday: number;
    webflowContent: number;
    needsReview: number;
  };
  sentiment: Record<string, number>;
  classification: Record<string, number>;
  topic: Record<string, number>;
  subreddits: Array<{ subreddit: string; count: number }>;
  topContributors: Array<{
    id: number;
    username: string;
    platform: string;
    postCount: number;
    highQualityCount: number;
    contributorScore: number;
  }>;
  risingContributors: Array<{
    id: number;
    username: string;
    platform: string;
    postCount: number;
    highQualityCount: number;
  }>;
  highEngagement: Array<{
    id: number;
    title: string;
    url: string;
    subreddit: string;
    engagementScore: number;
    classification: string;
  }>;
  latestSummary: {
    content: {
      keyInsights?: string[];
      opportunities?: Array<{
        type: string;
        description: string;
        priority: string;
      }>;
    };
    generatedAt: number;
  } | null;
  timestamp: string;
}

interface AuthRequired {
  requiresAuth: true;
  authUrl: string;
  authId: string;
  message: string;
}

interface FaqPost {
  id: number;
  title: string;
  summary: string;
  url: string;
  questionCategory: string | null;
  suggestedResource: string | null;
  qualityScore: number | null;
  engagementScore: number | null;
  createdAt: number;
}

interface FaqInsights {
  summary: {
    totalQuestions: number;
    totalFaqCandidates: number;
    faqPercentage: number;
    message: string;
  };
  faqByCategory: Array<{
    category: string;
    count: number;
    avgQuality: number;
  }>;
  recentFaqCandidates: FaqPost[];
  faqPostsByCategory: Record<string, FaqPost[]>;
  faqPostsByResource: Record<string, FaqPost[]>;
  resourceSuggestions: Array<{
    suggestedResource: string;
    count: number;
    category: string;
  }>;
}

interface ShowcaseData {
  showcases: Array<{
    id: number;
    title: string;
    summary: string;
    url: string;
    showcaseUrl: string | null;
    flair: string | null;
    qualityScore: number;
    engagementScore: number;
    authorUsername: string;
    createdAt: number;
    isRoundupCandidate: boolean;
  }>;
  stats: {
    total: number;
    avgQuality: number;
  };
}

export function Dashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [authRequired, setAuthRequired] = useState<AuthRequired | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [faqInsights, setFaqInsights] = useState<FaqInsights | null>(null);
  const [showcases, setShowcases] = useState<ShowcaseData | null>(null);
  const [selectedSubreddit, setSelectedSubreddit] = useState<string>("webflow");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");

  const fetchFaqInsights = async (subreddit?: string, topic?: string) => {
    try {
      const params = new URLSearchParams();
      if (subreddit && subreddit !== "all") {
        params.set("subreddit", subreddit);
      }
      if (topic && topic !== "all") {
        params.set("topic", topic);
      }
      const url = `/pulse/api/faq-insights${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setFaqInsights(data);
      }
    } catch (err) {
      console.error("Failed to fetch FAQ insights:", err);
    }
  };

  const fetchShowcases = async (subreddit?: string, topic?: string) => {
    try {
      const params = new URLSearchParams({ days: "30", limit: "10" });
      if (subreddit && subreddit !== "all") {
        params.set("subreddit", subreddit);
      }
      if (topic && topic !== "all") {
        params.set("topic", topic);
      }
      const response = await fetch(`/pulse/api/showcases?${params}`);
      if (response.ok) {
        const data = await response.json();
        setShowcases(data);
      }
    } catch (err) {
      console.error("Failed to fetch showcases:", err);
    }
  };

  const dismissShowcase = async (id: number) => {
    try {
      const response = await fetch("/pulse/api/showcases", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (response.ok) {
        // Remove from local state immediately
        setShowcases((prev) =>
          prev
            ? {
                ...prev,
                showcases: prev.showcases.filter((s) => s.id !== id),
                stats: { ...prev.stats, total: prev.stats.total - 1 },
              }
            : null
        );
      }
    } catch (err) {
      console.error("Failed to dismiss showcase:", err);
    }
  };

  const fetchUser = async () => {
    try {
      const response = await fetch("/pulse/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          setUser(data.user);
        }
      }
    } catch (err) {
      console.error("Failed to fetch user:", err);
    }
  };

  const handleLogout = async () => {
    window.location.href = "/pulse/api/auth/logout";
  };

  const fetchStats = async (subreddit?: string, topic?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (subreddit && subreddit !== "all") {
        params.set("subreddit", subreddit);
      }
      if (topic && topic !== "all") {
        params.set("topic", topic);
      }
      const url = `/pulse/api/stats${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubredditChange = (value: string) => {
    setSelectedSubreddit(value);
    fetchStats(value, selectedTopic);
    fetchFaqInsights(value, selectedTopic);
    fetchShowcases(value, selectedTopic);
  };

  const handleTopicChange = (value: string) => {
    setSelectedTopic(value);
    fetchStats(selectedSubreddit, value);
    fetchFaqInsights(selectedSubreddit, value);
    fetchShowcases(selectedSubreddit, value);
  };

  const triggerIngest = async () => {
    try {
      setTriggering(true);
      setAuthRequired(null);
      setError(null);

      const response = await fetch("/pulse/api/trigger", { method: "POST" });
      const data = await response.json();

      // Check if authorization is required
      if (response.status === 401 && data.requiresAuth) {
        setAuthRequired(data as AuthRequired);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to trigger ingest");
      }

      // Success - refresh stats
      await fetchStats(selectedSubreddit, selectedTopic);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trigger failed");
    } finally {
      setTriggering(false);
    }
  };

  useEffect(() => {
    fetchStats(selectedSubreddit, selectedTopic);
    fetchUser();
    fetchFaqInsights(selectedSubreddit, selectedTopic);
    fetchShowcases(selectedSubreddit, selectedTopic);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => fetchStats(selectedSubreddit, selectedTopic)}>Retry</Button>
      </div>
    );
  }

  if (!stats) return null;

  const totalSentiment =
    (stats.sentiment.positive || 0) +
    (stats.sentiment.neutral || 0) +
    (stats.sentiment.negative || 0);

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Community Pulse</h1>
          <p className="text-muted-foreground">
            Monitor Webflow community discussions across Reddit
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {/* Subreddit filter */}
            {stats && stats.subreddits && stats.subreddits.length > 0 && (
              <Select value={selectedSubreddit} onValueChange={handleSubredditChange}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Communities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Communities</SelectItem>
                  {stats.subreddits.map((sub) => (
                    <SelectItem key={sub.subreddit} value={sub.subreddit || ""}>
                      r/{sub.subreddit} ({sub.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* Topic filter */}
            {stats && stats.topic && Object.keys(stats.topic).length > 0 && (
              <Select value={selectedTopic} onValueChange={handleTopicChange}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Topics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Topics</SelectItem>
                  {Object.entries(stats.topic)
                    .sort((a, b) => b[1] - a[1])
                    .map(([topic, count]) => (
                      <SelectItem key={topic} value={topic}>
                        {topic.replace(/_/g, " ")} ({count})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {/* User info */}
          {user && (
            <div className="flex items-center gap-3">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || user.email}
                  className="h-8 w-8 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.name || user.email}
              </span>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { fetchStats(selectedSubreddit, selectedTopic); fetchFaqInsights(selectedSubreddit, selectedTopic); fetchShowcases(selectedSubreddit, selectedTopic); }} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={triggerIngest} disabled={triggering}>
              <Activity className={`h-4 w-4 mr-2 ${triggering ? "animate-pulse" : ""}`} />
              {triggering ? "Ingesting..." : "Ingest Now"}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Reddit Authorization Banner */}
      {authRequired && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-lg text-orange-800">Reddit Authorization Required</CardTitle>
            </div>
            <CardDescription className="text-orange-700">
              {authRequired.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <p className="text-sm text-orange-700">
                Click the button below to authorize access to Reddit. After authorizing, click "Ingest Now" again.
              </p>
              <a
                href={authRequired.authUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-orange-600 text-white hover:bg-orange-700 h-10 px-4 py-2 gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Authorize Reddit
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Content</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overview.totalContent}</div>
            <p className="text-xs text-muted-foreground">
              +{stats.overview.contentToday} today
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Webflow Related</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overview.webflowContent}</div>
            <p className="text-xs text-muted-foreground">Filtered high-signal content</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contributors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overview.totalAuthors}</div>
            <p className="text-xs text-muted-foreground">Unique authors tracked</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overview.needsReview}</div>
            <p className="text-xs text-muted-foreground">Low confidence items</p>
          </CardContent>
        </Card>
      </div>

      {/* Sentiment overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Sentiment (7 days)</CardTitle>
            <CardDescription>Webflow-related content sentiment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-20 text-sm">Positive</div>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-green-500 h-full"
                    style={{
                      width: `${totalSentiment > 0 ? ((stats.sentiment.positive || 0) / totalSentiment) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="w-12 text-right text-sm text-muted-foreground">
                  {stats.sentiment.positive || 0}
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-20 text-sm">Neutral</div>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-gray-400 h-full"
                    style={{
                      width: `${totalSentiment > 0 ? ((stats.sentiment.neutral || 0) / totalSentiment) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="w-12 text-right text-sm text-muted-foreground">
                  {stats.sentiment.neutral || 0}
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-20 text-sm">Negative</div>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-red-500 h-full"
                    style={{
                      width: `${totalSentiment > 0 ? ((stats.sentiment.negative || 0) / totalSentiment) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="w-12 text-right text-sm text-muted-foreground">
                  {stats.sentiment.negative || 0}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Top Contributors</CardTitle>
            <CardDescription>By contributor score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topContributors.map((contributor, i) => (
                <div key={contributor.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-4">{i + 1}.</span>
                    <a
                      href={`https://reddit.com/u/${contributor.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-sm hover:underline flex items-center gap-1"
                    >
                      {contributor.username}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {contributor.postCount} posts
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(contributor.contributorScore)} pts
                    </Badge>
                  </div>
                </div>
              ))}
              {stats.topContributors.length === 0 && (
                <p className="text-sm text-muted-foreground">No contributors yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Rising Contributors</CardTitle>
            <CardDescription>Active this week with quality posts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.risingContributors.map((contributor) => (
                <div key={contributor.id} className="flex items-center justify-between">
                  <a
                    href={`https://reddit.com/u/${contributor.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-sm hover:underline flex items-center gap-1"
                  >
                    {contributor.username}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <Badge variant="outline" className="text-xs">
                    {contributor.postCount} posts
                  </Badge>
                </div>
              ))}
              {stats.risingContributors.length === 0 && (
                <p className="text-sm text-muted-foreground">No rising contributors</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* High engagement content */}
      <Card>
        <CardHeader>
          <CardTitle>High Engagement Content</CardTitle>
          <CardDescription>Top performing Webflow-related posts this week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.highEngagement.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0"
              >
                <div className="space-y-1 flex-1 mr-4">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline flex items-center gap-1"
                  >
                    {truncateText(item.title || "(untitled)", 80)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      r/{item.subreddit}
                    </Badge>
                    <Badge className={`text-xs ${getClassificationColor(item.classification)}`}>
                      {getClassificationLabel(item.classification)}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{Math.round(item.engagementScore)}</div>
                  <div className="text-xs text-muted-foreground">engagement</div>
                </div>
              </div>
            ))}
            {stats.highEngagement.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No high engagement content yet. Trigger an ingest to get started.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* FAQ Insights */}
      {faqInsights && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-blue-500" />
                <CardTitle>FAQ Opportunities</CardTitle>
              </div>
              <CardDescription>
                {faqInsights.summary.message} - {faqInsights.summary.totalFaqCandidates} FAQ candidates from {faqInsights.summary.totalQuestions} questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(faqInsights.faqPostsByCategory).length > 0 ? (
                <Accordion type="multiple" className="w-full">
                  {Object.entries(faqInsights.faqPostsByCategory)
                    .sort((a, b) => b[1].length - a[1].length)
                    .slice(0, 8)
                    .map(([category, posts]) => (
                      <AccordionItem key={category} value={category}>
                        <AccordionTrigger className="text-sm py-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {category.replace(/_/g, " ")}
                            </Badge>
                            <span className="text-muted-foreground text-xs">
                              {posts.length} posts
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 pl-2">
                            {posts.slice(0, 5).map((post) => (
                              <div key={post.id} className="border-l-2 border-blue-200 pl-3 py-1">
                                <a
                                  href={post.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm hover:underline text-blue-600 flex items-center gap-1"
                                >
                                  {truncateText(post.title, 60)}
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                </a>
                                {post.summary && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {truncateText(post.summary, 80)}
                                  </p>
                                )}
                              </div>
                            ))}
                            {posts.length > 5 && (
                              <p className="text-xs text-muted-foreground pl-3">
                                + {posts.length - 5} more posts
                              </p>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                </Accordion>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No FAQ candidates yet. Ingest more content to see patterns.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                <CardTitle>Suggested Resources</CardTitle>
              </div>
              <CardDescription>
                Resources that could reduce repetitive questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(faqInsights.faqPostsByResource).length > 0 ? (
                <Accordion type="multiple" className="w-full">
                  {Object.entries(faqInsights.faqPostsByResource)
                    .sort((a, b) => b[1].length - a[1].length)
                    .slice(0, 8)
                    .map(([resource, posts]) => (
                      <AccordionItem key={resource} value={resource}>
                        <AccordionTrigger className="text-sm py-3 text-left">
                          <div className="flex items-center gap-2 flex-1 mr-2">
                            <span className="text-sm">{truncateText(resource, 50)}</span>
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {posts.length}x
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 pl-2">
                            {posts.slice(0, 5).map((post) => (
                              <div key={post.id} className="border-l-2 border-yellow-200 pl-3 py-1">
                                <a
                                  href={post.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm hover:underline text-blue-600 flex items-center gap-1"
                                >
                                  {truncateText(post.title, 60)}
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                </a>
                                <Badge variant="outline" className="text-xs mt-1">
                                  {post.questionCategory?.replace(/_/g, " ") || "other"}
                                </Badge>
                              </div>
                            ))}
                            {posts.length > 5 && (
                              <p className="text-xs text-muted-foreground pl-3">
                                + {posts.length - 5} more posts
                              </p>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                </Accordion>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No resource suggestions yet. Ingest more content to see patterns.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Showcases - Show and Tell */}
      {showcases && showcases.showcases.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                <CardTitle>Community Showcases</CardTitle>
              </div>
              <Badge variant="secondary" className="text-xs">
                {showcases.stats.total} projects
              </Badge>
            </div>
            <CardDescription>
              High-quality "Show and Tell" projects from the community
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {showcases.showcases.map((showcase) => (
                <div
                  key={showcase.id}
                  className="border rounded-lg p-4 hover:border-purple-200 transition-colors relative group"
                >
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <StarButton
                      contentId={showcase.id}
                      initialStarred={showcase.isRoundupCandidate}
                      size="sm"
                    />
                    <button
                      onClick={() => dismissShowcase(showcase.id)}
                      className="p-1 rounded-full hover:bg-red-100 text-muted-foreground hover:text-red-600"
                      title="Remove from showcases"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-start justify-between gap-2 mb-2 pr-6">
                    <a
                      href={showcase.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-sm hover:underline flex items-center gap-1"
                    >
                      {truncateText(showcase.title, 60)}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    <div className="flex items-center gap-1 shrink-0">
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-medium">{showcase.qualityScore}</span>
                    </div>
                  </div>
                  {showcase.summary && (
                    <p className="text-xs text-muted-foreground mb-2">
                      {truncateText(showcase.summary, 100)}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {showcase.flair && (
                        <Badge variant="outline" className="text-xs bg-purple-50">
                          {showcase.flair}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        by {showcase.authorUsername}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · {formatRelativeTime(showcase.createdAt)}
                      </span>
                    </div>
                    {showcase.showcaseUrl && (
                      <a
                        href={showcase.showcaseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-600 hover:underline flex items-center gap-1"
                      >
                        View Project
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {stats.latestSummary && (
        <Card>
          <CardHeader>
            <CardTitle>Latest Insights</CardTitle>
            <CardDescription>
              Generated {formatRelativeTime(stats.latestSummary.generatedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-medium mb-2">Key Insights</h4>
                <ul className="space-y-2">
                  {stats.latestSummary.content.keyInsights?.map((insight, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary">-</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Opportunities</h4>
                <ul className="space-y-2">
                  {stats.latestSummary.content.opportunities?.slice(0, 3).map((opp, i) => (
                    <li key={i} className="text-sm">
                      <Badge
                        variant={
                          opp.priority === "high"
                            ? "destructive"
                            : opp.priority === "medium"
                              ? "default"
                              : "secondary"
                        }
                        className="mr-2 text-xs"
                      >
                        {opp.priority}
                      </Badge>
                      {opp.description}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
