ALTER TABLE `content_items` ADD `topic` text;--> statement-breakpoint
CREATE INDEX `content_topic_idx` ON `content_items` (`topic`);
