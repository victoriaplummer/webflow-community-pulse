// Arcade.dev SDK client for Reddit integration
// Documentation: https://docs.arcade.dev
import Arcade from "@arcadeai/arcadejs";

export interface RedditPost {
  id: string;
  title: string;
  selftext?: string;
  author: string;
  subreddit: string;
  url: string;
  permalink: string;
  created_utc: number;
  score: number;
  num_comments: number;
  link_flair_text?: string; // Reddit post flair
  flair?: string; // Alias for link_flair_text
}

export interface RedditComment {
  id: string;
  body: string;
  author: string;
  created_utc: number;
  score: number;
}

// Custom error for when Reddit authorization is needed
export class AuthorizationRequiredError extends Error {
  public authUrl: string;
  public authId: string;

  constructor(authUrl: string, authId: string) {
    super("Reddit authorization required");
    this.name = "AuthorizationRequiredError";
    this.authUrl = authUrl;
    this.authId = authId;
  }
}

type ListingType = "hot" | "new" | "rising" | "top" | "controversial";
type TimeRange = "NOW" | "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "THIS_YEAR" | "ALL_TIME";

export class ArcadeRedditClient {
  private client: Arcade;
  private userId: string;

  constructor(apiKey: string, userId: string) {
    this.client = new Arcade({ apiKey });
    this.userId = userId;
  }

  /**
   * Check if Reddit is authorized, returns auth URL if not
   */
  async checkAuthorization(): Promise<{
    authorized: boolean;
    authUrl?: string;
    authId?: string;
  }> {
    const authResponse = await this.client.tools.authorize({
      tool_name: "Reddit.GetPostsInSubreddit",
      user_id: this.userId,
    });

    if (authResponse.status === "completed") {
      return { authorized: true };
    }

    return {
      authorized: false,
      authUrl: authResponse.url,
      authId: authResponse.id,
    };
  }

  /**
   * Wait for authorization to complete (poll until done)
   */
  async waitForAuthorization(authId: string): Promise<void> {
    await this.client.auth.waitForCompletion(authId);
  }

  /**
   * Authorize and execute a Reddit tool
   * Throws AuthorizationRequiredError if user needs to authorize
   */
  private async executeTool<T>(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<T> {
    // Check/request authorization
    const authResponse = await this.client.tools.authorize({
      tool_name: toolName,
      user_id: this.userId,
    });

    if (authResponse.status !== "completed") {
      // Throw error with auth URL for frontend to display
      throw new AuthorizationRequiredError(authResponse.url!, authResponse.id);
    }

    // Execute the tool
    const response = await this.client.tools.execute({
      tool_name: toolName,
      input,
      user_id: this.userId,
    });

    return response.output as T;
  }

  /**
   * Get posts from a subreddit
   */
  async getSubredditPosts(
    subreddit: string,
    listing: ListingType = "new",
    limit: number = 25
  ): Promise<RedditPost[]> {
    try {
      console.log(`Fetching posts from r/${subreddit} with listing=${listing}, limit=${limit}`);
      const result = await this.executeTool<Record<string, unknown>>(
        "Reddit.GetPostsInSubreddit",
        {
          subreddit,
          listing,
          limit: Math.min(limit, 100),
        }
      );
      console.log(`Arcade response for r/${subreddit}:`, JSON.stringify(result, null, 2));

      // Handle different response formats from Arcade
      if (Array.isArray(result)) {
        return result as unknown as RedditPost[];
      }
      if (result && typeof result === "object") {
        // Arcade wraps response in "value"
        const data = "value" in result ? (result.value as Record<string, unknown>) : result;

        // Try common response shapes
        if ("posts" in data && Array.isArray(data.posts)) {
          return data.posts as RedditPost[];
        }
        if ("data" in data && Array.isArray(data.data)) {
          return data.data as RedditPost[];
        }
        if ("children" in data && Array.isArray(data.children)) {
          return data.children as RedditPost[];
        }
      }
      console.warn(`Unexpected response format from Arcade for r/${subreddit}:`, result);
      return [];
    } catch (error) {
      console.error(`Error fetching posts from r/${subreddit}:`, error);
      throw error; // Re-throw so we can see errors in the trigger response
    }
  }

  /**
   * Get posts from a subreddit with cursor for pagination
   */
  async getSubredditPostsWithCursor(
    subreddit: string,
    listing: ListingType = "new",
    limit: number = 25,
    cursor?: string,
    timeRange?: TimeRange
  ): Promise<{ posts: RedditPost[]; cursor?: string }> {
    try {
      console.log(`Fetching posts from r/${subreddit} with cursor=${cursor}, listing=${listing}, timeRange=${timeRange}`);
      const input: Record<string, unknown> = {
        subreddit,
        listing,
        limit: Math.min(limit, 100),
      };
      if (cursor) {
        input.cursor = cursor;
      }
      // time_range is required for 'top' and 'controversial' listings
      if (timeRange && (listing === "top" || listing === "controversial")) {
        input.time_range = timeRange;
      }

      const result = await this.executeTool<Record<string, unknown>>(
        "Reddit.GetPostsInSubreddit",
        input
      );

      // Handle Arcade's response format
      const data = "value" in result ? (result.value as Record<string, unknown>) : result;

      console.log("Arcade response keys:", Object.keys(data));

      let posts: RedditPost[] = [];
      let nextCursor: string | undefined;

      // Arcade returns { posts: [...], cursor: "..." }
      if ("posts" in data && Array.isArray(data.posts)) {
        posts = data.posts as RedditPost[];
      }

      if ("cursor" in data && typeof data.cursor === "string") {
        nextCursor = data.cursor;
      }

      console.log(`Got ${posts.length} posts, next cursor: ${nextCursor}`);
      return { posts, cursor: nextCursor };
    } catch (error) {
      console.error(`Error fetching posts from r/${subreddit}:`, error);
      throw error;
    }
  }

  /**
   * Get content/body of a specific post
   */
  async getPostContent(postId: string): Promise<string> {
    try {
      const result = await this.executeTool<{ content: string }>(
        "Reddit.GetContentOfPost",
        { post_id: postId }
      );
      return result.content || "";
    } catch (error) {
      console.error(`Error fetching post content ${postId}:`, error);
      return "";
    }
  }

  /**
   * Get content of multiple posts at once
   */
  async getMultiplePostContents(
    postIds: string[]
  ): Promise<Map<string, string>> {
    try {
      const result = await this.executeTool<{
        posts: Array<{ id: string; content: string }>;
      }>("Reddit.GetContentOfMultiplePosts", { post_ids: postIds });
      const contentMap = new Map<string, string>();
      for (const post of result.posts || []) {
        contentMap.set(post.id, post.content);
      }
      return contentMap;
    } catch (error) {
      console.error("Error fetching multiple post contents:", error);
      return new Map();
    }
  }

  /**
   * Get top-level comments on a post
   */
  async getPostComments(postId: string): Promise<RedditComment[]> {
    try {
      const result = await this.executeTool<{ comments: RedditComment[] }>(
        "Reddit.GetTopLevelComments",
        { post_id: postId }
      );
      return result.comments || [];
    } catch (error) {
      console.error(`Error fetching comments for ${postId}:`, error);
      return [];
    }
  }

  /**
   * Check if a subreddit is accessible
   */
  async checkSubredditAccess(subreddit: string): Promise<boolean> {
    try {
      const result = await this.executeTool<{ accessible: boolean }>(
        "Reddit.CheckSubredditAccess",
        { subreddit }
      );
      return result.accessible ?? false;
    } catch {
      return false;
    }
  }

  /**
   * Get authenticated user's username
   */
  async getMyUsername(): Promise<string | null> {
    try {
      const result = await this.executeTool<{ username: string }>(
        "Reddit.GetMyUsername",
        {}
      );
      return result.username || null;
    } catch {
      return null;
    }
  }

  /**
   * Note: Date-filtered search is NOT available via Arcade.
   * Reddit's search API with timestamp filters is not exposed.
   * Use getSubredditPostsWithCursor for pagination instead.
   * Limitation: Can only access ~1000 most recent posts.
   */
}

// Helper to create arcade client
export function createArcadeClient(apiKey: string, userId: string): ArcadeRedditClient {
  if (!apiKey) {
    throw new Error("ARCADE_API_KEY is required");
  }
  if (!userId) {
    throw new Error("userId is required for Arcade client");
  }
  return new ArcadeRedditClient(apiKey, userId);
}
