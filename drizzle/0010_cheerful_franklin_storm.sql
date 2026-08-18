CREATE TABLE `book_series` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`type` text,
	`collection` text,
	`category` text,
	`external_source` text,
	`external_id` text,
	`last_synced_at` text
);
--> statement-breakpoint
CREATE TABLE `books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`series_id` integer,
	`isbn13` text,
	`isbn10` text,
	`external_source` text,
	`external_id` text,
	`title` text NOT NULL,
	`subtitle` text,
	`authors` text DEFAULT '[]' NOT NULL,
	`description` text,
	`publisher` text,
	`publish_date` text,
	`language` text,
	`page_count` integer,
	`cover_url` text,
	`volume` text,
	`numbering` text,
	`price` real,
	`last_synced_at` text,
	FOREIGN KEY (`series_id`) REFERENCES `book_series`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `books_isbn13` ON `books` (`isbn13`);--> statement-breakpoint
CREATE INDEX `books_series` ON `books` (`series_id`);--> statement-breakpoint
CREATE INDEX `books_external` ON `books` (`external_source`,`external_id`);--> statement-breakpoint
CREATE TABLE `user_book_series` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`series_id` integer NOT NULL,
	`followed` integer DEFAULT true NOT NULL,
	`rating` integer,
	`review` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`series_id`) REFERENCES `book_series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_book_series_user_series` ON `user_book_series` (`user_id`,`series_id`);--> statement-breakpoint
CREATE INDEX `user_book_series_series` ON `user_book_series` (`series_id`);--> statement-breakpoint
CREATE TABLE `user_books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`added_at` text DEFAULT (datetime('now')) NOT NULL,
	`in_collection` integer DEFAULT true NOT NULL,
	`wishlist` integer DEFAULT false NOT NULL,
	`reading_status` text DEFAULT 'unread' NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`rating` integer,
	`review` text,
	`signed` integer DEFAULT false NOT NULL,
	`original_edition` integer DEFAULT false NOT NULL,
	`loaned_to` text,
	`deluxe` integer DEFAULT false NOT NULL,
	`limited_series` integer DEFAULT false NOT NULL,
	`digital` integer DEFAULT false NOT NULL,
	`for_sale` integer DEFAULT false NOT NULL,
	`purchase_price` real,
	`estimated_value` real,
	`condition` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_books_user_book` ON `user_books` (`user_id`,`book_id`);--> statement-breakpoint
CREATE INDEX `user_books_user` ON `user_books` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_books_book` ON `user_books` (`book_id`);