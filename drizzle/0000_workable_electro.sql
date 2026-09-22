CREATE TABLE `diary_entries` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `day`)
);
