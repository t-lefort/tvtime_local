CREATE TABLE `movie_watches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`movie_id` integer NOT NULL,
	`watched_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `movie_watches_movie` ON `movie_watches` (`movie_id`);--> statement-breakpoint
CREATE INDEX `movie_watches_watched_at` ON `movie_watches` (`watched_at`);--> statement-breakpoint
CREATE TABLE `movies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tmdb_id` integer NOT NULL,
	`title` text NOT NULL,
	`original_title` text,
	`overview` text,
	`poster_path` text,
	`backdrop_path` text,
	`release_date` text,
	`runtime` integer,
	`genres` text DEFAULT '[]' NOT NULL,
	`added_at` text DEFAULT (datetime('now')) NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`last_synced_at` text,
	`watch_providers` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `movies_tmdb_id_unique` ON `movies` (`tmdb_id`);--> statement-breakpoint
ALTER TABLE `shows` ADD `watch_providers` text;