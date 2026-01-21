import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { RefreshCw } from "lucide-react";
import {
  formatRelativeTime,
  getClassificationColor,
  getClassificationLabel,
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
  isWebflowStaff: boolean;
  subreddits: string | null;
  subredditsList?: string[];
}

interface Post {
  id: number;
  platform: string;
  platformId: string;
  type: string;
  title: string | null;
  body: string;
  url: string;
  subreddit: string | null;
  classification: string | null;
  createdAt: number;
  engagementScore: number;
}

interface User {
  email: string;
  name: string | null;
}

interface ProfileData {
  author: Author;
  posts: Post[];
  stats: {
    postCount: number;
    commentCount: number;
    commentCountsBySubreddit: Record<string, number>;
  };
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export function ContributorProfile({ authorId }: { authorId: number }) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [contentType, setContentType] = useState<"all" | "post" | "comment">("all");

  const fetchProfile = async (type: "all" | "post" | "comment" = "all") => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (type !== "all") {
        params.set("type", type);
      }
      const response = await fetch(`/pulse/api/authors/${authorId}?${params}`);
      if (!response.ok) throw new Error("Failed to fetch profile");
      const profileData = await response.json();
      setData(profileData);
    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const checkAuth = async () => {
    try {
      const response = await fetch("/pulse/api/auth/me");
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (err) {
      console.error("Auth check error:", err);
    }
  };

  const toggleStaff = async () => {
    if (!data) return;

    try {
      const method = data.author.isWebflowStaff ? "DELETE" : "POST";
      const response = await fetch(`/pulse/api/authors/${authorId}/staff`, {
        method,
      });

      if (response.ok) {
        // Refresh profile data
        await fetchProfile();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (err) {
      console.error("Error toggling staff status:", err);
      alert("Failed to update staff status");
    }
  };

  useEffect(() => {
    fetchProfile(contentType);
  }, [authorId, contentType]);

  useEffect(() => {
    checkAuth();
  }, []);

  if (loading || !data || !data.stats) {
    return (
      <div className="flex justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { author, posts, stats, pagination } = data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-2xl">
                  {author.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-3xl font-bold">{author.username}</h1>
                <div className="flex gap-2 mt-2">
                  {author.isWebflowStaff && (
                    <Badge variant="default">Webflow Staff</Badge>
                  )}
                  {author.subredditsList &&
                    author.subredditsList.map((sub) => (
                      <Badge key={sub} variant="outline">
                        r/{sub}
                      </Badge>
                    ))}
                </div>
              </div>
            </div>
            {user && (
              <Button onClick={toggleStaff} variant="outline">
                {author.isWebflowStaff ? "Remove Staff" : "Mark as Staff"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold">{stats.postCount}</div>
              <div className="text-sm text-muted-foreground">Posts</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{stats.commentCount}</div>
              <div className="text-sm text-muted-foreground">Comments</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">
                {author.highQualityCount}
              </div>
              <div className="text-sm text-muted-foreground">Quality</div>
            </div>
            <div>
              <div className="text-3xl font-bold">
                {Math.round(author.contributorScore)}
              </div>
              <div className="text-sm text-muted-foreground">Score</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{author.totalEngagement}</div>
              <div className="text-sm text-muted-foreground">Engagement</div>
            </div>
          </div>

          {/* Comment counts by subreddit */}
          {author.subredditsList && author.subredditsList.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-sm font-medium mb-3">Comments by Subreddit</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {author.subredditsList.map((sub) => {
                  const commentCount = stats.commentCountsBySubreddit[sub] || 0;
                  return (
                    <div key={sub} className="flex items-center justify-between p-2 bg-muted rounded">
                      <Badge variant="outline">r/{sub}</Badge>
                      <span className="text-sm font-medium">{commentCount} comments</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Content History</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={contentType} onValueChange={(v) => setContentType(v as "all" | "post" | "comment")}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">
                All ({stats.postCount + stats.commentCount})
              </TabsTrigger>
              <TabsTrigger value="post">
                Posts ({stats.postCount})
              </TabsTrigger>
              <TabsTrigger value="comment">
                Comments ({stats.commentCount})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={contentType} className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No {contentType === "all" ? "content" : contentType + "s"} found
                </div>
              ) : (
                posts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-start justify-between p-4 border rounded hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-start gap-2">
                        <h3 className="font-medium flex-1">
                          {post.title || "(comment)"}
                        </h3>
                        <Badge variant="secondary" className="text-xs">
                          {post.type}
                        </Badge>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {post.classification && (
                          <Badge
                            variant="outline"
                            className={getClassificationColor(post.classification)}
                          >
                            {getClassificationLabel(post.classification)}
                          </Badge>
                        )}
                        {post.subreddit && (
                          <Badge variant="outline">r/{post.subreddit}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatRelativeTime(post.createdAt)}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm font-medium">
                        {post.engagementScore} engagement
                      </div>
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        View on Reddit
                      </a>
                    </div>
                  </div>
                ))
              )}

              {!loading && pagination.hasMore && (
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Showing {posts.length} of {pagination.total}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
