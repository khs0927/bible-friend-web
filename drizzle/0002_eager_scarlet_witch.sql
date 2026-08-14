CREATE TABLE `audio_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cacheKey` varchar(191) NOT NULL,
	`s3Key` varchar(255) NOT NULL,
	`s3Url` text NOT NULL,
	`provider` varchar(32) NOT NULL,
	`model` varchar(64) NOT NULL,
	`voice` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audio_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `audio_cache_cacheKey_unique` UNIQUE(`cacheKey`)
);
