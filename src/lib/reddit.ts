// Reddit API wrapper using Arcade.dev OAuth
// Note: This requires a valid Arcade.dev token for Reddit

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  url: string;
  permalink: string;
  created_utc: number;
  score: number;
  num_comments: number;
  is_self: boolean;
}

export interface RedditComment {
  id: string;
  body: string;
  author: string;
  subreddit: string;
  permalink: string;
  created_utc: number;
  score: number;
  parent_id: string;
  link_id: string;
}

export interface RedditListingResponse<T> {
  kind: string;
  data: {
    children: Array<{ kind: string; data: T }>;
    after: string | null;
    before: string | null;
  };
}

const SUBREDDITS = ["webflow", "webdev", "web_design", "shopify", "wordpress"];

const WEBFLOW_KEYWORDS = [
  "webflow",
  "no-code",
  "nocode",
  "website builder",
  "cms",
  "framer",
  "squarespace",
  "wix",
  "editor x",
];

export class RedditClient {
  private token: string;
  private userAgent: string;

  constructor(token: string) {
    this.token = token;
    this.userAgent = "CommunityPulseMonitor/1.0";
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const response = await fetch(`https://oauth.reddit.com${endpoint}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "User-Agent": this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getSubredditPosts(
    subreddit: string,
    sort: "hot" | "new" | "top" = "new",
    limit: number = 25,
    after?: string
  ): Promise<{ posts: RedditPost[]; after: string | null }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(after && { after }),
    });

    const response = await this.fetch<RedditListingResponse<RedditPost>>(
      `/r/${subreddit}/${sort}?${params}`
    );

    return {
      posts: response.data.children.map((child) => child.data),
      after: response.data.after,
    };
  }

  async getPostComments(
    subreddit: string,
    postId: string,
    limit: number = 100
  ): Promise<RedditComment[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      sort: "top",
    });

    const response = await this.fetch<
      [RedditListingResponse<RedditPost>, RedditListingResponse<RedditComment>]
    >(`/r/${subreddit}/comments/${postId}?${params}`);

    // Second element contains comments
    if (response[1]?.data?.children) {
      return this.flattenComments(response[1].data.children);
    }

    return [];
  }

  private flattenComments(
    children: Array<{ kind: string; data: RedditComment & { replies?: RedditListingResponse<RedditComment> } }>
  ): RedditComment[] {
    const comments: RedditComment[] = [];

    for (const child of children) {
      if (child.kind === "t1") {
        comments.push(child.data);
        // Recursively get replies
        if (child.data.replies && typeof child.data.replies === "object") {
          comments.push(...this.flattenComments(child.data.replies.data.children));
        }
      }
    }

    return comments;
  }

  async searchSubreddit(
    subreddit: string,
    query: string,
    limit: number = 25
  ): Promise<RedditPost[]> {
    const params = new URLSearchParams({
      q: query,
      restrict_sr: "true",
      sort: "new",
      limit: limit.toString(),
    });

    const response = await this.fetch<RedditListingResponse<RedditPost>>(
      `/r/${subreddit}/search?${params}`
    );

    return response.data.children.map((child) => child.data);
  }

  async getAllSubredditsPosts(
    sort: "hot" | "new" | "top" = "new",
    limit: number = 25
  ): Promise<Map<string, RedditPost[]>> {
    const results = new Map<string, RedditPost[]>();

    for (const subreddit of SUBREDDITS) {
      try {
        const { posts } = await this.getSubredditPosts(subreddit, sort, limit);
        results.set(subreddit, posts);
      } catch (error) {
        console.error(`Failed to fetch posts from r/${subreddit}:`, error);
        results.set(subreddit, []);
      }
    }

    return results;
  }

  async searchWebflowContent(limit: number = 50): Promise<RedditPost[]> {
    const allPosts: RedditPost[] = [];

    // Search for Webflow-related content in non-webflow subreddits
    for (const subreddit of SUBREDDITS.filter((s) => s !== "webflow")) {
      for (const keyword of WEBFLOW_KEYWORDS.slice(0, 3)) {
        // Limit keywords to avoid rate limiting
        try {
          const posts = await this.searchSubreddit(subreddit, keyword, 10);
          allPosts.push(...posts);
        } catch (error) {
          console.error(`Search failed for ${keyword} in r/${subreddit}:`, error);
        }
      }
    }

    // Dedupe by post ID
    const seen = new Set<string>();
    return allPosts.filter((post) => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });
  }
}

export function isWebflowRelated(text: string): boolean {
  const lowerText = text.toLowerCase();
  return WEBFLOW_KEYWORDS.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

export function getSubreddits(): string[] {
  return SUBREDDITS;
}
