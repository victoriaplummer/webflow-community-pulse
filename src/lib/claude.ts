import Anthropic from "@anthropic-ai/sdk";
import type { Sentiment, Classification, Topic } from "../db/schema";

interface AnalysisResult {
  sentiment: Sentiment;
  sentimentConfidence: number;
  classification: Classification;
  classificationConfidence: number;
  topic: Topic;
  keywords: string[];
  isWebflowRelated: boolean;
  needsReview: boolean;
  summary: string;
  qualityScore: number;
  // FAQ detection fields
  isQuestion: boolean;
  questionCategory: string | null;
  isFaqCandidate: boolean;
  suggestedResource: string | null;
  // Showcase detection
  isShowcase: boolean;
  showcaseUrl: string | null;
  // Multi-platform monitoring fields
  mentionsWebflow: boolean;
  mentionedTools: string[];
  audienceRelevance: number;
}

const ANALYSIS_PROMPT = `You are analyzing community content from web development subreddits. Categorize each post by TYPE (classification), SUBJECT (topic), and RELEVANCE to Webflow users.

Content to analyze:
Title: {title}
Body: {body}
Subreddit: {subreddit}
Flair: {flair}

Respond with ONLY valid JSON in this exact format:
{
  "sentiment": "positive" | "neutral" | "negative",
  "sentimentConfidence": 0.0-1.0,
  "classification": "question" | "showcase" | "tutorial" | "resource" | "feedback_request" | "discussion" | "announcement" | "rant" | "self_promo" | "spam",
  "classificationConfidence": 0.0-1.0,
  "topic": "cms" | "ecommerce" | "animations" | "custom_code" | "design" | "hosting" | "seo" | "integrations" | "performance" | "pricing" | "ai_tools" | "career" | "workflow" | "migration" | "comparison" | "troubleshooting" | "frameworks" | "javascript" | "css_styling" | "responsive_design" | "no_code_tools" | "accessibility" | "api_development" | "security" | "general",
  "keywords": ["keyword1", "keyword2"],
  "isWebflowRelated": true | false,
  "mentionsWebflow": true | false,
  "mentionedTools": ["tool1", "tool2"],
  "audienceRelevance": 1-10,
  "summary": "A 1-2 sentence summary of what this post is about",
  "qualityScore": 1-10,
  "isQuestion": true | false,
  "questionCategory": "category" | null,
  "isFaqCandidate": true | false,
  "suggestedResource": "description of resource that could answer this" | null,
  "isShowcase": true | false,
  "showcaseUrl": "URL to the showcased project" | null
}

=== TOOL/PLATFORM DETECTION ===
mentionedTools: Array of platforms/tools EXPLICITLY mentioned in the post. Detect these:
- No-code: webflow, framer, squarespace, wix, shopify, editor_x, carrd, bubble, softr, webstudio
- CMS: wordpress, ghost, contentful, sanity, strapi
- Frameworks: react, nextjs, vue, svelte, astro

mentionsWebflow: TRUE only if "webflow" is explicitly mentioned (case-insensitive)

isWebflowRelated: TRUE if:
- Post is from r/webflow, OR
- Webflow is mentioned, OR
- Topic is highly relevant to Webflow users (no-code tools, visual design, CMS)

=== AUDIENCE RELEVANCE (1-10) ===
How relevant is this post to someone who uses or is interested in Webflow?

10: Directly about Webflow
8-9: About Webflow alternatives/competitors (Framer, Squarespace), or migration to/from Webflow
6-7: About no-code tools, visual web builders, or topics Webflow excels at (CMS, animations, design)
4-5: General web design/development that could apply to Webflow users
2-3: Developer-focused content (coding frameworks, backend) with minimal Webflow overlap
1: Completely unrelated to Webflow user interests

=== CLASSIFICATION (Post Type) ===
What KIND of post is this?

- question: Asking for help, advice, or information (has "?" or seeking answers)
- showcase: Showing off completed work ("Check out my site", "Just launched", "Here's what I built")
- tutorial: Teaching how to do something step-by-step
- resource: Sharing a tool, template, link, or useful reference
- feedback_request: Asking for critique/feedback on work-in-progress ("thoughts?", "feedback please")
- discussion: General conversation, opinion sharing, or debate
- announcement: News, updates, releases, or event info
- rant: Venting frustration, complaints (often negative sentiment)
- self_promo: Promoting services, hiring posts, or advertising
- spam: Irrelevant, bot content, or garbage

=== TOPIC (Subject Matter) ===
What is this post ABOUT? Assign ONE topic to EVERY post:

EXISTING TOPICS:
- cms: CMS collections, dynamic content, filtering
- ecommerce: Online stores, payments, products, checkout
- animations: Interactions, scroll effects, motion design
- custom_code: HTML/CSS/JS embeds, code solutions
- design: Layout, styling, typography, UI/UX
- hosting: Publishing, domains, SSL, DNS
- seo: Search optimization, meta tags, indexing
- integrations: Third-party tools, APIs, forms, webhooks
- performance: Speed, optimization, Core Web Vitals
- pricing: Plans, billing, feature availability
- ai_tools: AI-assisted development, vibe coding
- career: Jobs, freelancing, learning, portfolio advice
- workflow: Naming conventions, best practices
- migration: Moving between platforms
- comparison: Tool vs tool discussions
- troubleshooting: Bugs, errors, fixes

NEW UNIVERSAL TOPICS:
- frameworks: React, Vue, Next.js, Svelte, framework discussions
- javascript: JS-specific discussions, vanilla JS, TypeScript
- css_styling: CSS techniques, Tailwind, styling approaches
- responsive_design: Mobile-first, breakpoints, responsive layouts
- no_code_tools: General no-code/low-code discussions
- accessibility: A11y, WCAG, screen readers, inclusive design
- api_development: APIs, headless architecture, backend integration
- security: Web security, authentication, data protection
- general: Doesn't fit other categories

=== QUALITY SCORE (1-10) ===
- 1-3: Low quality (spam, self-promo, very low effort)
- 4-5: Below average (basic questions, minimal detail)
- 6-7: Average (decent discussion, clear question)
- 8-9: High quality (well-written, helpful, insightful)
- 10: Exceptional (expert-level content, highly valuable)

=== QUESTION CATEGORY ===
If isQuestion=true, also set questionCategory to one of:
getting_started, cms, ecommerce, animations, custom_code, seo, hosting, pricing, integrations, design, performance, migration, comparison, troubleshooting, best_practices, other

=== FAQ CANDIDATE ===
isFaqCandidate = TRUE if:
- Beginner question asked frequently
- Could be answered with standard documentation
- Answer is not unique to their specific project

=== SHOWCASE DETECTION ===
isShowcase = TRUE ONLY if:
- Showing COMPLETED work (not asking for help)
- Presentational tone ("Check out", "Just launched", "Built this")
- NOT asking questions (even "thoughts?" = NOT showcase, use feedback_request)
- Flair "Show and Tell" is a strong signal

showcaseUrl: Extract project URL if present`;

export async function analyzeContent(
  apiKey: string,
  content: {
    title?: string | null;
    body: string;
    subreddit?: string | null;
    flair?: string | null;
  }
): Promise<AnalysisResult> {
  const client = new Anthropic({ apiKey });

  const prompt = ANALYSIS_PROMPT
    .replace("{title}", content.title || "(no title)")
    .replace("{body}", content.body.slice(0, 2000)) // Limit body length
    .replace("{subreddit}", content.subreddit || "(unknown)")
    .replace("{flair}", content.flair || "(none)");

  try {
    const response = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    let responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Strip markdown code blocks if present
    responseText = responseText.trim();
    if (responseText.startsWith("```json")) {
      responseText = responseText.slice(7);
    } else if (responseText.startsWith("```")) {
      responseText = responseText.slice(3);
    }
    if (responseText.endsWith("```")) {
      responseText = responseText.slice(0, -3);
    }
    responseText = responseText.trim();

    // Parse JSON response
    const parsed = JSON.parse(responseText);

    // Determine if needs review based on low confidence
    const needsReview =
      parsed.sentimentConfidence < 0.6 || parsed.classificationConfidence < 0.6;

    return {
      sentiment: parsed.sentiment,
      sentimentConfidence: parsed.sentimentConfidence,
      classification: parsed.classification,
      classificationConfidence: parsed.classificationConfidence,
      topic: parsed.topic || "general",
      keywords: parsed.keywords || [],
      isWebflowRelated: parsed.isWebflowRelated ?? false,
      needsReview,
      summary: parsed.summary || "",
      qualityScore: parsed.qualityScore ?? 5,
      isQuestion: parsed.isQuestion ?? false,
      questionCategory: parsed.questionCategory || null,
      isFaqCandidate: parsed.isFaqCandidate ?? false,
      suggestedResource: parsed.suggestedResource || null,
      isShowcase: parsed.isShowcase ?? false,
      showcaseUrl: parsed.showcaseUrl || null,
      // Multi-platform monitoring fields
      mentionsWebflow: parsed.mentionsWebflow ?? false,
      mentionedTools: parsed.mentionedTools || [],
      audienceRelevance: parsed.audienceRelevance ?? 5,
    };
  } catch (error) {
    console.error("Failed to analyze content:", error);
    // Return safe defaults on error
    return {
      sentiment: "neutral",
      sentimentConfidence: 0,
      classification: "discussion",
      classificationConfidence: 0,
      topic: "general",
      keywords: [],
      isWebflowRelated: false,
      needsReview: true,
      summary: "",
      qualityScore: 5,
      isQuestion: false,
      questionCategory: null,
      isFaqCandidate: false,
      suggestedResource: null,
      isShowcase: false,
      showcaseUrl: null,
      // Multi-platform monitoring fields
      mentionsWebflow: false,
      mentionedTools: [],
      audienceRelevance: 5,
    };
  }
}

const SUMMARY_PROMPT = `You are creating a community pulse summary for Webflow-related discussions. Analyze the following content items and create a summary.

Content items:
{items}

Create a JSON response with this structure:
{
  "themes": [
    { "name": "theme name", "count": number, "sentiment": "positive" | "neutral" | "negative" }
  ],
  "notableThreads": [
    { "title": "thread title", "url": "url", "reason": "why it's notable" }
  ],
  "sentimentOverview": {
    "positive": percentage,
    "neutral": percentage,
    "negative": percentage,
    "trend": "improving" | "stable" | "declining"
  },
  "opportunities": [
    { "type": "engagement" | "documentation" | "feature_request", "description": "what the opportunity is", "priority": "high" | "medium" | "low" }
  ],
  "topContributors": [
    { "username": "name", "platform": "reddit", "contributions": number, "quality": "high" | "medium" }
  ],
  "keyInsights": ["insight 1", "insight 2"]
}`;

export async function generateSummary(
  apiKey: string,
  items: Array<{
    title?: string | null;
    body: string;
    url: string;
    sentiment?: string | null;
    classification?: string | null;
    authorUsername?: string;
    subreddit?: string | null;
  }>
): Promise<object> {
  const client = new Anthropic({ apiKey });

  const itemsText = items
    .slice(0, 50) // Limit to 50 items for context window
    .map(
      (item, i) =>
        `${i + 1}. [${item.subreddit || "unknown"}] ${item.title || "(comment)"}: ${item.body.slice(0, 200)}... (sentiment: ${item.sentiment}, classification: ${item.classification}, by: ${item.authorUsername || "unknown"})`
    )
    .join("\n");

  const prompt = SUMMARY_PROMPT.replace("{items}", itemsText);

  try {
    const response = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    let responseText =
      response.content[0].type === "text" ? response.content[0].text : "{}";

    // Strip markdown code blocks if present
    responseText = responseText.trim();
    if (responseText.startsWith("```json")) {
      responseText = responseText.slice(7);
    } else if (responseText.startsWith("```")) {
      responseText = responseText.slice(3);
    }
    if (responseText.endsWith("```")) {
      responseText = responseText.slice(0, -3);
    }
    responseText = responseText.trim();

    return JSON.parse(responseText);
  } catch (error) {
    console.error("Failed to generate summary:", error);
    return {
      themes: [],
      notableThreads: [],
      sentimentOverview: { positive: 0, neutral: 100, negative: 0, trend: "stable" },
      opportunities: [],
      topContributors: [],
      keyInsights: ["Failed to generate summary"],
    };
  }
}

// Insights generation for DevRel/Community Manager
interface InsightItem {
  type: "pain_point" | "feature_request" | "opportunity" | "highlight" | "trend";
  title: string;
  description: string;
  evidence: number[]; // content_item IDs
  priority: "high" | "medium" | "low";
}

interface InsightsResult {
  insights: InsightItem[];
  generatedAt: number;
}

const INSIGHTS_PROMPT = `You are a DevRel/Community Manager analyst for Webflow. Analyze the following community content and extract actionable insights.

Content items from the last 7-14 days:
{items}

Generate insights in these categories:
1. **Pain Points** - Recurring issues, frustrations, bugs users are experiencing
2. **Feature Requests** - What users wish Webflow had or could do better
3. **Content Opportunities** - Questions that need official documentation or tutorials
4. **Community Highlights** - Great showcases, helpful contributors, valuable discussions
5. **Trending Topics** - What's being discussed frequently right now

For each insight:
- Title: A concise, actionable title (max 10 words)
- Description: 2-3 sentences explaining the insight with context
- Evidence: Array of post IDs (numbers) that support this insight
- Priority: "high" (urgent/widespread), "medium" (notable), "low" (minor)

Respond with ONLY valid JSON in this format:
{
  "insights": [
    {
      "type": "pain_point",
      "title": "CMS filtering causes confusion",
      "description": "Multiple users this week struggled with conditional visibility and CMS filter logic. Common issues include filters not working as expected and difficulty combining multiple conditions.",
      "evidence": [123, 456, 789],
      "priority": "high"
    },
    {
      "type": "feature_request",
      "title": "Native dark mode support requested",
      "description": "Several posts asking for built-in dark mode theming. Users currently implement workarounds with custom code.",
      "evidence": [234, 567],
      "priority": "medium"
    }
  ]
}

Generate 3-5 insights per category (15-25 total). Focus on actionable items that a community manager could respond to or escalate. Only include insights with clear evidence from the provided posts.`;

export async function generateInsights(
  apiKey: string,
  items: Array<{
    id: number;
    title?: string | null;
    body: string;
    url: string;
    sentiment?: string | null;
    classification?: string | null;
    qualityScore?: number | null;
    questionCategory?: string | null;
    isFaqCandidate?: boolean;
    isShowcase?: boolean;
    authorUsername?: string | null;
    subreddit?: string | null;
    createdAt: number;
  }>
): Promise<InsightsResult> {
  const client = new Anthropic({ apiKey });

  // Format items for the prompt, including IDs for evidence tracking
  const itemsText = items
    .slice(0, 100) // Limit to 100 items
    .map((item) => {
      const tags = [];
      if (item.sentiment === "negative") tags.push("NEGATIVE");
      if (item.isFaqCandidate) tags.push("FAQ");
      if (item.isShowcase) tags.push("SHOWCASE");
      if (item.qualityScore && item.qualityScore >= 7) tags.push("HIGH-QUALITY");
      if (item.questionCategory) tags.push(`Q:${item.questionCategory}`);

      const tagStr = tags.length > 0 ? ` [${tags.join(", ")}]` : "";
      const date = new Date(item.createdAt * 1000).toLocaleDateString();

      return `ID:${item.id}${tagStr} (${date}) "${item.title || "(no title)"}": ${item.body.slice(0, 300)}${item.body.length > 300 ? "..." : ""} (by: ${item.authorUsername || "unknown"}, sentiment: ${item.sentiment}, class: ${item.classification})`;
    })
    .join("\n\n");

  const prompt = INSIGHTS_PROMPT.replace("{items}", itemsText);

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514", // Use Sonnet for better analysis
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    let responseText =
      response.content[0].type === "text" ? response.content[0].text : "{}";

    // Strip markdown code blocks if present
    responseText = responseText.trim();
    if (responseText.startsWith("```json")) {
      responseText = responseText.slice(7);
    } else if (responseText.startsWith("```")) {
      responseText = responseText.slice(3);
    }
    if (responseText.endsWith("```")) {
      responseText = responseText.slice(0, -3);
    }
    responseText = responseText.trim();

    const parsed = JSON.parse(responseText);

    return {
      insights: parsed.insights || [],
      generatedAt: Math.floor(Date.now() / 1000),
    };
  } catch (error) {
    console.error("Failed to generate insights:", error);
    return {
      insights: [],
      generatedAt: Math.floor(Date.now() / 1000),
    };
  }
}
