import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  AlertTriangle,
  Lightbulb,
  FileText,
  Sparkles,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  Send,
  User,
  Bot,
  History,
  Calendar,
} from "lucide-react";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { formatRelativeTime } from "../lib/utils";
import ReactMarkdown from "react-markdown";

interface EvidenceItem {
  id: number;
  title: string | null;
  url: string;
  authorUsername: string | null;
}

interface Insight {
  id: number;
  type: string;
  title: string;
  description: string;
  priority: string;
  evidence: EvidenceItem[];
}

interface InsightsData {
  insights: {
    pain_points: Insight[];
    feature_requests: Insight[];
    opportunities: Insight[];
    highlights: Insight[];
    trends: Insight[];
  };
  stats: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
  generatedAt: number | null;
  message?: string;
}

interface GenerateResponse {
  success?: boolean;
  message?: string;
  error?: string;
  counts?: Record<string, number>;
  generationId?: number;
}

interface Generation {
  id: number;
  subreddit: string | null;
  periodDays: number;
  contentAnalyzed: number;
  insightCount: number;
  generatedAt: number;
  generatedAtFormatted?: string;
}

interface HistoryData {
  generations: Generation[];
  availableSubreddits: { value: string; label: string }[];
  total: number;
}

const SUBREDDIT_OPTIONS = [
  { value: "all", label: "All Subreddits" },
  { value: "webflow", label: "r/webflow" },
  { value: "webdev", label: "r/webdev" },
  { value: "web_design", label: "r/web_design" },
  { value: "nocode", label: "r/nocode" },
  { value: "framer", label: "r/framer" },
  { value: "wordpress", label: "r/wordpress" },
  { value: "squarespace", label: "r/squarespace" },
  { value: "wix", label: "r/wix" },
  { value: "Supabase", label: "r/Supabase" },
];

const PERIOD_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
];

const INSIGHT_CONFIG = {
  pain_points: {
    icon: AlertTriangle,
    color: "text-red-500",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    label: "Pain Points",
    description: "Issues and frustrations users are experiencing",
  },
  feature_requests: {
    icon: Lightbulb,
    color: "text-yellow-500",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    label: "Feature Requests",
    description: "What users wish Webflow could do",
  },
  opportunities: {
    icon: FileText,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    label: "Content Opportunities",
    description: "Questions needing documentation or tutorials",
  },
  highlights: {
    icon: Sparkles,
    color: "text-purple-500",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    label: "Community Highlights",
    description: "Great showcases and valuable contributions",
  },
  trends: {
    icon: TrendingUp,
    color: "text-green-500",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    label: "Trending Topics",
    description: "What's being discussed frequently",
  },
};

function InsightCard({ insight, config }: { insight: Insight; config: typeof INSIGHT_CONFIG.pain_points }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = config.icon;

  const priorityColors = {
    high: "bg-red-100 text-red-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-gray-100 text-gray-800",
  };

  return (
    <div className={`border rounded-lg p-4 ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 flex-1">
          <Icon className={`h-5 w-5 mt-0.5 ${config.color}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm">{insight.title}</h4>
              <Badge className={`text-xs ${priorityColors[insight.priority as keyof typeof priorityColors]}`}>
                {insight.priority}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{insight.description}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="shrink-0"
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      {expanded && insight.evidence.length > 0 && (
        <div className="mt-3 pt-3 border-t border-dashed">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Evidence ({insight.evidence.length} posts)
          </p>
          <div className="space-y-2">
            {insight.evidence.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">{item.title || "(untitled)"}</span>
                {item.authorUsername && (
                  <span className="text-muted-foreground/60">by {item.authorUsername}</span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InsightSection({
  type,
  insights,
}: {
  type: keyof typeof INSIGHT_CONFIG;
  insights: Insight[];
}) {
  const config = INSIGHT_CONFIG[type];
  const Icon = config.icon;

  if (insights.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${config.color}`} />
          <CardTitle className="text-lg">{config.label}</CardTitle>
          <Badge variant="secondary">{insights.length}</Badge>
        </div>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} config={config} />
        ))}
      </CardContent>
    </Card>
  );
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function InsightsTab() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<GenerateResponse | null>(null);

  // Generation options
  const [selectedSubreddit, setSelectedSubreddit] = useState<string>("all");
  const [periodDays, setPeriodDays] = useState<string>("14");

  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedGenerationId, setSelectedGenerationId] = useState<number | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const fetchInsights = useCallback(async (generationId?: number) => {
    try {
      setLoading(true);
      const url = generationId
        ? `/pulse/api/insights/history?generationId=${generationId}`
        : "/pulse/api/insights";
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        if (generationId) {
          // Transform history response to match InsightsData format
          setData({
            insights: result.grouped,
            stats: {
              total: result.insights.length,
              high: result.insights.filter((i: Insight) => i.priority === "high").length,
              medium: result.insights.filter((i: Insight) => i.priority === "medium").length,
              low: result.insights.filter((i: Insight) => i.priority === "low").length,
            },
            generatedAt: result.generation.generatedAt,
          });
        } else {
          setData(result);
        }
      }
    } catch (error) {
      console.error("Failed to fetch insights:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const response = await fetch("/pulse/api/insights/history");
      if (response.ok) {
        const result = await response.json();
        setHistoryData(result);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const generateInsights = async () => {
    try {
      setGenerating(true);
      setGenerateResult(null);
      const response = await fetch("/pulse/api/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subreddit: selectedSubreddit === "all" ? undefined : selectedSubreddit,
          periodDays: parseInt(periodDays),
        }),
      });
      const result = await response.json();
      setGenerateResult(result);

      if (result.success) {
        // Refresh insights after generation
        setSelectedGenerationId(result.generationId);
        await fetchInsights(result.generationId);
        // Refresh history too
        if (showHistory) {
          await fetchHistory();
        }
      }
    } catch (error) {
      setGenerateResult({ error: String(error) });
    } finally {
      setGenerating(false);
    }
  };

  const viewGeneration = async (generationId: number) => {
    setSelectedGenerationId(generationId);
    await fetchInsights(generationId);
  };

  const viewLatest = async () => {
    setSelectedGenerationId(null);
    await fetchInsights();
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setChatLoading(true);

    try {
      const response = await fetch("/pulse/api/insights/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history: chatMessages,
        }),
      });

      const result = await response.json();

      if (result.success && result.message) {
        setChatMessages(prev => [...prev, { role: "assistant", content: result.message }]);
      } else {
        setChatMessages(prev => [...prev, { role: "assistant", content: result.error || "Sorry, I couldn't process that request." }]);
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  useEffect(() => {
    if (showHistory && !historyData) {
      fetchHistory();
    }
  }, [showHistory, historyData, fetchHistory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasInsights = data?.insights && (
    (data.insights.pain_points?.length ?? 0) > 0 ||
    (data.insights.feature_requests?.length ?? 0) > 0 ||
    (data.insights.opportunities?.length ?? 0) > 0 ||
    (data.insights.highlights?.length ?? 0) > 0 ||
    (data.insights.trends?.length ?? 0) > 0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Community Insights</h1>
          <p className="text-muted-foreground">
            AI-generated insights from recent community discussions
            {selectedGenerationId && (
              <Button
                variant="link"
                className="text-muted-foreground p-0 h-auto ml-2"
                onClick={viewLatest}
              >
                (viewing historical - click to view latest)
              </Button>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showHistory ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="h-4 w-4 mr-2" />
            History
          </Button>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">Previous Generations</CardTitle>
            </div>
            <CardDescription>Browse past insight generations</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : historyData?.generations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No previous generations found. Generate some insights first!
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {historyData?.generations.map((gen) => (
                  <div
                    key={gen.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedGenerationId === gen.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => viewGeneration(gen.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {gen.subreddit ? `r/${gen.subreddit}` : "All Subreddits"} &middot;{" "}
                          {gen.periodDays} days
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(gen.generatedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{gen.insightCount} insights</Badge>
                      <Badge variant="outline">{gen.contentAnalyzed} posts</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Generate Options */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-lg">Generate New Insights</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Subreddit</label>
              <Select value={selectedSubreddit} onValueChange={setSelectedSubreddit}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Subreddits" />
                </SelectTrigger>
                <SelectContent>
                  {SUBREDDIT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Time Period</label>
              <Select value={periodDays} onValueChange={setPeriodDays}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generateInsights} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate Insights
                </>
              )}
            </Button>
            {data?.generatedAt && !selectedGenerationId && (
              <span className="text-sm text-muted-foreground">
                Last generated: {formatRelativeTime(data.generatedAt)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generation Result */}
      {generateResult && (
        <div
          className={`p-4 rounded-lg ${
            generateResult.success
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
          }`}
        >
          {generateResult.success ? (
            <p className="text-sm text-green-800">{generateResult.message}</p>
          ) : (
            <p className="text-sm text-red-800">{generateResult.error}</p>
          )}
        </div>
      )}

      {/* Stats Overview */}
      {hasInsights && data?.stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{data.stats.total}</div>
              <p className="text-xs text-muted-foreground">Total Insights</p>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">{data.stats.high}</div>
              <p className="text-xs text-muted-foreground">High Priority</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-200">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-600">{data.stats.medium}</div>
              <p className="text-xs text-muted-foreground">Medium Priority</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-gray-600">{data.stats.low}</div>
              <p className="text-xs text-muted-foreground">Low Priority</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* No Insights State */}
      {!hasInsights && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Insights Yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              {data?.message || "Click 'Generate Insights' to analyze recent community content and surface actionable insights."}
            </p>
            <Button onClick={generateInsights} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Insights
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Insight Sections */}
      {hasInsights && data?.insights && (
        <div className="grid gap-6 lg:grid-cols-2">
          <InsightSection type="pain_points" insights={data.insights.pain_points || []} />
          <InsightSection type="feature_requests" insights={data.insights.feature_requests || []} />
          <InsightSection type="opportunities" insights={data.insights.opportunities || []} />
          <InsightSection type="highlights" insights={data.insights.highlights || []} />
          <InsightSection type="trends" insights={data.insights.trends || []} />
        </div>
      )}

      {/* Chat Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            <CardTitle>Ask About Insights</CardTitle>
          </div>
          <CardDescription>
            Chat with AI to explore community trends, get recommendations, or dive deeper into the data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Chat Messages */}
          {chatMessages.length > 0 && (
            <div className="space-y-3 max-h-96 overflow-y-auto p-4 bg-muted/30 rounded-lg">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-blue-600" />
                    </div>
                  )}
                  <div
                    className={`rounded-lg px-4 py-2 max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background border"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="text-sm prose prose-sm prose-slate dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:my-2 [&>ol]:my-2 [&>li]:my-0.5 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>h4]:text-sm">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="rounded-lg px-4 py-2 bg-background border">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {chatMessages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Ask questions about community trends, pain points, or opportunities</p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {[
                  "What are the main pain points this week?",
                  "Which topics need better documentation?",
                  "Should we create weekly megathreads to reduce clutter?",
                  "How do discussions in r/framer compare to r/webflow?",
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setChatInput(suggestion);
                    }}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <Textarea
              placeholder="Ask about community insights..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendChatMessage();
                }
              }}
              className="min-h-[44px] max-h-32 resize-none"
              rows={1}
            />
            <Button
              onClick={sendChatMessage}
              disabled={!chatInput.trim() || chatLoading}
              size="icon"
              className="shrink-0"
            >
              {chatLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
