-- Create insight_generations table to track generation runs
CREATE TABLE IF NOT EXISTS `insight_generations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subreddit` text,
	`period_days` integer DEFAULT 14 NOT NULL,
	`content_analyzed` integer DEFAULT 0 NOT NULL,
	`insight_count` integer DEFAULT 0 NOT NULL,
	`generated_at` integer NOT NULL
);

-- Add new columns to insights table
ALTER TABLE `insights` ADD `generation_id` integer REFERENCES insight_generations(id);
ALTER TABLE `insights` ADD `subreddit` text;

-- Create indexes
CREATE INDEX IF NOT EXISTS `insight_generations_subreddit_idx` ON `insight_generations` (`subreddit`);
CREATE INDEX IF NOT EXISTS `insight_generations_generated_at_idx` ON `insight_generations` (`generated_at`);
CREATE INDEX IF NOT EXISTS `insights_generation_idx` ON `insights` (`generation_id`);
CREATE INDEX IF NOT EXISTS `insights_subreddit_idx` ON `insights` (`subreddit`);
