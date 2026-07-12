CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`password_hash` text,
	`avatar` blob,
	`avatar_type` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_name_unique` ON `users` (`name`);--> statement-breakpoint
INSERT INTO `users` (`name`) SELECT 'Profil 1' WHERE EXISTS (SELECT 1 FROM `shows`) OR EXISTS (SELECT 1 FROM `movies`);--> statement-breakpoint
CREATE TABLE `user_shows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`show_id` integer NOT NULL,
	`followed_at` text DEFAULT (datetime('now')) NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_shows_user_show` ON `user_shows` (`user_id`,`show_id`);--> statement-breakpoint
CREATE INDEX `user_shows_show` ON `user_shows` (`show_id`);--> statement-breakpoint
INSERT INTO `user_shows` (`user_id`, `show_id`, `followed_at`, `archived`, `favorite`)
	SELECT (SELECT MIN(`id`) FROM `users`), `id`, `followed_at`, `archived`, `favorite` FROM `shows`;--> statement-breakpoint
CREATE TABLE `user_movies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`movie_id` integer NOT NULL,
	`added_at` text DEFAULT (datetime('now')) NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_movies_user_movie` ON `user_movies` (`user_id`,`movie_id`);--> statement-breakpoint
CREATE INDEX `user_movies_movie` ON `user_movies` (`movie_id`);--> statement-breakpoint
INSERT INTO `user_movies` (`user_id`, `movie_id`, `added_at`, `favorite`)
	SELECT (SELECT MIN(`id`) FROM `users`), `id`, `added_at`, `favorite` FROM `movies`;--> statement-breakpoint
CREATE TABLE `__new_watches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`episode_id` integer NOT NULL,
	`watched_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_watches` (`id`, `user_id`, `episode_id`, `watched_at`)
	SELECT `id`, (SELECT MIN(`id`) FROM `users`), `episode_id`, `watched_at` FROM `watches`;--> statement-breakpoint
DROP TABLE `watches`;--> statement-breakpoint
ALTER TABLE `__new_watches` RENAME TO `watches`;--> statement-breakpoint
CREATE INDEX `watches_episode` ON `watches` (`episode_id`);--> statement-breakpoint
CREATE INDEX `watches_watched_at` ON `watches` (`watched_at`);--> statement-breakpoint
CREATE INDEX `watches_user` ON `watches` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_movie_watches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`movie_id` integer NOT NULL,
	`watched_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_movie_watches` (`id`, `user_id`, `movie_id`, `watched_at`)
	SELECT `id`, (SELECT MIN(`id`) FROM `users`), `movie_id`, `watched_at` FROM `movie_watches`;--> statement-breakpoint
DROP TABLE `movie_watches`;--> statement-breakpoint
ALTER TABLE `__new_movie_watches` RENAME TO `movie_watches`;--> statement-breakpoint
CREATE INDEX `movie_watches_movie` ON `movie_watches` (`movie_id`);--> statement-breakpoint
CREATE INDEX `movie_watches_watched_at` ON `movie_watches` (`watched_at`);--> statement-breakpoint
CREATE INDEX `movie_watches_user` ON `movie_watches` (`user_id`);--> statement-breakpoint
ALTER TABLE `movies` DROP COLUMN `added_at`;--> statement-breakpoint
ALTER TABLE `movies` DROP COLUMN `favorite`;--> statement-breakpoint
ALTER TABLE `shows` DROP COLUMN `followed_at`;--> statement-breakpoint
ALTER TABLE `shows` DROP COLUMN `archived`;--> statement-breakpoint
ALTER TABLE `shows` DROP COLUMN `favorite`;
