ALTER TABLE `content_items` ADD `flair` text;--> statement-breakpoint
ALTER TABLE `content_items` ADD `is_showcase` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `content_items` ADD `showcase_url` text;--> statement-breakpoint
CREATE INDEX `content_showcase_idx` ON `content_items` (`is_showcase`);--> statement-breakpoint
CREATE INDEX `content_flair_idx` ON `content_items` (`flair`);