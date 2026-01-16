CREATE TABLE `roundup_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`roundup_id` integer,
	`content_id` integer NOT NULL,
	`section` text DEFAULT 'highlight' NOT NULL,
	`pull_quote` text,
	`note` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`roundup_id`) REFERENCES `roundups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`content_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `roundup_items_roundup_idx` ON `roundup_items` (`roundup_id`);--> statement-breakpoint
CREATE INDEX `roundup_items_content_idx` ON `roundup_items` (`content_id`);--> statement-breakpoint
CREATE INDEX `roundup_items_section_idx` ON `roundup_items` (`section`);--> statement-breakpoint
CREATE TABLE `roundups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`date_from` integer NOT NULL,
	`date_to` integer NOT NULL,
	`content` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `roundups_status_idx` ON `roundups` (`status`);--> statement-breakpoint
CREATE INDEX `roundups_date_idx` ON `roundups` (`date_from`,`date_to`);--> statement-breakpoint
ALTER TABLE `content_items` ADD `is_roundup_candidate` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `content_roundup_candidate_idx` ON `content_items` (`is_roundup_candidate`);