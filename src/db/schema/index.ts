import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// Authors table - tracks content contributors
export const authors = sqliteTable(
  "authors",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    platform: text("platform").notNull(), // "reddit" | "linkedin"
    platformId: text("platform_id").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    firstSeen: integer("first_seen").notNull(), // unix timestamp
    lastSeen: integer("last_seen").notNull(),
    postCount: integer("post_count").notNull().default(0),
    highQualityCount: integer("high_quality_count").notNull().default(0),
    totalEngagement: integer("total_engagement").notNull().default(0),
    contributorScore: real("contributor_score").notNull().default(0),
    isWebflowStaff: integer("is_webflow_staff", { mode: "boolean" })
      .notNull()
      .default(false),
    subreddits: text("subreddits"), // JSON array of subreddit names
  },
  (table) => [
    uniqueIndex("authors_platform_id_idx").on(table.platform, table.platformId),
    index("authors_score_idx").on(table.contributorScore),
    index("authors_webflow_staff_idx").on(table.isWebflowStaff),
  ]
);

// Content items table - posts and comments from platforms
export const contentItems = sqliteTable(
  "content_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    platform: text("platform").notNull(), // "reddit" | "linkedin"
    platformId: text("platform_id").notNull(),
    type: text("type").notNull(), // "post" | "comment"
    title: text("title"), // nullable, posts only
    body: text("body").notNull(),
    url: text("url").notNull(),
    subreddit: text("subreddit"), // nullable, reddit only
    flair: text("flair"), // Reddit post flair (e.g., "Show and Tell", "Help", "Resource")
    authorId: integer("author_id").references(() => authors.id),
    parentId: integer("parent_id"), // self-reference for comments
    createdAt: integer("created_at").notNull(), // unix timestamp from platform
    ingestedAt: integer("ingested_at").notNull(), // when we imported it
    // Classification fields
    sentiment: text("sentiment"), // "positive" | "neutral" | "negative"
    sentimentConfidence: real("sentiment_confidence"),
    classification: text("classification"), // "question" | "showcase" | "tutorial" | "resource" | "feedback_request" | "discussion" | "announcement" | "rant" | "self_promo" | "spam"
    classificationConfidence: real("classification_confidence"),
    needsReview: integer("needs_review", { mode: "boolean" }).notNull().default(false),
    engagementScore: real("engagement_score").notNull().default(0),
    // Keywords for filtering
    keywords: text("keywords"), // JSON array of detected keywords
    isWebflowRelated: integer("is_webflow_related", { mode: "boolean" }).notNull().default(false),
    // Topic categorization (applies to ALL posts)
    topic: text("topic"), // "cms" | "ecommerce" | "animations" | "custom_code" | "design" | "hosting" | "seo" | "integrations" | "performance" | "pricing" | "ai_tools" | "career" | "workflow" | "migration" | "comparison" | "troubleshooting" | "general"
    // AI-generated summary and quality
    summary: text("summary"), // Brief summary of the post content
    qualityScore: integer("quality_score"), // 1-10 quality rating
    // FAQ detection fields
    isQuestion: integer("is_question", { mode: "boolean" }).notNull().default(false),
    questionCategory: text("question_category"), // e.g., "cms", "animations", "pricing"
    isFaqCandidate: integer("is_faq_candidate", { mode: "boolean" }).notNull().default(false),
    suggestedResource: text("suggested_resource"), // What resource could answer this
    // Showcase detection
    isShowcase: integer("is_showcase", { mode: "boolean" }).notNull().default(false),
    showcaseUrl: text("showcase_url"), // URL to the showcased project/site
    // Roundup selection
    isRoundupCandidate: integer("is_roundup_candidate", { mode: "boolean" }).notNull().default(false),
    // Multi-platform monitoring fields
    mentionsWebflow: integer("mentions_webflow", { mode: "boolean" }).notNull().default(false),
    mentionedTools: text("mentioned_tools"), // JSON array of tools mentioned (e.g., ["webflow", "framer"])
    audienceRelevance: integer("audience_relevance"), // 1-10 relevance to Webflow audience
  },
  (table) => [
    uniqueIndex("content_platform_id_idx").on(table.platform, table.platformId),
    index("content_sentiment_idx").on(table.sentiment),
    index("content_classification_idx").on(table.classification),
    index("content_subreddit_idx").on(table.subreddit),
    index("content_created_idx").on(table.createdAt),
    index("content_webflow_idx").on(table.isWebflowRelated),
    index("content_question_category_idx").on(table.questionCategory),
    index("content_faq_candidate_idx").on(table.isFaqCandidate),
    index("content_showcase_idx").on(table.isShowcase),
    index("content_flair_idx").on(table.flair),
    index("content_topic_idx").on(table.topic),
    index("content_roundup_candidate_idx").on(table.isRoundupCandidate),
    index("content_mentions_webflow_idx").on(table.mentionsWebflow),
    index("content_audience_relevance_idx").on(table.audienceRelevance),
  ]
);

// Engagement snapshots - track engagement over time
export const engagementSnapshots = sqliteTable(
  "engagement_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contentId: integer("content_id")
      .notNull()
      .references(() => contentItems.id),
    capturedAt: integer("captured_at").notNull(), // unix timestamp
    upvotes: integer("upvotes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    shares: integer("shares"), // nullable, not all platforms have this
  },
  (table) => [
    index("engagement_content_idx").on(table.contentId),
    index("engagement_captured_idx").on(table.capturedAt),
  ]
);

// Summaries - generated digests
export const summaries = sqliteTable(
  "summaries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    periodStart: integer("period_start").notNull(),
    periodEnd: integer("period_end").notNull(),
    summaryType: text("summary_type").notNull(), // "daily" | "weekly"
    content: text("content").notNull(), // JSON blob with themes, trends, opportunities
    generatedAt: integer("generated_at").notNull(),
  },
  (table) => [
    index("summaries_type_idx").on(table.summaryType),
    index("summaries_period_idx").on(table.periodStart, table.periodEnd),
  ]
);

// Users - authenticated users via Google OAuth
export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    googleId: text("google_id").notNull(),
    createdAt: integer("created_at").notNull(), // unix timestamp
    lastLogin: integer("last_login").notNull(), // unix timestamp
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    uniqueIndex("users_google_id_idx").on(table.googleId),
  ]
);

// Sessions - user sessions for authentication
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // random session token
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    expiresAt: integer("expires_at").notNull(), // unix timestamp
    createdAt: integer("created_at").notNull(), // unix timestamp
  },
  (table) => [
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_idx").on(table.expiresAt),
  ]
);

// Insight generations - tracks each generation run (like roundups)
export const insightGenerations = sqliteTable(
  "insight_generations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subreddit: text("subreddit"), // null = all subreddits
    periodDays: integer("period_days").notNull().default(14), // how many days of content analyzed
    contentAnalyzed: integer("content_analyzed").notNull().default(0), // how many items were analyzed
    insightCount: integer("insight_count").notNull().default(0), // how many insights generated
    generatedAt: integer("generated_at").notNull(), // unix timestamp
  },
  (table) => [
    index("insight_generations_subreddit_idx").on(table.subreddit),
    index("insight_generations_generated_at_idx").on(table.generatedAt),
  ]
);

// Insights - AI-generated community insights
export const insights = sqliteTable(
  "insights",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    generationId: integer("generation_id").references(() => insightGenerations.id), // links to generation run
    type: text("type").notNull(), // "pain_point" | "feature_request" | "opportunity" | "highlight" | "trend"
    title: text("title").notNull(),
    description: text("description").notNull(),
    evidence: text("evidence").notNull(), // JSON array of content_item IDs
    priority: text("priority").notNull(), // "high" | "medium" | "low"
    subreddit: text("subreddit"), // null = all subreddits (for filtering)
    generatedAt: integer("generated_at").notNull(), // unix timestamp
  },
  (table) => [
    index("insights_generation_idx").on(table.generationId),
    index("insights_type_idx").on(table.type),
    index("insights_priority_idx").on(table.priority),
    index("insights_subreddit_idx").on(table.subreddit),
    index("insights_generated_at_idx").on(table.generatedAt),
  ]
);

// Roundups - community roundup posts
export const roundups = sqliteTable(
  "roundups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(), // e.g., "Weekly Roundup - Jan 13-20"
    status: text("status").notNull().default("draft"), // "draft" | "published"
    dateFrom: integer("date_from").notNull(), // unix timestamp
    dateTo: integer("date_to").notNull(), // unix timestamp
    content: text("content"), // the generated/edited markdown
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("roundups_status_idx").on(table.status),
    index("roundups_date_idx").on(table.dateFrom, table.dateTo),
  ]
);

// Roundup items - posts included in a roundup
export const roundupItems = sqliteTable(
  "roundup_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    roundupId: integer("roundup_id").references(() => roundups.id), // nullable for unassigned starred posts
    contentId: integer("content_id")
      .notNull()
      .references(() => contentItems.id),
    section: text("section").notNull().default("highlight"), // "showcase" | "feedback" | "resource" | "trending" | "highlight"
    pullQuote: text("pull_quote"), // optional quote from the post
    note: text("note"), // optional editor note
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("roundup_items_roundup_idx").on(table.roundupId),
    index("roundup_items_content_idx").on(table.contentId),
    index("roundup_items_section_idx").on(table.section),
  ]
);

// Seed history - tracks which data syncs have been applied
export const seedHistory = sqliteTable(
  "seed_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    seedName: text("seed_name").notNull(),
    seedVersion: integer("seed_version").notNull(),
    recordCount: integer("record_count").notNull().default(0),
    appliedAt: integer("applied_at").notNull(),
  },
  (table) => [
    uniqueIndex("seed_history_name_version_idx").on(table.seedName, table.seedVersion),
  ]
);

// Type exports for use in API routes
export type Author = typeof authors.$inferSelect;
export type NewAuthor = typeof authors.$inferInsert;
export type ContentItem = typeof contentItems.$inferSelect;
export type NewContentItem = typeof contentItems.$inferInsert;
export type EngagementSnapshot = typeof engagementSnapshots.$inferSelect;
export type NewEngagementSnapshot = typeof engagementSnapshots.$inferInsert;
export type Summary = typeof summaries.$inferSelect;
export type NewSummary = typeof summaries.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;
export type Roundup = typeof roundups.$inferSelect;
export type NewRoundup = typeof roundups.$inferInsert;
export type RoundupItem = typeof roundupItems.$inferSelect;
export type NewRoundupItem = typeof roundupItems.$inferInsert;

// Classification types
export type Sentiment = "positive" | "neutral" | "negative";
export type Classification =
  | "question"
  | "showcase"
  | "tutorial"
  | "resource"
  | "feedback_request"
  | "discussion"
  | "announcement"
  | "rant"
  | "self_promo"
  | "spam";
export type Topic =
  // Existing topics
  | "cms"
  | "ecommerce"
  | "animations"
  | "custom_code"
  | "design"
  | "hosting"
  | "seo"
  | "integrations"
  | "performance"
  | "pricing"
  | "ai_tools"
  | "career"
  | "workflow"
  | "migration"
  | "comparison"
  | "troubleshooting"
  | "general"
  // New universal topics for broader web dev
  | "frameworks"        // React, Vue, Next.js, etc.
  | "javascript"        // JS-specific discussions
  | "css_styling"       // CSS, Tailwind, styling approaches
  | "responsive_design" // Mobile-first, breakpoints
  | "no_code_tools"     // General no-code/low-code discussions
  | "accessibility"     // A11y, WCAG
  | "api_development"   // APIs, headless architecture
  | "security";         // Web security

// Tools/platforms that can be mentioned
export type MentionedTool =
  // No-code platforms
  | "webflow"
  | "framer"
  | "squarespace"
  | "wix"
  | "shopify"
  | "editor_x"
  | "carrd"
  | "bubble"
  | "softr"
  | "webstudio"
  // CMS platforms
  | "wordpress"
  | "ghost"
  | "contentful"
  | "sanity"
  | "strapi"
  // Frameworks
  | "react"
  | "nextjs"
  | "vue"
  | "svelte"
  | "astro";
export type Platform = "reddit" | "linkedin";
export type ContentType = "post" | "comment";
export type InsightType = "pain_point" | "feature_request" | "opportunity" | "highlight" | "trend";
export type InsightPriority = "high" | "medium" | "low";
export type RoundupStatus = "draft" | "published";
export type RoundupSection = "showcase" | "feedback" | "resource" | "trending" | "highlight";
