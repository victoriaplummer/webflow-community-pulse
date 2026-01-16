import type { APIRoute } from "astro";
import { getDb } from "../../db/getDb";
import { contentItems, authors, summaries } from "../../db/schema";
import { sql, gte, eq, and, desc } from "drizzle-orm";

export const GET: APIRoute = async ({ locals, url }) => {
  const db = getDb(locals);

  // Get optional filters
  const subredditFilter = url.searchParams.get("subreddit");
  const topicFilter = url.searchParams.get("topic");

  try {
    const now = Math.floor(Date.now() / 1000);
    const dayAgo = now - 24 * 60 * 60;
    const weekAgo = now - 7 * 24 * 60 * 60;

    // Build filter conditions
    const filterConditions: ReturnType<typeof eq>[] = [];
    if (subredditFilter) {
      filterConditions.push(eq(contentItems.subreddit, subredditFilter));
    }
    if (topicFilter) {
      filterConditions.push(eq(contentItems.topic, topicFilter));
    }
    const baseCondition = filterConditions.length > 0 ? and(...filterConditions) : undefined;

    // Total counts
    const totalContent = await db
      .select({ count: sql<number>`count(*)` })
      .from(contentItems)
      .where(baseCondition);

    const totalAuthors = await db
      .select({ count: sql<number>`count(*)` })
      .from(authors);

    // Content in last 24h
    const contentToday = await db
      .select({ count: sql<number>`count(*)` })
      .from(contentItems)
      .where(baseCondition ? and(gte(contentItems.ingestedAt, dayAgo), baseCondition) : gte(contentItems.ingestedAt, dayAgo));

    // Webflow-related content
    const webflowContent = await db
      .select({ count: sql<number>`count(*)` })
      .from(contentItems)
      .where(baseCondition ? and(eq(contentItems.isWebflowRelated, true), baseCondition) : eq(contentItems.isWebflowRelated, true));

    // Content needing review
    const needsReview = await db
      .select({ count: sql<number>`count(*)` })
      .from(contentItems)
      .where(baseCondition ? and(eq(contentItems.needsReview, true), baseCondition) : eq(contentItems.needsReview, true));

    // Sentiment breakdown (last 7 days)
    const sentimentConditions = [gte(contentItems.createdAt, weekAgo), eq(contentItems.isWebflowRelated, true)];
    if (baseCondition) sentimentConditions.push(baseCondition);

    const sentimentStats = await db
      .select({
        sentiment: contentItems.sentiment,
        count: sql<number>`count(*)`,
      })
      .from(contentItems)
      .where(and(...sentimentConditions))
      .groupBy(contentItems.sentiment);

    // Classification breakdown (last 7 days)
    const classificationStats = await db
      .select({
        classification: contentItems.classification,
        count: sql<number>`count(*)`,
      })
      .from(contentItems)
      .where(and(...sentimentConditions))
      .groupBy(contentItems.classification);

    // Topic breakdown (last 7 days)
    const topicStats = await db
      .select({
        topic: contentItems.topic,
        count: sql<number>`count(*)`,
      })
      .from(contentItems)
      .where(and(...sentimentConditions))
      .groupBy(contentItems.topic);

    // Subreddit breakdown (last 7 days)
    const subredditStats = await db
      .select({
        subreddit: contentItems.subreddit,
        count: sql<number>`count(*)`,
      })
      .from(contentItems)
      .where(gte(contentItems.createdAt, weekAgo))
      .groupBy(contentItems.subreddit)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(10);

    // Top contributors (by score) - filtered by subreddit if specified
    let topContributors;
    let risingContributors;

    // Exclude system/deleted accounts from contributors
    const excludedUsernames = ["[deleted]", "AutoModerator"];

    if (subredditFilter) {
      // When filtering by subreddit, get contributors who posted in that subreddit
      topContributors = await db
        .select({
          id: authors.id,
          username: authors.username,
          platform: authors.platform,
          postCount: sql<number>`count(${contentItems.id})`,
          highQualityCount: sql<number>`sum(case when ${contentItems.classification} in ('tutorial', 'resource', 'showcase') then 1 else 0 end)`,
          contributorScore: sql<number>`count(${contentItems.id}) + sum(case when ${contentItems.classification} in ('tutorial', 'resource', 'showcase') then 5 else 0 end)`,
        })
        .from(authors)
        .innerJoin(contentItems, eq(contentItems.authorId, authors.id))
        .where(and(
          eq(contentItems.subreddit, subredditFilter),
          sql`${authors.username} NOT IN (${sql.join(excludedUsernames.map(u => sql`${u}`), sql`, `)})`
        ))
        .groupBy(authors.id, authors.username, authors.platform)
        .orderBy(desc(sql`count(${contentItems.id}) + sum(case when ${contentItems.classification} in ('tutorial', 'resource', 'showcase') then 5 else 0 end)`))
        .limit(5);

      // Rising contributors - active this week in the filtered subreddit
      risingContributors = await db
        .select({
          id: authors.id,
          username: authors.username,
          platform: authors.platform,
          postCount: sql<number>`count(${contentItems.id})`,
          highQualityCount: sql<number>`sum(case when ${contentItems.classification} in ('tutorial', 'resource', 'showcase') then 1 else 0 end)`,
        })
        .from(authors)
        .innerJoin(contentItems, eq(contentItems.authorId, authors.id))
        .where(
          and(
            eq(contentItems.subreddit, subredditFilter),
            gte(contentItems.createdAt, weekAgo),
            sql`${authors.username} NOT IN (${sql.join(excludedUsernames.map(u => sql`${u}`), sql`, `)})`
          )
        )
        .groupBy(authors.id, authors.username, authors.platform)
        .having(sql`sum(case when ${contentItems.classification} in ('tutorial', 'resource', 'showcase') then 1 else 0 end) >= 1`)
        .orderBy(desc(sql`sum(case when ${contentItems.classification} in ('tutorial', 'resource', 'showcase') then 1 else 0 end)`))
        .limit(5);
    } else {
      // No filter - use global author stats
      topContributors = await db
        .select({
          id: authors.id,
          username: authors.username,
          platform: authors.platform,
          postCount: authors.postCount,
          highQualityCount: authors.highQualityCount,
          contributorScore: authors.contributorScore,
        })
        .from(authors)
        .where(sql`${authors.username} NOT IN (${sql.join(excludedUsernames.map(u => sql`${u}`), sql`, `)})`)
        .orderBy(desc(authors.contributorScore))
        .limit(5);

      risingContributors = await db
        .select({
          id: authors.id,
          username: authors.username,
          platform: authors.platform,
          postCount: authors.postCount,
          highQualityCount: authors.highQualityCount,
          lastSeen: authors.lastSeen,
        })
        .from(authors)
        .where(
          and(
            gte(authors.lastSeen, weekAgo),
            gte(authors.highQualityCount, 1),
            sql`${authors.username} NOT IN (${sql.join(excludedUsernames.map(u => sql`${u}`), sql`, `)})`
          )
        )
        .orderBy(desc(authors.highQualityCount))
        .limit(5);
    }

    // Latest summary
    const latestSummary = await db
      .select()
      .from(summaries)
      .orderBy(desc(summaries.generatedAt))
      .limit(1);

    // High engagement content (last 7 days)
    const highEngagementConditions = [gte(contentItems.createdAt, weekAgo), eq(contentItems.isWebflowRelated, true)];
    if (baseCondition) highEngagementConditions.push(baseCondition);

    const highEngagement = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
        url: contentItems.url,
        subreddit: contentItems.subreddit,
        engagementScore: contentItems.engagementScore,
        classification: contentItems.classification,
      })
      .from(contentItems)
      .where(and(...highEngagementConditions))
      .orderBy(desc(contentItems.engagementScore))
      .limit(5);

    return Response.json({
      overview: {
        totalContent: totalContent[0].count,
        totalAuthors: totalAuthors[0].count,
        contentToday: contentToday[0].count,
        webflowContent: webflowContent[0].count,
        needsReview: needsReview[0].count,
      },
      sentiment: sentimentStats.reduce(
        (acc, s) => {
          if (s.sentiment) acc[s.sentiment] = s.count;
          return acc;
        },
        {} as Record<string, number>
      ),
      classification: classificationStats.reduce(
        (acc, c) => {
          if (c.classification) acc[c.classification] = c.count;
          return acc;
        },
        {} as Record<string, number>
      ),
      topic: topicStats.reduce(
        (acc, t) => {
          if (t.topic) acc[t.topic] = t.count;
          return acc;
        },
        {} as Record<string, number>
      ),
      subreddits: subredditStats,
      topContributors,
      risingContributors,
      highEngagement,
      latestSummary: latestSummary[0]
        ? {
            ...latestSummary[0],
            content: JSON.parse(latestSummary[0].content),
          }
        : null,
      selectedSubreddit: subredditFilter || null,
      selectedTopic: topicFilter || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Stats fetch error:", error);
    return Response.json(
      { error: "Failed to fetch stats", details: String(error) },
      { status: 500 }
    );
  }
};
