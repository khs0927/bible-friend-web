import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const chatHistory = mysqlTable("chat_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  userMessage: text("userMessage").notNull(),
  agentResponse: text("agentResponse").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatHistory = typeof chatHistory.$inferSelect;
export type InsertChatHistory = typeof chatHistory.$inferInsert;

export const userScores = mysqlTable("user_scores", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  score: int("score").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserScore = typeof userScores.$inferSelect;
export type InsertUserScore = typeof userScores.$inferInsert;

export const userTreasureCards = mysqlTable("user_treasure_cards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  title: varchar("title", { length: 128 }).notNull(),
  verse: varchar("verse", { length: 128 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 32 }).notNull(), // 'story' | 'quiz'
  iconEmoji: varchar("iconEmoji", { length: 16 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserTreasureCard = typeof userTreasureCards.$inferSelect;
export type InsertUserTreasureCard = typeof userTreasureCards.$inferInsert;

export const userPrayerNotes = mysqlTable("user_prayer_notes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  noteText: text("noteText").notNull(),
  verseRef: varchar("verseRef", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserPrayerNote = typeof userPrayerNotes.$inferSelect;
export type InsertUserPrayerNote = typeof userPrayerNotes.$inferInsert;
