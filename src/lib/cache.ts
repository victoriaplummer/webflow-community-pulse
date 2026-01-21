/**
 * Cache utility for KV-based caching
 * Handles common caching patterns with TTL support
 */

type CacheOptions = {
  ttl?: number; // Time to live in seconds (default: 5 minutes)
  prefix?: string; // Key prefix for namespacing
};

/**
 * Default TTL values for different cache types
 */
export const CacheTTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 600, // 10 minutes
  HOUR: 3600, // 1 hour
} as const;

/**
 * Generate a cache key from components
 */
export function cacheKey(...parts: (string | number | boolean | null | undefined)[]): string {
  return parts
    .filter((p) => p !== null && p !== undefined)
    .map((p) => String(p))
    .join(":");
}

/**
 * Get data from cache
 */
export async function getCache<T>(
  kv: KVNamespace,
  key: string
): Promise<T | null> {
  try {
    const cached = await kv.get(key, "json");
    if (cached) {
      console.log(`Cache HIT: ${key}`);
      return cached as T;
    }
    console.log(`Cache MISS: ${key}`);
    return null;
  } catch (error) {
    console.error(`Cache read error for ${key}:`, error);
    return null;
  }
}

/**
 * Set data in cache with TTL
 */
export async function setCache<T>(
  kv: KVNamespace,
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<void> {
  const { ttl = CacheTTL.MEDIUM } = options;

  try {
    await kv.put(key, JSON.stringify(value), {
      expirationTtl: ttl,
    });
    console.log(`Cache SET: ${key} (TTL: ${ttl}s)`);
  } catch (error) {
    console.error(`Cache write error for ${key}:`, error);
  }
}

/**
 * Delete data from cache
 */
export async function deleteCache(
  kv: KVNamespace,
  key: string
): Promise<void> {
  try {
    await kv.delete(key);
    console.log(`Cache DELETE: ${key}`);
  } catch (error) {
    console.error(`Cache delete error for ${key}:`, error);
  }
}

/**
 * Delete multiple keys matching a prefix
 */
export async function deleteCacheByPrefix(
  kv: KVNamespace,
  prefix: string
): Promise<void> {
  try {
    // List all keys with the prefix
    const list = await kv.list({ prefix });

    // Delete each key
    const deletePromises = list.keys.map((key) => kv.delete(key.name));
    await Promise.all(deletePromises);

    console.log(`Cache DELETE BY PREFIX: ${prefix} (${list.keys.length} keys)`);
  } catch (error) {
    console.error(`Cache delete by prefix error for ${prefix}:`, error);
  }
}

/**
 * Cache wrapper - get from cache or compute and store
 */
export async function cached<T>(
  kv: KVNamespace,
  key: string,
  computeFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try to get from cache
  const cached = await getCache<T>(kv, key);
  if (cached !== null) {
    return cached;
  }

  // Compute value
  const value = await computeFn();

  // Store in cache (don't await to improve response time)
  setCache(kv, key, value, options).catch((err) => {
    console.error("Background cache set failed:", err);
  });

  return value;
}

/**
 * Cache key generators for common patterns
 */
export const CacheKeys = {
  authors: (params: {
    sort?: string;
    platform?: string;
    search?: string;
    subreddit?: string;
    isStaff?: boolean;
    multiSubreddit?: boolean;
    risers?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    return cacheKey(
      "authors",
      params.sort,
      params.platform,
      params.search,
      params.subreddit,
      params.isStaff,
      params.multiSubreddit,
      params.risers,
      params.limit,
      params.offset
    );
  },

  authorProfile: (authorId: number, type?: string) => {
    return cacheKey("author", authorId, type);
  },

  authorStats: (authorId: number) => {
    return cacheKey("author-stats", authorId);
  },
} as const;

/**
 * Invalidate author-related caches
 * Call this when new posts/comments are added or authors are updated
 */
export async function invalidateAuthorCaches(
  kv: KVNamespace,
  authorId?: number
): Promise<void> {
  if (authorId) {
    // Invalidate specific author caches
    await Promise.all([
      deleteCacheByPrefix(kv, `author:${authorId}`),
      deleteCacheByPrefix(kv, `author-stats:${authorId}`),
    ]);
  }

  // Invalidate all author list caches
  await deleteCacheByPrefix(kv, "authors:");
}

/**
 * Invalidate content-related caches
 * Call this when new posts/comments are added or content is updated
 */
export async function invalidateContentCaches(kv: KVNamespace): Promise<void> {
  // Invalidate all content list caches
  await deleteCacheByPrefix(kv, "content:");
}
