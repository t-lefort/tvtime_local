CREATE TABLE `book_series_volumes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`series_id` integer NOT NULL,
	`ordinal` real,
	`source_uri` text,
	`title` text NOT NULL,
	`subtitle` text,
	`description` text,
	`isbn13` text,
	`cover_url` text,
	`publisher` text,
	`publish_date` text,
	`page_count` integer,
	`enriched_at` text,
	`last_synced_at` text,
	FOREIGN KEY (`series_id`) REFERENCES `book_series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_series_volumes_series` ON `book_series_volumes` (`series_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `book_series_volumes_series_ordinal` ON `book_series_volumes` (`series_id`,`ordinal`);--> statement-breakpoint
CREATE INDEX `book_series_volumes_uri` ON `book_series_volumes` (`source_uri`);--> statement-breakpoint
ALTER TABLE `book_series` ADD `description` text;--> statement-breakpoint
ALTER TABLE `book_series` ADD `authors` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `book_series` ADD `volume_count` integer;--> statement-breakpoint
ALTER TABLE `book_series` ADD `cover_url` text;