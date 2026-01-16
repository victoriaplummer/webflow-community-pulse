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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { RefreshCw, ExternalLink, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Star, Loader2, Check, Pencil } from "lucide-react";
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

const SUBREDDITS = [
  { value: "all", label: "All Subreddits" },
  // Primary
  { value: "webflow", label: "r/webflow" },
  // Web dev communities
  { value: "webdev", label: "r/webdev" },
  { value: "web_design", label: "r/web_design" },
  { value: "nocode", label: "r/nocode" },
  // Competitors
  { value: "framer", label: "r/framer" },
  { value: "wordpress", label: "r/wordpress" },
  { value: "squarespace", label: "r/squarespace" },
  { value: "wix", label: "r/wix" },
  { value: "shopify", label: "r/shopify" },
  { value: "Supabase", label: "r/Supabase" },
];

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
  const [filters, setFilters] = useState({
    classification: "all",
    topic: "all",
    sentiment: "all",
    subreddit: "all",
    webflowOnly: false,
    needsReview: false,
    // Multi-platform filters
    mentionsWebflow: "all" as "all" | "true" | "false",
    mentionedTool: "all",
    minAudienceRelevance: "all",
  });
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [savingField, setSavingField] = useState<{ id: number; field: string } | null>(null);
  const [savedField, setSavedField] = useState<{ id: number; field: string } | null>(null);
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

      if (filters.classification !== "all") {
        params.set("classification", filters.classification);
      }
      if (filters.topic !== "all") {
        params.set("topic", filters.topic);
      }
      if (filters.sentiment !== "all") {
        params.set("sentiment", filters.sentiment);
      }
      if (filters.subreddit !== "all") {
        params.set("subreddit", filters.subreddit);
      }
      if (filters.webflowOnly) {
        params.set("webflow_only", "true");
      }
      if (filters.needsReview) {
        params.set("needs_review", "true");
      }

      // Multi-platform filters
      if (filters.mentionsWebflow !== "all") {
        params.set("mentions_webflow", filters.mentionsWebflow);
      }
      if (filters.mentionedTool !== "all") {
        params.set("mentioned_tool", filters.mentionedTool);
      }
      if (filters.minAudienceRelevance !== "all") {
        params.set("min_audience_relevance", filters.minAudienceRelevance);
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
  }, [filters, offset, sortBy, sortOrder]);

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

  const handleFilterChange = (key: string, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
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

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <Select
          value={filters.classification}
          onValueChange={(v) => handleFilterChange("classification", v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {CLASSIFICATIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.topic}
          onValueChange={(v) => handleFilterChange("topic", v)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Topic" />
          </SelectTrigger>
          <SelectContent>
            {TOPICS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.sentiment}
          onValueChange={(v) => handleFilterChange("sentiment", v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Sentiment" />
          </SelectTrigger>
          <SelectContent>
            {SENTIMENTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.subreddit}
          onValueChange={(v) => handleFilterChange("subreddit", v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Subreddit" />
          </SelectTrigger>
          <SelectContent>
            {SUBREDDITS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.mentionedTool}
          onValueChange={(v) => handleFilterChange("mentionedTool", v)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Tool" />
          </SelectTrigger>
          <SelectContent>
            {MENTIONED_TOOLS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.minAudienceRelevance}
          onValueChange={(v) => handleFilterChange("minAudienceRelevance", v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Relevance" />
          </SelectTrigger>
          <SelectContent>
            {AUDIENCE_RELEVANCE.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={filters.mentionsWebflow === "true" ? "default" : "outline"}
          size="sm"
          onClick={() => handleFilterChange("mentionsWebflow", filters.mentionsWebflow === "true" ? "all" : "true")}
        >
          Mentions Webflow
        </Button>

        <Button
          variant={filters.webflowOnly ? "default" : "outline"}
          size="sm"
          onClick={() => handleFilterChange("webflowOnly", !filters.webflowOnly)}
        >
          Webflow Related
        </Button>

        <Button
          variant={filters.needsReview ? "default" : "outline"}
          size="sm"
          onClick={() => handleFilterChange("needsReview", !filters.needsReview)}
        >
          Needs Review
        </Button>
      </div>

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
  );
}
