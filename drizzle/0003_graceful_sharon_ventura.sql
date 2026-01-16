ALTER TABLE `content_items` ADD `is_question` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `content_items` ADD `question_category` text;--> statement-breakpoint
ALTER TABLE `content_items` ADD `is_faq_candidate` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `content_items` ADD `suggested_resource` text;--> statement-breakpoint
CREATE INDEX `content_question_category_idx` ON `content_items` (`question_category`);--> statement-breakpoint
CREATE INDEX `content_faq_candidate_idx` ON `content_items` (`is_faq_candidate`);