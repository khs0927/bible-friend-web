CREATE TABLE `user_treasure_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`title` varchar(128) NOT NULL,
	`verse` varchar(128) NOT NULL,
	`content` text NOT NULL,
	`category` varchar(32) NOT NULL,
	`iconEmoji` varchar(16) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_treasure_cards_id` PRIMARY KEY(`id`)
);
