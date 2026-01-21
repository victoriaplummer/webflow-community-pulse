ALTER TABLE `authors` ADD `is_webflow_staff` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `authors` ADD `subreddits` text;--> statement-breakpoint
CREATE INDEX `authors_webflow_staff_idx` ON `authors` (`is_webflow_staff`);