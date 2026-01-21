import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { RefreshCw, ExternalLink, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Star, Loader2, Check, Pencil, Smile, Meh, Frown } from "lucide-react";
import { StarButton } from "./StarButton";
import {
  formatRelativeTime,
  getClassificationColor,
  getClassificationLabel,
  getSentimentColor,
  truncateText,
} from "../lib/utils";

interface ContentItem {
  id: number;
  platform: string;
  type: string;
  title: string | null;
  body: string;
  url: string;
  subreddit: string | null;
  createdAt: number;
  sentiment: string | null;
  classification: string | null;
  topic: string | null;
  needsReview: boolean;
  engagementScore: number;
  isWebflowRelated: boolean;
  authorUsername: string | null;
  qualityScore: number | null;
  summary: string | null;
  flair: string | null;
  isRoundupCandidate: boolean;
  // Multi-platform monitoring fields
  mentionsWebflow: boolean;
  mentionedTools: string | null; // JSON string
  audienceRelevance: number | null;
}

type SortField = "createdAt" | "engagementScore" | "qualityScore";
type SortOrder = "asc" | "desc";

interface ContentResponse {
  items: ContentItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

const CLASSIFICATIONS = [
  { value: "all", label: "All Types" },
  { value: "question", label: "Question" },
  { value: "showcase", label: "Showcase" },
  { value: "tutorial", label: "Tutorial" },
  { value: "resource", label: "Resource" },
  { value: "feedback_request", label: "Feedback Request" },
  { value: "discussion", label: "Discussion" },
  { value: "announcement", label: "Announcement" },
  { value: "rant", label: "Rant" },
  { value: "self_promo", label: "Self-Promo" },
  { value: "spam", label: "Spam" },
];

const TOPICS = [
  { value: "all", label: "All Topics" },
  // Webflow-specific topics
  { value: "cms", label: "CMS" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "animations", label: "Animations" },
  { value: "custom_code", label: "Custom Code" },
  { value: "design", label: "Design" },
  { value: "hosting", label: "Hosting" },
  { value: "seo", label: "SEO" },
  { value: "integrations", label: "Integrations" },
  { value: "performance", label: "Performance" },
  { value: "pricing", label: "Pricing" },
  { value: "ai_tools", label: "AI Tools" },
  { value: "career", label: "Career" },
  { value: "workflow", label: "Workflow" },
  { value: "migration", label: "Migration" },
  { value: "comparison", label: "Comparison" },
  { value: "troubleshooting", label: "Troubleshooting" },
  // Universal web dev topics
  { value: "frameworks", label: "Frameworks" },
  { value: "javascript", label: "JavaScript" },
  { value: "css_styling", label: "CSS/Styling" },
  { value: "responsive_design", label: "Responsive" },
  { value: "no_code_tools", label: "No-Code Tools" },
  { value: "accessibility", label: "Accessibility" },
  { value: "api_development", label: "API Dev" },
  { value: "security", label: "Security" },
  { value: "general", label: "General" },
];

const SENTIMENTS = [
  { value: "all", label: "All Sentiments" },
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
];

// Subreddits will be fetched dynamically

const MENTIONED_TOOLS = [
  { value: "all", label: "All Tools" },
  // No-code platforms
  { value: "webflow", label: "Webflow" },
  { value: "framer", label: "Framer" },
  { value: "squarespace", label: "Squarespace" },
  { value: "wix", label: "Wix" },
  { value: "shopify", label: "Shopify" },
  { value: "bubble", label: "Bubble" },
  { value: "webstudio", label: "Webstudio" },
  // CMS/Backend platforms
  { value: "wordpress", label: "WordPress" },
  { value: "contentful", label: "Contentful" },
  { value: "sanity", label: "Sanity" },
  { value: "supabase", label: "Supabase" },
  // Frameworks
  { value: "react", label: "React" },
  { value: "nextjs", label: "Next.js" },
  { value: "vue", label: "Vue" },
  { value: "svelte", label: "Svelte" },
  { value: "astro", label: "Astro" },
];

const AUDIENCE_RELEVANCE = [
  { value: "all", label: "Any Relevance" },
  { value: "8", label: "8+ (Highly Relevant)" },
  { value: "6", label: "6+ (Relevant)" },
  { value: "4", label: "4+ (Somewhat)" },
];

export function ContentBrowser() {
  const [content, setContent] = useState<ContentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    classifications: [] as string[],
    topics: [] as string[],
    sentiments: [] as string[],
    subreddits: [] as string[],
    webflowOnly: false,
    needsReview: false,
    // Multi-platform filters
    mentionsWebflow: "all" as "all" | "true" | "false",
    mentionedTools: [] as string[],
    minAudienceRelevance: 0, // 0-10 scale
  });
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [savingField, setSavingField] = useState<{ id: number; field: string } | null>(null);
  const [savedField, setSavedField] = useState<{ id: number; field: string } | null>(null);
  const [subreddits, setSubreddits] = useState<Array<{ name: string; count: number }>>([]);
  const limit = 25;

  // Update a content item field via PATCH
  const updateItem = useCallback(async (
    itemId: number,
    field: string,
    value: string | boolean | number
  ) => {
    setSavingField({ id: itemId, field });
    setSavedField(null);

    try {
      const response = await fetch(`/pulse/api/content/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update");
      }

      // Update local state
      setContent((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === itemId ? { ...item, [field]: value } : item
          ),
        };
      });

      // Show saved indicator briefly
      setSavedField({ id: itemId, field });
      setTimeout(() => setSavedField(null), 1500);
    } catch (err) {
      console.error("Error updating item:", err);
      // Could add toast notification here
    } finally {
      setSavingField(null);
    }
  }, []);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", limit.toString());
      params.set("offset", offset.toString());
      params.set("sort_by", sortBy);
      params.set("sort_order", sortOrder);

      // Multiselect filters - send as comma-separated values
      if (filters.classifications.length > 0) {
        params.set("classifications", filters.classifications.join(","));
      }
      if (filters.topics.length > 0) {
        params.set("topics", filters.topics.join(","));
      }
      if (filters.sentiments.length > 0) {
        params.set("sentiments", filters.sentiments.join(","));
      }
      if (filters.subreddits.length > 0) {
        params.set("subreddits", filters.subreddits.join(","));
      }
      if (filters.webflowOnly) {
        params.set("webflow_only", "true");
      }
      if (filters.needsReview) {
        params.set("needs_review", "true");
      }
      if (search) {
        params.set("search", search);
      }

      // Multi-platform filters
      if (filters.mentionsWebflow !== "all") {
        params.set("mentions_webflow", filters.mentionsWebflow);
      }
      if (filters.mentionedTools.length > 0) {
        params.set("mentioned_tools", filters.mentionedTools.join(","));
      }
      if (filters.minAudienceRelevance > 0) {
        params.set("min_audience_relevance", filters.minAudienceRelevance.toString());
      }

      const response = await fetch(`/pulse/api/content?${params}`);
      if (!response.ok) throw new Error("Failed to fetch content");
      const data = await response.json();
      setContent(data);
    } catch (err) {
      console.error("Error fetching content:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, [filters, offset, sortBy, sortOrder, search]);

  useEffect(() => {
    // Fetch available subreddits for filter dropdown
    const fetchSubreddits = async () => {
      try {
        const response = await fetch("/pulse/api/subreddits");
        if (!response.ok) return;
        const data = await response.json();
        setSubreddits(data.subreddits || []);
      } catch (err) {
        console.error("Error fetching subreddits:", err);
      }
    };
    fetchSubreddits();
  }, []);

  const clearFilters = () => {
    setSearch("");
    setFilters({
      classifications: [],
      topics: [],
      sentiments: [],
      subreddits: [],
      webflowOnly: false,
      needsReview: false,
      mentionsWebflow: "all",
      mentionedTools: [],
      minAudienceRelevance: 0,
    });
    setSortBy("createdAt");
    setSortOrder("desc");
    setOffset(0);
  };

  const activeFilterCount = [
    search !== "",
    filters.classifications.length > 0,
    filters.topics.length > 0,
    filters.sentiments.length > 0,
    filters.subreddits.length > 0,
    filters.webflowOnly,
    filters.needsReview,
    filters.mentionsWebflow !== "all",
    filters.mentionedTools.length > 0,
    filters.minAudienceRelevance > 0,
    sortBy !== "createdAt" || sortOrder !== "desc",
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      // Toggle sort order if same field
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // New field, default to desc
      setSortBy(field);
      setSortOrder("desc");
    }
    setOffset(0);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    );
  };

  const handleFilterChange = (key: string, value: string | boolean | number) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setOffset(0);
  };

  const toggleArrayFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => {
      const currentArray = prev[key] as string[];
      const newArray = currentArray.includes(value)
        ? currentArray.filter((v) => v !== value)
        : [...currentArray, value];
      return { ...prev, [key]: newArray };
    });
    setOffset(0);
  };

  const toggleSentiment = (sentiment: string) => {
    setFilters((prev) => {
      const newSentiments = prev.sentiments.includes(sentiment)
        ? prev.sentiments.filter((s) => s !== sentiment)
        : [...prev.sentiments, sentiment];
      return { ...prev, sentiments: newSentiments };
    });
    setOffset(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content Browser</h1>
          <p className="text-muted-foreground">
            Browse and filter community content
          </p>
        </div>
        <Button variant="outline" onClick={fetchContent} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Results count */}
      {!loading && content && (
        <div className="text-sm text-muted-foreground">
          Showing {content.items.length} of {content.pagination.total} items
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Sidebar Filters */}
        <div className="lg:w-72 flex-shrink-0">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">Filters</CardTitle>
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </div>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-auto py-1 px-2 text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <Input
                  placeholder="Search title or body..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Subreddit - Multiselect */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Subreddits {filters.subreddits.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {filters.subreddits.length}
                    </Badge>
                  )}
                </label>
                <div className="space-y-1 max-h-48 overflow-y-auto border rounded-md p-2">
                  {subreddits.map((sub) => (
                    <label key={sub.name} className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded">
                      <input
                        type="checkbox"
                        checked={filters.subreddits.includes(sub.name)}
                        onChange={() => toggleArrayFilter("subreddits", sub.name)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm flex-1">r/{sub.name}</span>
                      <span className="text-xs text-muted-foreground">({sub.count})</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Content Type & Classification - Multiselect */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Content Type {filters.classifications.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {filters.classifications.length}
                    </Badge>
                  )}
                </label>
                <div className="space-y-1 max-h-64 overflow-y-auto border rounded-md p-2">
                  {CLASSIFICATIONS.filter(c => c.value !== "all").map((c) => (
                    <label key={c.value} className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded">
                      <input
                        type="checkbox"
                        checked={filters.classifications.includes(c.value)}
                        onChange={() => toggleArrayFilter("classifications", c.value)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Topic - Multiselect */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Topics {filters.topics.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {filters.topics.length}
                    </Badge>
                  )}
                </label>
                <div className="space-y-1 max-h-64 overflow-y-auto border rounded-md p-2">
                  {TOPICS.filter(t => t.value !== "all").map((t) => (
                    <label key={t.value} className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded">
                      <input
                        type="checkbox"
                        checked={filters.topics.includes(t.value)}
                        onChange={() => toggleArrayFilter("topics", t.value)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sentiment - Icon Buttons */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Sentiment</label>
                <div className="flex gap-2">
                  <Button
                    variant={filters.sentiments.includes("positive") ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleSentiment("positive")}
                    className="flex-1"
                  >
                    <Smile className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Positive</span>
                  </Button>
                  <Button
                    variant={filters.sentiments.includes("neutral") ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleSentiment("neutral")}
                    className="flex-1"
                  >
                    <Meh className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Neutral</span>
                  </Button>
                  <Button
                    variant={filters.sentiments.includes("negative") ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleSentiment("negative")}
                    className="flex-1"
                  >
                    <Frown className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Negative</span>
                  </Button>
                </div>
              </div>

              {/* Mentioned Tools - Multiselect */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Mentioned Tools {filters.mentionedTools.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {filters.mentionedTools.length}
                    </Badge>
                  )}
                </label>
                <div className="space-y-1 max-h-64 overflow-y-auto border rounded-md p-2">
                  {MENTIONED_TOOLS.filter(t => t.value !== "all").map((t) => (
                    <label key={t.value} className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded">
                      <input
                        type="checkbox"
                        checked={filters.mentionedTools.includes(t.value)}
                        onChange={() => toggleArrayFilter("mentionedTools", t.value)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Audience Relevance - Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Min Audience Relevance</label>
                  <Badge variant="secondary" className="text-xs">
                    {filters.minAudienceRelevance}/10
                  </Badge>
                </div>
                <Slider
                  value={[filters.minAudienceRelevance]}
                  onValueChange={(value) => handleFilterChange("minAudienceRelevance", value[0])}
                  max={10}
                  min={0}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Any (0)</span>
                  <span>High (10)</span>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-3 pt-2 border-t">
                <label className="text-sm font-medium">Content Filters</label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.mentionsWebflow === "true"}
                      onChange={(e) =>
                        handleFilterChange("mentionsWebflow", e.target.checked ? "true" : "all")
                      }
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Mentions Webflow</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.webflowOnly}
                      onChange={(e) =>
                        handleFilterChange("webflowOnly", e.target.checked)
                      }
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Webflow Related</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.needsReview}
                      onChange={(e) =>
                        handleFilterChange("needsReview", e.target.checked)
                      }
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Needs Review</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-4">
          {/* Content table */}
          <div className="border rounded-lg overflow-x-auto">
        <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead className="w-[280px] min-w-[280px]">Content</TableHead>
                <TableHead className="w-[100px]">Subreddit</TableHead>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead className="w-[110px]">Topic</TableHead>
                <TableHead className="w-[90px]">Sentiment</TableHead>
                <TableHead
                  className="w-[80px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("qualityScore")}
                >
                  <div className="flex items-center">
                    Quality
                    <SortIcon field="qualityScore" />
                  </div>
                </TableHead>
                <TableHead
                  className="w-[90px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("engagementScore")}
                >
                  <div className="flex items-center">
                    Engage
                    <SortIcon field="engagementScore" />
                  </div>
                </TableHead>
                <TableHead
                  className="w-[80px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("createdAt")}
                >
                  <div className="flex items-center">
                    Date
                    <SortIcon field="createdAt" />
                  </div>
                </TableHead>
                <TableHead className="w-[250px] min-w-[250px]">Summary</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : content?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No content found matching filters
                </TableCell>
              </TableRow>
            ) : (
              content?.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="p-1">
                    <StarButton
                      contentId={item.id}
                      initialStarred={item.isRoundupCandidate}
                      size="sm"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline flex items-center gap-1"
                      >
                        {truncateText(item.title || item.body, 50)}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>by {item.authorUsername || "unknown"}</span>
                        {item.flair && (
                          <Badge variant="outline" className="text-xs py-0">
                            {item.flair}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">r/{item.subreddit}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="relative">
                      <Select
                        value={item.classification || "discussion"}
                        onValueChange={(v) => updateItem(item.id, "classification", v)}
                        disabled={savingField?.id === item.id && savingField?.field === "classification"}
                      >
                        <SelectTrigger className={`h-7 w-[110px] border-0 px-2 ${getClassificationColor(item.classification)} hover:opacity-80`}>
                          {savingField?.id === item.id && savingField?.field === "classification" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : savedField?.id === item.id && savedField?.field === "classification" ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {CLASSIFICATIONS.filter(c => c.value !== "all").map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="relative">
                      <Select
                        value={item.topic || "general"}
                        onValueChange={(v) => updateItem(item.id, "topic", v)}
                        disabled={savingField?.id === item.id && savingField?.field === "topic"}
                      >
                        <SelectTrigger className="h-7 w-[100px] border-0 px-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs">
                          {savingField?.id === item.id && savingField?.field === "topic" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : savedField?.id === item.id && savedField?.field === "topic" ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <span className="truncate">{(item.topic || "general").replace(/_/g, " ")}</span>
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {TOPICS.filter(t => t.value !== "all").map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="relative">
                      <Select
                        value={item.sentiment || "neutral"}
                        onValueChange={(v) => updateItem(item.id, "sentiment", v)}
                        disabled={savingField?.id === item.id && savingField?.field === "sentiment"}
                      >
                        <SelectTrigger className={`h-7 w-[90px] border-0 px-2 ${getSentimentColor(item.sentiment)} hover:opacity-80`}>
                          {savingField?.id === item.id && savingField?.field === "sentiment" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : savedField?.id === item.id && savedField?.field === "sentiment" ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {SENTIMENTS.filter(s => s.value !== "all").map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.qualityScore !== null ? (
                      <div className="flex items-center gap-1">
                        <Star
                          className={`h-4 w-4 ${
                            item.qualityScore >= 7
                              ? "text-yellow-500 fill-yellow-500"
                              : item.qualityScore >= 5
                                ? "text-yellow-500"
                                : "text-gray-300"
                          }`}
                        />
                        <span className="font-medium">{item.qualityScore}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {Math.round(item.engagementScore)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatRelativeTime(item.createdAt)}
                  </TableCell>
                  <TableCell className="min-w-[250px]">
                    {item.summary ? (
                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                        {item.summary}
                      </p>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
          </div>

              {/* Pagination */}
          {content && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {offset + 1}-{Math.min(offset + limit, content.pagination.total)} of{" "}
                {content.pagination.total} items
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + limit)}
                  disabled={!content.pagination.hasMore}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
