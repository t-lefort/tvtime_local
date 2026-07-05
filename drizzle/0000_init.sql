CREATE TABLE `episodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`show_id` integer NOT NULL,
	`tmdb_id` integer NOT NULL,
	`season_number` integer NOT NULL,
	`episode_number` integer NOT NULL,
	`name` text,
	`overview` text,
	`air_date` text,
	`runtime` integer,
	`still_path` text,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `episodes_tmdb_id_unique` ON `episodes` (`tmdb_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `episodes_show_season_ep` ON `episodes` (`show_id`,`season_number`,`episode_number`);--> statement-breakpoint
CREATE INDEX `episodes_air_date` ON `episodes` (`air_date`);--> statement-breakpoint
CREATE TABLE `shows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tmdb_id` integer NOT NULL,
	`tvdb_id` integer,
	`name` text NOT NULL,
	`original_name` text,
	`overview` text,
	`poster_path` text,
	`backdrop_path` text,
	`first_air_date` text,
	`tmdb_status` text,
	`genres` text DEFAULT '[]' NOT NULL,
	`episode_run_time` integer,
	`followed_at` text DEFAULT (datetime('now')) NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`last_synced_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shows_tmdb_id_unique` ON `shows` (`tmdb_id`);--> statement-breakpoint
CREATE TABLE `watches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`episode_id` integer NOT NULL,
	`watched_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `watches_episode` ON `watches` (`episode_id`);--> statement-breakpoint
CREATE INDEX `watches_watched_at` ON `watches` (`watched_at`);