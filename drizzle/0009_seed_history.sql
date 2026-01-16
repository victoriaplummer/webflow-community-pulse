-- Create seed_history table to track data syncs
CREATE TABLE IF NOT EXISTS `seed_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seed_name` text NOT NULL,
	`seed_version` integer NOT NULL,
	`record_count` integer DEFAULT 0 NOT NULL,
	`applied_at` integer NOT NULL
);

-- Create unique index to prevent duplicate syncs
CREATE UNIQUE INDEX IF NOT EXISTS `seed_history_name_version_idx` ON `seed_history` (`seed_name`, `seed_version`);
