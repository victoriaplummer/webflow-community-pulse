ALTER TABLE `content_items` ADD `mentions_webflow` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `content_items` ADD `mentioned_tools` text;--> statement-breakpoint
ALTER TABLE `content_items` ADD `audience_relevance` integer;--> statement-breakpoint
CREATE INDEX `content_mentions_webflow_idx` ON `content_items` (`mentions_webflow`);--> statement-breakpoint
CREATE INDEX `content_audience_relevance_idx` ON `content_items` (`audience_relevance`);