CREATE TABLE `insights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`evidence` text NOT NULL,
	`priority` text NOT NULL,
	`generated_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `insights_type_idx` ON `insights` (`type`);--> statement-breakpoint
CREATE INDEX `insights_priority_idx` ON `insights` (`priority`);--> statement-breakpoint
CREATE INDEX `insights_generated_at_idx` ON `insights` (`generated_at`);
