CREATE TABLE `user_prayer_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`noteText` text NOT NULL,
	`verseRef` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_prayer_notes_id` PRIMARY KEY(`id`)
);
