import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  chatHistory, 
  InsertChatHistory, 
  userScores, 
  userTreasureCards, 
  InsertUserTreasureCard, 
  userPrayerNotes, 
  InsertUserPrayerNote 
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getChatHistory(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(chatHistory).where(eq(chatHistory.userId, userId)).orderBy(desc(chatHistory.createdAt)).limit(limit);
}

export async function saveChatHistory(item: InsertChatHistory) {
  const db = await getDb();
  if (!db) return;
  await db.insert(chatHistory).values(item);
}

export async function getUserScore(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const res = await db.select().from(userScores).where(eq(userScores.userId, userId)).limit(1);
  return res.length > 0 ? res[0].score : 0;
}

export async function updateUserScore(userId: number, score: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(userScores).values({ userId, score }).onDuplicateKeyUpdate({ set: { score } });
}

export async function getUserTreasureCards(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(userTreasureCards).where(eq(userTreasureCards.userId, userId)).orderBy(desc(userTreasureCards.createdAt));
}

export async function addUserTreasureCard(card: InsertUserTreasureCard) {
  const db = await getDb();
  if (!db) return false;
  try {
    const existing = await db.select().from(userTreasureCards).where(eq(userTreasureCards.userId, card.userId)).execute();
    const alreadyExists = existing.some(c => c.cardId === card.cardId);
    if (alreadyExists) return false;
    await db.insert(userTreasureCards).values(card);
    return true;
  } catch (err) {
    console.error("[Database] Failed to add treasure card:", err);
    return false;
  }
}

/**
 * Atomically claims a treasure card and awards its points exactly once.
 *
 * The user's unique score row is created if needed and locked with SELECT ...
 * FOR UPDATE before checking the card. That row serializes concurrent comic
 * reward claims for the same user without requiring a schema migration. The
 * card insert and score update are committed or rolled back together.
 */
export async function claimUserTreasureCardReward(
  card: InsertUserTreasureCard,
  points: number,
): Promise<{ collected: boolean; score: number; saved: boolean }> {
  const db = await getDb();
  if (!db) return { collected: false, score: 0, saved: false };

  return db.transaction(async tx => {
    await tx
      .insert(userScores)
      .values({ userId: card.userId, score: 0 })
      .onDuplicateKeyUpdate({ set: { score: sql`${userScores.score}` } });

    await tx.execute(
      sql`select ${userScores.id} from ${userScores} where ${userScores.userId} = ${card.userId} for update`,
    );

    const [scoreRow] = await tx
      .select({ score: userScores.score })
      .from(userScores)
      .where(eq(userScores.userId, card.userId))
      .limit(1);
    const currentScore = scoreRow?.score ?? 0;

    const existing = await tx
      .select({ id: userTreasureCards.id })
      .from(userTreasureCards)
      .where(
        and(
          eq(userTreasureCards.userId, card.userId),
          eq(userTreasureCards.cardId, card.cardId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return { collected: false, score: currentScore, saved: true };
    }

    await tx.insert(userTreasureCards).values(card);
    const score = currentScore + points;
    await tx
      .update(userScores)
      .set({ score })
      .where(eq(userScores.userId, card.userId));

    return { collected: true, score, saved: true };
  });
}

export async function hasDrawnToday(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const cards = await getUserTreasureCards(userId);
    if (cards.length === 0) return false;
    const todayStr = new Date().toDateString();
    return cards.some(c => {
      if (!c.createdAt) return false;
      return new Date(c.createdAt).toDateString() === todayStr;
    });
  } catch {
    return false;
  }
}

export async function getUserPrayerNotes(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(userPrayerNotes).where(eq(userPrayerNotes.userId, userId)).orderBy(desc(userPrayerNotes.createdAt));
}

export async function addUserPrayerNote(note: InsertUserPrayerNote) {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.insert(userPrayerNotes).values(note);
    return true;
  } catch (err) {
    console.error("[Database] Failed to add prayer note:", err);
    return false;
  }
}