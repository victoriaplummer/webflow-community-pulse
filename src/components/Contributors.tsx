import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { RefreshCw, User, TrendingUp, Star, ExternalLink } from "lucide-react";
import {
  formatRelativeTime,
  getClassificationColor,
  getClassificationLabel,
  truncateText,
} from "../lib/utils";

interface Author {
  id: number;
  platform: string;
  platformId: string;
  username: string;
  displayName: string | null;
  firstSeen: number;
  lastSeen: number;
  postCount: number;
  highQualityCount: number;
  totalEngagement: number;
  contributorScore: number;
  recentPosts: Array<{
    id: number;
    title: string | null;
    classification: string | null;
    createdAt: number;
    engagementScore: number;
  }>;
}

interface AuthorsResponse {
  authors: Author[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export function Contributors() {
  const [authors, setAuthors] = useState<AuthorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("score");
  const [showRisers, setShowRisers] = useState(false);

  const fetchAuthors = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("sort", sort);
      params.set("limit", "20");
      if (showRisers) {
        params.set("risers", "true");
      }

      const response = await fetch(`/pulse/api/authors?${params}`);
      if (!response.ok) throw new Error("Failed to fetch authors");
      const data = await response.json();
      setAuthors(data);
    } catch (err) {
      console.error("Error fetching authors:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthors();
  }, [sort, showRisers]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contributors</h1>
          <p className="text-muted-foreground">
            Track and discover valuable community members
          </p>
        </div>
        <Button variant="outline" onClick={fetchAuthors} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="leaderboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="rising">Rising Stars</TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Contributor Score</SelectItem>
                <SelectItem value="quality">Quality Posts</SelectItem>
                <SelectItem value="posts">Total Posts</SelectItem>
                <SelectItem value="recent">Recent Activity</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <div className="col-span-full flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : authors?.authors.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No contributors found
              </div>
            ) : (
              authors?.authors.map((author, index) => (
                <ContributorCard key={author.id} author={author} rank={index + 1} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="rising" className="space-y-4">
          <p className="text-muted-foreground">
            Contributors who have been active this week with quality contributions
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <div className="col-span-full flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              authors?.authors
                .filter((a) => a.highQualityCount > 0)
                .map((author, index) => (
                  <ContributorCard key={author.id} author={author} rank={index + 1} isRising />
                ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ContributorCard({
  author,
  rank,
  isRising = false,
}: {
  author: Author;
  rank: number;
  isRising?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                rank <= 3 ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {rank <= 3 ? (
                <Star className="h-5 w-5" />
              ) : (
                <span className="text-sm font-bold">{rank}</span>
              )}
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {author.username}
                {isRising && <TrendingUp className="h-4 w-4 text-green-500" />}
              </CardTitle>
              <CardDescription>
                <a
                  href={`https://reddit.com/u/${author.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:underline"
                >
                  r/{author.platform}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-2xl font-bold">{author.postCount}</div>
            <div className="text-xs text-muted-foreground">Posts</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{author.highQualityCount}</div>
            <div className="text-xs text-muted-foreground">Quality</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{Math.round(author.contributorScore)}</div>
            <div className="text-xs text-muted-foreground">Score</div>
          </div>
        </div>

        {author.recentPosts.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Recent Activity</h4>
            <div className="space-y-2">
              {author.recentPosts.slice(0, 3).map((post) => (
                <div key={post.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground truncate flex-1">
                      {truncateText(post.title || "(comment)", 30)}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-xs ml-2 ${getClassificationColor(post.classification)}`}
                    >
                      {getClassificationLabel(post.classification)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>First seen: {formatRelativeTime(author.firstSeen)}</span>
          <span>Last active: {formatRelativeTime(author.lastSeen)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
