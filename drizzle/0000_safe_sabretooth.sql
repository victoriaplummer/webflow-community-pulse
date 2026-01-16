CREATE TABLE `authors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`platform_id` text NOT NULL,
	`username` text NOT NULL,
	`display_name` text,
	`avatar_url` text,
	`first_seen` integer NOT NULL,
	`last_seen` integer NOT NULL,
	`post_count` integer DEFAULT 0 NOT NULL,
	`high_quality_count` integer DEFAULT 0 NOT NULL,
	`total_engagement` integer DEFAULT 0 NOT NULL,
	`contributor_score` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authors_platform_id_idx` ON `authors` (`platform`,`platform_id`);--> statement-breakpoint
CREATE INDEX `authors_score_idx` ON `authors` (`contributor_score`);--> statement-breakpoint
CREATE TABLE `content_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`platform_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text,
	`body` text NOT NULL,
	`url` text NOT NULL,
	`subreddit` text,
	`author_id` integer,
	`parent_id` integer,
	`created_at` integer NOT NULL,
	`ingested_at` integer NOT NULL,
	`sentiment` text,
	`sentiment_confidence` real,
	`classification` text,
	`classification_confidence` real,
	`needs_review` integer DEFAULT false NOT NULL,
	`engagement_score` real DEFAULT 0 NOT NULL,
	`keywords` text,
	`is_webflow_related` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_platform_id_idx` ON `content_items` (`platform`,`platform_id`);--> statement-breakpoint
CREATE INDEX `content_sentiment_idx` ON `content_items` (`sentiment`);--> statement-breakpoint
CREATE INDEX `content_classification_idx` ON `content_items` (`classification`);--> statement-breakpoint
CREATE INDEX `content_subreddit_idx` ON `content_items` (`subreddit`);--> statement-breakpoint
CREATE INDEX `content_created_idx` ON `content_items` (`created_at`);--> statement-breakpoint
CREATE INDEX `content_webflow_idx` ON `content_items` (`is_webflow_related`);--> statement-breakpoint
CREATE TABLE `engagement_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content_id` integer NOT NULL,
	`captured_at` integer NOT NULL,
	`upvotes` integer DEFAULT 0 NOT NULL,
	`comments` integer DEFAULT 0 NOT NULL,
	`shares` integer,
	FOREIGN KEY (`content_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `engagement_content_idx` ON `engagement_snapshots` (`content_id`);--> statement-breakpoint
CREATE INDEX `engagement_captured_idx` ON `engagement_snapshots` (`captured_at`);--> statement-breakpoint
CREATE TABLE `summaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`summary_type` text NOT NULL,
	`content` text NOT NULL,
	`generated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `summaries_type_idx` ON `summaries` (`summary_type`);--> statement-breakpoint
CREATE INDEX `summaries_period_idx` ON `summaries` (`period_start`,`period_end`);