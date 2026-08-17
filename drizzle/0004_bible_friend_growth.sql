CREATE TABLE `user_growth_profiles` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `stage` varchar(32) NOT NULL DEFAULT 'seedling',
  `spiritFood` int NOT NULL DEFAULT 65,
  `faithXp` int NOT NULL DEFAULT 0,
  `wisdomXp` int NOT NULL DEFAULT 0,
  `loveXp` int NOT NULL DEFAULT 0,
  `peace` int NOT NULL DEFAULT 80,
  `soulPoints` int NOT NULL DEFAULT 0,
  `streakDays` int NOT NULL DEFAULT 0,
  `lastNourishedAt` timestamp NULL,
  `equipped` text NOT NULL,
  `equipmentTiers` text NOT NULL,
  `unlockedZones` text NOT NULL,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `user_growth_profiles_id` PRIMARY KEY(`id`),
  CONSTRAINT `user_growth_profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `user_growth_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `eventKey` varchar(220) NOT NULL,
  `eventType` varchar(64) NOT NULL,
  `sourceId` varchar(160) NOT NULL,
  `payload` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `user_growth_events_id` PRIMARY KEY(`id`),
  CONSTRAINT `user_growth_events_eventKey_unique` UNIQUE(`eventKey`)
);
