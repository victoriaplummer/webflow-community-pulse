import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "./ui/dialog";
import {
  RefreshCw,
  Plus,
  ExternalLink,
  Copy,
  Sparkles,
  Trash2,
  Edit,
  Star,
  Check,
  FileText,
  Calendar,
} from "lucide-react";
import { formatRelativeTime, truncateText } from "../lib/utils";
import { StarButton } from "./StarButton";

interface Roundup {
  id: number;
  title: string;
  status: "draft" | "published";
  dateFrom: number;
  dateTo: number;
  content: string | null;
  createdAt: number;
  updatedAt: number;
  itemCount: number;
}

interface RoundupItem {
  id: number;
  section: string;
  pullQuote: string | null;
  note: string | null;
  displayOrder: number;
  contentId: number;
  title: string | null;
  body: string;
  summary: string | null;
  url: string;
  subreddit: string | null;
  flair: string | null;
  classification: string | null;
  topic: string | null;
  qualityScore: number | null;
  engagementScore: number;
  createdAt: number;
  authorUsername: string | null;
}

interface SuggestedItem {
  id: number;
  title: string | null;
  summary: string | null;
  url: string;
  subreddit: string | null;
  flair: string | null;
  classification: string | null;
  topic: string | null;
  qualityScore: number | null;
  engagementScore: number;
  createdAt: number;
  authorUsername: string | null;
  isRoundupCandidate: boolean;
}

const SECTIONS = [
  { value: "showcase", label: "Showcase" },
  { value: "feedback", label: "Feedback Request" },
  { value: "resource", label: "Resource" },
  { value: "trending", label: "Trending" },
  { value: "highlight", label: "Highlight" },
];

export function RoundupManager() {
  const [roundups, setRoundups] = useState<Roundup[]>([]);
  const [selectedRoundup, setSelectedRoundup] = useState<Roundup | null>(null);
  const [roundupItems, setRoundupItems] = useState<RoundupItem[]>([]);
  const [suggestedItems, setSuggestedItems] = useState<{
    starred: SuggestedItem[];
    suggested: SuggestedItem[];
  }>({ starred: [], suggested: [] });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [starredCount, setStarredCount] = useState(0);
  const [copied, setCopied] = useState(false);

  // Create roundup form
  const [newRoundupTitle, setNewRoundupTitle] = useState("");
  const [newRoundupDateFrom, setNewRoundupDateFrom] = useState("");
  const [newRoundupDateTo, setNewRoundupDateTo] = useState("");

  const fetchRoundups = async () => {
    try {
      setLoading(true);
      const response = await fetch("/pulse/api/roundups");
      if (response.ok) {
        const data = await response.json();
        setRoundups(data.roundups);
        setStarredCount(data.starredCount);
      }
    } catch (error) {
      console.error("Failed to fetch roundups:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoundupDetails = async (id: number) => {
    try {
      const [detailsRes, itemsRes] = await Promise.all([
        fetch(`/pulse/api/roundups/${id}`),
        fetch(`/pulse/api/roundups/${id}/items`),
      ]);

      if (detailsRes.ok) {
        const data = await detailsRes.json();
        setSelectedRoundup(data.roundup);
        setRoundupItems(data.items);
      }

      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setSuggestedItems({
          starred: data.starred,
          suggested: data.suggested,
        });
      }
    } catch (error) {
      console.error("Failed to fetch roundup details:", error);
    }
  };

  const createRoundup = async () => {
    try {
      const response = await fetch("/pulse/api/roundups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newRoundupTitle || undefined,
          dateFrom: newRoundupDateFrom,
          dateTo: newRoundupDateTo,
          autoAddStarred: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setShowCreateDialog(false);
        setNewRoundupTitle("");
        setNewRoundupDateFrom("");
        setNewRoundupDateTo("");
        fetchRoundups();
        // Auto-select the new roundup
        fetchRoundupDetails(data.roundup.id);
      }
    } catch (error) {
      console.error("Failed to create roundup:", error);
    }
  };

  const deleteRoundup = async (id: number) => {
    if (!confirm("Are you sure you want to delete this roundup?")) return;

    try {
      const response = await fetch(`/pulse/api/roundups/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        if (selectedRoundup?.id === id) {
          setSelectedRoundup(null);
          setRoundupItems([]);
        }
        fetchRoundups();
      }
    } catch (error) {
      console.error("Failed to delete roundup:", error);
    }
  };

  const addItemToRoundup = async (contentId: number, section: string = "highlight") => {
    if (!selectedRoundup) return;

    try {
      const response = await fetch(`/pulse/api/roundups/${selectedRoundup.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, section }),
      });

      if (response.ok) {
        fetchRoundupDetails(selectedRoundup.id);
      }
    } catch (error) {
      console.error("Failed to add item:", error);
    }
  };

  const removeItemFromRoundup = async (itemId: number) => {
    if (!selectedRoundup) return;

    try {
      const response = await fetch(`/pulse/api/roundups/${selectedRoundup.id}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });

      if (response.ok) {
        fetchRoundupDetails(selectedRoundup.id);
      }
    } catch (error) {
      console.error("Failed to remove item:", error);
    }
  };

  const updateItemSection = async (itemId: number, section: string) => {
    if (!selectedRoundup) return;

    try {
      const response = await fetch(`/pulse/api/roundups/${selectedRoundup.id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, section }),
      });

      if (response.ok) {
        fetchRoundupDetails(selectedRoundup.id);
      }
    } catch (error) {
      console.error("Failed to update item:", error);
    }
  };

  const generateDraft = async () => {
    if (!selectedRoundup) return;

    try {
      setGenerating(true);
      const response = await fetch(`/pulse/api/roundups/${selectedRoundup.id}/generate`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedRoundup((prev) =>
          prev ? { ...prev, content: data.content } : null
        );
      }
    } catch (error) {
      console.error("Failed to generate draft:", error);
    } finally {
      setGenerating(false);
    }
  };

  const saveContent = async (content: string) => {
    if (!selectedRoundup) return;

    try {
      const response = await fetch(`/pulse/api/roundups/${selectedRoundup.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        setSelectedRoundup((prev) =>
          prev ? { ...prev, content } : null
        );
      }
    } catch (error) {
      console.error("Failed to save content:", error);
    }
  };

  const updateStatus = async (status: "draft" | "published") => {
    if (!selectedRoundup) return;

    try {
      const response = await fetch(`/pulse/api/roundups/${selectedRoundup.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        setSelectedRoundup((prev) =>
          prev ? { ...prev, status } : null
        );
        fetchRoundups();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const copyToClipboard = async () => {
    if (!selectedRoundup?.content) return;

    try {
      await navigator.clipboard.writeText(selectedRoundup.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  useEffect(() => {
    fetchRoundups();
  }, []);

  // Set default date range (last 7 days)
  useEffect(() => {
    if (!newRoundupDateFrom) {
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      setNewRoundupDateTo(today.toISOString().split("T")[0]);
      setNewRoundupDateFrom(weekAgo.toISOString().split("T")[0]);
    }
  }, [showCreateDialog]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roundups</h1>
          <p className="text-muted-foreground">
            Create and manage community roundup posts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRoundups} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Roundup
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Roundup</DialogTitle>
                <DialogDescription>
                  Set a date range for the roundup. Starred posts from this period will be auto-added.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title (optional)</label>
                  <Input
                    placeholder="Weekly Roundup - Jan 13-20"
                    value={newRoundupTitle}
                    onChange={(e) => setNewRoundupTitle(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">From</label>
                    <Input
                      type="date"
                      value={newRoundupDateFrom}
                      onChange={(e) => setNewRoundupDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">To</label>
                    <Input
                      type="date"
                      value={newRoundupDateTo}
                      onChange={(e) => setNewRoundupDateTo(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={createRoundup} disabled={!newRoundupDateFrom || !newRoundupDateTo}>
                  Create Roundup
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Starred posts count */}
      {starredCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
          <span>{starredCount} starred posts ready for roundups</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Roundup list */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Roundups</CardTitle>
            <CardDescription>Select a roundup to edit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {roundups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No roundups yet. Create your first one.
                </p>
              ) : (
                roundups.map((roundup) => (
                  <div
                    key={roundup.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedRoundup?.id === roundup.id
                        ? "border-primary bg-primary/5"
                        : "hover:border-muted-foreground/50"
                    }`}
                    onClick={() => fetchRoundupDetails(roundup.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={roundup.status === "published" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {roundup.status === "published" ? (
                              <Check className="h-3 w-3 mr-1" />
                            ) : (
                              <Edit className="h-3 w-3 mr-1" />
                            )}
                            {roundup.status}
                          </Badge>
                        </div>
                        <p className="font-medium text-sm mt-1 truncate">{roundup.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {formatDate(roundup.dateFrom)} - {formatDate(roundup.dateTo)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {roundup.itemCount} items · Updated {formatRelativeTime(roundup.updatedAt)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRoundup(roundup.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Roundup editor */}
        <Card className="lg:col-span-2">
          {selectedRoundup ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedRoundup.title}</CardTitle>
                    <CardDescription>
                      {formatDate(selectedRoundup.dateFrom)} - {formatDate(selectedRoundup.dateTo)}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateDraft}
                      disabled={generating || roundupItems.length === 0}
                    >
                      <Sparkles className={`h-4 w-4 mr-2 ${generating ? "animate-pulse" : ""}`} />
                      {generating ? "Generating..." : "Generate Draft"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyToClipboard}
                      disabled={!selectedRoundup.content}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                    <Select
                      value={selectedRoundup.status}
                      onValueChange={(v) => updateStatus(v as "draft" | "published")}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Selected items */}
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Selected Items ({roundupItems.length})
                  </h3>
                  {roundupItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No items selected. Add posts from the suggestions below.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {roundupItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 p-2 border rounded text-sm"
                        >
                          <Select
                            value={item.section}
                            onValueChange={(v) => updateItemSection(item.id, v)}
                          >
                            <SelectTrigger className="w-[110px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SECTIONS.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 truncate hover:underline flex items-center gap-1"
                          >
                            {truncateText(item.title || item.body, 50)}
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            by {item.authorUsername || "anon"}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeItemFromRoundup(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Suggestions */}
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    Available Posts ({suggestedItems.starred.length + suggestedItems.suggested.length})
                  </h3>
                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {suggestedItems.starred.length > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground font-medium">Starred</p>
                        {suggestedItems.starred.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 p-2 border rounded text-sm bg-yellow-50/50"
                          >
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 shrink-0" />
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 truncate hover:underline"
                            >
                              {truncateText(item.title || "", 40)}
                            </a>
                            <Badge variant="outline" className="text-xs">
                              {item.classification}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7"
                              onClick={() => addItemToRoundup(item.id)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add
                            </Button>
                          </div>
                        ))}
                      </>
                    )}
                    {suggestedItems.suggested.length > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground font-medium mt-2">
                          Auto-Suggested (High Quality)
                        </p>
                        {suggestedItems.suggested.slice(0, 10).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 p-2 border rounded text-sm"
                          >
                            <StarButton
                              contentId={item.id}
                              initialStarred={item.isRoundupCandidate}
                              size="sm"
                            />
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 truncate hover:underline"
                            >
                              {truncateText(item.title || "", 40)}
                            </a>
                            <Badge variant="outline" className="text-xs">
                              Q{item.qualityScore}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7"
                              onClick={() => addItemToRoundup(item.id)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add
                            </Button>
                          </div>
                        ))}
                      </>
                    )}
                    {suggestedItems.starred.length === 0 &&
                      suggestedItems.suggested.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No suggestions available. Star posts in the Content Browser or wait for
                          high-quality posts in this date range.
                        </p>
                      )}
                  </div>
                </div>

                {/* Content editor */}
                {selectedRoundup.content && (
                  <div>
                    <h3 className="font-medium mb-3">Generated Content</h3>
                    <Textarea
                      className="min-h-[300px] font-mono text-sm"
                      value={selectedRoundup.content}
                      onChange={(e) =>
                        setSelectedRoundup((prev) =>
                          prev ? { ...prev, content: e.target.value } : null
                        )
                      }
                      onBlur={(e) => saveContent(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Edit the content above. Changes save automatically when you click away.
                    </p>
                  </div>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Select a roundup to edit or create a new one
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
