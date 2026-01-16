// AI draft generation for roundups
import type { APIRoute } from "astro";
import { getDb } from "../../../../db/getDb";
import { roundups, roundupItems, contentItems, authors } from "../../../../db/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

export const POST: APIRoute = async ({ locals, params }) => {
  const db = getDb(locals);
  const user = locals.user;
  const env = locals.runtime.env;
  const roundupId = parseInt(params.id || "", 10);

  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  if (isNaN(roundupId)) {
    return Response.json({ error: "Invalid roundup ID" }, { status: 400 });
  }

  const anthropicKey = env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  try {
    // Get the roundup
    const [roundup] = await db
      .select()
      .from(roundups)
      .where(eq(roundups.id, roundupId))
      .limit(1);

    if (!roundup) {
      return Response.json({ error: "Roundup not found" }, { status: 404 });
    }

    // Get items already selected for the roundup
    const selectedItems = await db
      .select({
        id: roundupItems.id,
        section: roundupItems.section,
        pullQuote: roundupItems.pullQuote,
        note: roundupItems.note,
        contentId: contentItems.id,
        title: contentItems.title,
        body: contentItems.body,
        summary: contentItems.summary,
        url: contentItems.url,
        subreddit: contentItems.subreddit,
        flair: contentItems.flair,
        classification: contentItems.classification,
        topic: contentItems.topic,
        qualityScore: contentItems.qualityScore,
        engagementScore: contentItems.engagementScore,
        authorUsername: authors.username,
      })
      .from(roundupItems)
      .innerJoin(contentItems, eq(roundupItems.contentId, contentItems.id))
      .leftJoin(authors, eq(contentItems.authorId, authors.id))
      .where(eq(roundupItems.roundupId, roundupId))
      .orderBy(roundupItems.section, roundupItems.displayOrder);

    // Get high-engagement posts from the date range (for trending topics)
    const trendingPosts = await db
      .select({
        topic: contentItems.topic,
        count: sql<number>`count(*)`,
      })
      .from(contentItems)
      .where(
        and(
          gte(contentItems.createdAt, roundup.dateFrom),
          lte(contentItems.createdAt, roundup.dateTo)
        )
      )
      .groupBy(contentItems.topic)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    // Get top contributors from the date range (most quality posts)
    const topContributors = await db
      .select({
        username: authors.username,
        postCount: sql<number>`count(*)`,
        avgQuality: sql<number>`AVG(${contentItems.qualityScore})`,
        totalEngagement: sql<number>`SUM(${contentItems.engagementScore})`,
      })
      .from(contentItems)
      .innerJoin(authors, eq(contentItems.authorId, authors.id))
      .where(
        and(
          gte(contentItems.createdAt, roundup.dateFrom),
          lte(contentItems.createdAt, roundup.dateTo),
          gte(contentItems.qualityScore, 6)
        )
      )
      .groupBy(authors.username)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    // Get helpful community members (those who post answers/resources/tutorials)
    const helpfulMembers = await db
      .select({
        username: authors.username,
        helpfulPosts: sql<number>`count(*)`,
        avgQuality: sql<number>`AVG(${contentItems.qualityScore})`,
      })
      .from(contentItems)
      .innerJoin(authors, eq(contentItems.authorId, authors.id))
      .where(
        and(
          gte(contentItems.createdAt, roundup.dateFrom),
          lte(contentItems.createdAt, roundup.dateTo),
          sql`${contentItems.classification} IN ('resource', 'tutorial', 'discussion')`,
          gte(contentItems.qualityScore, 7)
        )
      )
      .groupBy(authors.username)
      .orderBy(desc(sql`AVG(${contentItems.qualityScore})`))
      .limit(5);

    // Get showcase creators
    const showcaseCreators = await db
      .select({
        username: authors.username,
        showcaseCount: sql<number>`count(*)`,
        avgQuality: sql<number>`AVG(${contentItems.qualityScore})`,
      })
      .from(contentItems)
      .innerJoin(authors, eq(contentItems.authorId, authors.id))
      .where(
        and(
          gte(contentItems.createdAt, roundup.dateFrom),
          lte(contentItems.createdAt, roundup.dateTo),
          eq(contentItems.isShowcase, true)
        )
      )
      .groupBy(authors.username)
      .orderBy(desc(sql`AVG(${contentItems.qualityScore})`))
      .limit(5);

    // Get rising contributors (first-time or new contributors this period with quality posts)
    const risingContributors = await db
      .select({
        username: authors.username,
        postCount: sql<number>`count(*)`,
        avgQuality: sql<number>`AVG(${contentItems.qualityScore})`,
      })
      .from(contentItems)
      .innerJoin(authors, eq(contentItems.authorId, authors.id))
      .where(
        and(
          gte(contentItems.createdAt, roundup.dateFrom),
          lte(contentItems.createdAt, roundup.dateTo),
          gte(contentItems.qualityScore, 6),
          // Authors whose first post is within this date range
          gte(authors.firstSeen, roundup.dateFrom)
        )
      )
      .groupBy(authors.username)
      .orderBy(desc(sql`AVG(${contentItems.qualityScore})`))
      .limit(3);

    // Format date range
    const dateFromStr = new Date(roundup.dateFrom * 1000).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const dateToStr = new Date(roundup.dateTo * 1000).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    // Group items by section
    const showcaseItems = selectedItems.filter(
      (i) => i.section === "showcase" || i.flair?.toLowerCase().includes("show")
    );
    const feedbackItems = selectedItems.filter(
      (i) => i.section === "feedback" || i.classification === "feedback_request"
    );
    const resourceItems = selectedItems.filter(
      (i) => i.section === "resource" || i.classification === "resource" || i.classification === "tutorial"
    );
    const highlightItems = selectedItems.filter(
      (i) => i.section === "highlight" && !showcaseItems.includes(i) && !feedbackItems.includes(i) && !resourceItems.includes(i)
    );

    // Build the prompt
    const prompt = `You are creating a weekly community roundup post for r/webflow. Write an engaging, community-focused post highlighting the best content from the week.

Date Range: ${dateFromStr} to ${dateToStr}

## Content to Include:

### Showcases (Show and Tell):
${showcaseItems.length > 0 ? showcaseItems.map((item) => `- "${item.title}" by u/${item.authorUsername || "anonymous"} (${item.url})
  Summary: ${item.summary || "No summary"}
  ${item.pullQuote ? `Pull quote: "${item.pullQuote}"` : ""}
  ${item.note ? `Editor note: ${item.note}` : ""}`).join("\n\n") : "No showcases selected"}

### Feedback Requests / Looking for Help:
${feedbackItems.length > 0 ? feedbackItems.map((item) => `- "${item.title}" by u/${item.authorUsername || "anonymous"} (${item.url})
  Summary: ${item.summary || "No summary"}`).join("\n\n") : "No feedback requests selected"}

### Great Resources/Tutorials:
${resourceItems.length > 0 ? resourceItems.map((item) => `- "${item.title}" by u/${item.authorUsername || "anonymous"} (${item.url})
  Summary: ${item.summary || "No summary"}`).join("\n\n") : "No resources selected"}

### Other Highlights:
${highlightItems.length > 0 ? highlightItems.map((item) => `- "${item.title}" by u/${item.authorUsername || "anonymous"} (${item.url})
  Summary: ${item.summary || "No summary"}`).join("\n\n") : "No other highlights"}

### Trending Topics This Week:
${trendingPosts.map((t) => `- ${(t.topic || "general").replace(/_/g, " ")}: ${t.count} posts`).join("\n")}

### Community Shoutouts:

**Most Active Contributors** (consistently sharing quality content):
${topContributors.length > 0 ? topContributors.map((c) => `- u/${c.username}: ${c.postCount} quality posts, ${Math.round(c.totalEngagement || 0)} total engagement`).join("\n") : "No top contributors this period"}

**Helpful Community Members** (sharing resources, tutorials, and helpful discussions):
${helpfulMembers.length > 0 ? helpfulMembers.map((c) => `- u/${c.username}: ${c.helpfulPosts} helpful posts (avg quality: ${Math.round((c.avgQuality || 0) * 10) / 10}/10)`).join("\n") : "No helpful members identified this period"}

**Showcase Creators** (sharing their amazing work):
${showcaseCreators.length > 0 ? showcaseCreators.map((c) => `- u/${c.username}: ${c.showcaseCount} showcase${c.showcaseCount > 1 ? "s" : ""}`).join("\n") : "No showcase creators this period"}

**Rising Stars** (new community members making great contributions):
${risingContributors.length > 0 ? risingContributors.map((c) => `- u/${c.username}: Welcome to the community! ${c.postCount} quality post${c.postCount > 1 ? "s" : ""} already`).join("\n") : "No new contributors this period"}

## Guidelines:
- Warm, encouraging, community-focused tone
- Celebrate community achievements and contributions - this is IMPORTANT!
- Create a dedicated "Community Shoutouts" section to recognize helpful members
- Include u/username mentions for contributors (Reddit format)
- Include links to posts in Reddit markdown format [title](url)
- Keep sections concise but informative
- Welcome new members and highlight rising stars
- Thank people who helped others or shared valuable resources
- End with a call-to-action (share your projects, ask questions, join the discussion, etc.)
- Use Reddit markdown format with proper headers (##), bullet points, and links
- Make it feel like a community newsletter that celebrates the people, not just the content

Generate a complete roundup post ready to copy to Reddit:`;

    const client = new Anthropic({ apiKey: anthropicKey });
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const generatedContent = message.content[0].type === "text" ? message.content[0].text : "";

    // Save the generated content to the roundup
    await db
      .update(roundups)
      .set({
        content: generatedContent,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(roundups.id, roundupId));

    return Response.json({
      success: true,
      content: generatedContent,
      stats: {
        showcases: showcaseItems.length,
        feedback: feedbackItems.length,
        resources: resourceItems.length,
        highlights: highlightItems.length,
        trendingTopics: trendingPosts.length,
        topContributors: topContributors.length,
        helpfulMembers: helpfulMembers.length,
        showcaseCreators: showcaseCreators.length,
        risingStars: risingContributors.length,
      },
    });
  } catch (error) {
    console.error("Generate roundup error:", error);
    return Response.json(
      { error: "Failed to generate roundup", details: String(error) },
      { status: 500 }
    );
  }
};
