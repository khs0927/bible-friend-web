// api/[...path].ts
import "dotenv/config";

// server/_core/geminiTtsFetchCompat.ts
var GEMINI_HOST = "generativelanguage.googleapis.com";
var LEGACY_INTERACTIONS_PATH = "/v1beta/interactions";
var PATCH_FLAG = "__bibleFriendGeminiTtsGenerateContentInstalled";
function getRawUrl(input) {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}
function isLegacyGeminiTtsUrl(input) {
  try {
    const url = new URL(getRawUrl(input));
    return url.hostname === GEMINI_HOST && url.pathname === LEGACY_INTERACTIONS_PATH;
  } catch {
    return false;
  }
}
function parseLegacyTtsBody(body) {
  if (typeof body !== "string") return null;
  try {
    const parsed = JSON.parse(body);
    const format = parsed.response_format;
    const audioRequested = Array.isArray(format) ? format.some((item) => item?.type === "audio") : format?.type === "audio";
    return audioRequested && typeof parsed.input === "string" ? parsed : null;
  } catch {
    return null;
  }
}
function buildGenerateContentTtsRequest(body) {
  const model2 = body.model?.trim();
  const prompt = body.input?.trim();
  const voiceName = body.generation_config?.speech_config?.[0]?.voice?.trim() || "Leda";
  if (!model2 || !prompt) return null;
  return {
    url: `https://${GEMINI_HOST}/v1beta/models/${encodeURIComponent(model2)}:generateContent`,
    body: {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    }
  };
}
function extractGeneratedAudio(body) {
  const parts = body?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return void 0;
  return parts.find((part) => typeof part?.inlineData?.data === "string")?.inlineData?.data;
}
function installGeminiTtsFetchCompat() {
  const patchedGlobal = globalThis;
  if (patchedGlobal[PATCH_FLAG] || typeof globalThis.fetch !== "function") return;
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input, init) => {
    const parsed = isLegacyGeminiTtsUrl(input) && (init?.method ?? "GET").toUpperCase() === "POST" ? parseLegacyTtsBody(init?.body) : null;
    if (!parsed) return originalFetch(input, init);
    const converted = buildGenerateContentTtsRequest(parsed);
    if (!converted) return originalFetch(input, init);
    const headers = new Headers(init?.headers ?? void 0);
    headers.set("content-type", "application/json");
    headers.delete("Api-Revision");
    const voiceName = parsed.generation_config?.speech_config?.[0]?.voice?.trim() || "Leda";
    const startedAt = Date.now();
    console.info("[TTS Compat] generateContent start", {
      model: parsed.model ?? null,
      voice: voiceName,
      promptChars: parsed.input?.length ?? 0,
      inheritedSignal: Boolean(init?.signal)
    });
    let response;
    try {
      response = await originalFetch(converted.url, {
        ...init,
        headers,
        body: JSON.stringify(converted.body)
      });
    } catch (error) {
      console.warn("[TTS Compat] generateContent fetch failed", {
        latencyMs: Date.now() - startedAt,
        name: error instanceof Error ? error.name : "unknown"
      });
      throw error;
    }
    console.info("[TTS Compat] generateContent response", {
      status: response.status,
      latencyMs: Date.now() - startedAt
    });
    if (!response.ok) return response;
    const responseText = await response.text();
    let generated;
    try {
      generated = JSON.parse(responseText);
    } catch {
      return new Response(responseText, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }
    const audioData = extractGeneratedAudio(generated);
    console.info("[TTS Compat] generateContent audio", {
      latencyMs: Date.now() - startedAt,
      audioBase64Chars: audioData?.length ?? 0
    });
    if (!audioData) {
      return new Response(JSON.stringify(generated), {
        status: response.status,
        statusText: response.statusText,
        headers: { "content-type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ output_audio: { data: audioData } }), {
      status: response.status,
      statusText: response.statusText,
      headers: { "content-type": "application/json" }
    });
  });
  patchedGlobal[PATCH_FLAG] = true;
}
installGeminiTtsFetchCompat();

// api/[...path].ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
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
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var chatHistory = mysqlTable("chat_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  userMessage: text("userMessage").notNull(),
  agentResponse: text("agentResponse").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var userScores = mysqlTable("user_scores", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  score: int("score").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var userTreasureCards = mysqlTable("user_treasure_cards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  title: varchar("title", { length: 128 }).notNull(),
  verse: varchar("verse", { length: 128 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 32 }).notNull(),
  // 'story' | 'quiz'
  iconEmoji: varchar("iconEmoji", { length: 16 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var userPrayerNotes = mysqlTable("user_prayer_notes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  noteText: text("noteText").notNull(),
  verseRef: varchar("verseRef", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var userGrowthProfiles = mysqlTable("user_growth_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  stage: varchar("stage", { length: 32 }).default("seedling").notNull(),
  spiritFood: int("spiritFood").default(65).notNull(),
  faithXp: int("faithXp").default(0).notNull(),
  wisdomXp: int("wisdomXp").default(0).notNull(),
  loveXp: int("loveXp").default(0).notNull(),
  peace: int("peace").default(80).notNull(),
  soulPoints: int("soulPoints").default(0).notNull(),
  streakDays: int("streakDays").default(0).notNull(),
  lastNourishedAt: timestamp("lastNourishedAt"),
  equipped: text("equipped").notNull(),
  equipmentTiers: text("equipmentTiers").notNull(),
  unlockedZones: text("unlockedZones").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var userGrowthEvents = mysqlTable("user_growth_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  eventKey: varchar("eventKey", { length: 220 }).notNull().unique(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  sourceId: varchar("sourceId", { length: 160 }).notNull(),
  payload: text("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

// server/_core/env.ts
var BIBLE_FRIEND_GEMINI_TTS_MODEL = "gemini-3.8-flash-tts";
var GEMINI_TTS_REQUEST_TIMEOUT_MS = 8e3;
function boundedVoiceTimeout(value) {
  const configured = Number(value ?? GEMINI_TTS_REQUEST_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured <= 0) return GEMINI_TTS_REQUEST_TIMEOUT_MS;
  return Math.min(configured, GEMINI_TTS_REQUEST_TIMEOUT_MS);
}
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  // Gemini 3.8 Flash TTS is the current flagship expressive TTS model.
  // It uses structured speech_metadata and returns WAV audio on unary requests.
  geminiTtsModel: process.env.GEMINI_TTS_MODEL?.trim() || BIBLE_FRIEND_GEMINI_TTS_MODEL,
  geminiTtsTimeoutMs: boundedVoiceTimeout(process.env.GEMINI_TTS_TIMEOUT_MS),
  geminiTtsHardTimeoutMs: boundedVoiceTimeout(process.env.GEMINI_TTS_HARD_TIMEOUT_MS)
};

// server/db.ts
var _db = null;
async function getDb() {
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
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getChatHistory(userId, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(chatHistory).where(eq(chatHistory.userId, userId)).orderBy(desc(chatHistory.createdAt)).limit(limit);
}
async function saveChatHistory(item) {
  const db = await getDb();
  if (!db) return;
  await db.insert(chatHistory).values(item);
}
async function getUserScore(userId) {
  const db = await getDb();
  if (!db) return 0;
  const res = await db.select().from(userScores).where(eq(userScores.userId, userId)).limit(1);
  return res.length > 0 ? res[0].score : 0;
}
async function updateUserScore(userId, score) {
  const db = await getDb();
  if (!db) return;
  await db.insert(userScores).values({ userId, score }).onDuplicateKeyUpdate({ set: { score } });
}
async function getUserTreasureCards(userId) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(userTreasureCards).where(eq(userTreasureCards.userId, userId)).orderBy(desc(userTreasureCards.createdAt));
}
async function addUserTreasureCard(card) {
  const db = await getDb();
  if (!db) return false;
  try {
    const existing = await db.select().from(userTreasureCards).where(eq(userTreasureCards.userId, card.userId)).execute();
    const alreadyExists = existing.some((c) => c.cardId === card.cardId);
    if (alreadyExists) return false;
    await db.insert(userTreasureCards).values(card);
    return true;
  } catch (err) {
    console.error("[Database] Failed to add treasure card:", err);
    return false;
  }
}
async function claimUserTreasureCardReward(card, points) {
  const db = await getDb();
  if (!db) return { collected: false, score: 0, saved: false };
  return db.transaction(async (tx) => {
    await tx.insert(userScores).values({ userId: card.userId, score: 0 }).onDuplicateKeyUpdate({ set: { score: sql`${userScores.score}` } });
    await tx.execute(
      sql`select ${userScores.id} from ${userScores} where ${userScores.userId} = ${card.userId} for update`
    );
    const [scoreRow] = await tx.select({ score: userScores.score }).from(userScores).where(eq(userScores.userId, card.userId)).limit(1);
    const currentScore = scoreRow?.score ?? 0;
    const existing = await tx.select({ id: userTreasureCards.id }).from(userTreasureCards).where(
      and(
        eq(userTreasureCards.userId, card.userId),
        eq(userTreasureCards.cardId, card.cardId)
      )
    ).limit(1);
    if (existing.length > 0) {
      return { collected: false, score: currentScore, saved: true };
    }
    await tx.insert(userTreasureCards).values(card);
    const score = currentScore + points;
    await tx.update(userScores).set({ score }).where(eq(userScores.userId, card.userId));
    return { collected: true, score, saved: true };
  });
}
async function hasDrawnToday(userId) {
  const db = await getDb();
  if (!db) return false;
  try {
    const cards = await getUserTreasureCards(userId);
    if (cards.length === 0) return false;
    const todayStr = (/* @__PURE__ */ new Date()).toDateString();
    return cards.some((c) => {
      if (!c.createdAt) return false;
      return new Date(c.createdAt).toDateString() === todayStr;
    });
  } catch {
    return false;
  }
}
async function getUserPrayerNotes(userId) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(userPrayerNotes).where(eq(userPrayerNotes.userId, userId)).orderBy(desc(userPrayerNotes.createdAt));
}
async function addUserPrayerNote(note) {
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

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
async function handleStorageProxy(req, res) {
  const key = req.params[0];
  if (!key) {
    res.status(400).send("Missing storage key");
    return;
  }
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    res.status(500).send("Storage proxy not configured");
    return;
  }
  try {
    const forgeUrl = new URL(
      "v1/storage/presign/get",
      ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
    );
    forgeUrl.searchParams.set("path", key);
    const forgeResp = await fetch(forgeUrl, {
      headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
    });
    if (!forgeResp.ok) {
      const body = await forgeResp.text().catch(() => "");
      console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
      res.status(502).send("Storage backend error");
      return;
    }
    const { url } = await forgeResp.json();
    if (!url) {
      res.status(502).send("Empty signed URL from backend");
      return;
    }
    res.set("Cache-Control", "no-store");
    res.redirect(307, url);
  } catch (err) {
    console.error("[StorageProxy] failed:", err);
    res.status(502).send("Storage proxy error");
  }
}
function registerStorageProxy(app2) {
  app2.get("/manus-storage/*", handleStorageProxy);
  app2.get("/api/manus-storage/*", handleStorageProxy);
}

// server/_core/comicAssetProxy.ts
var COMIC_ASSET_KEYS = ["scene1", "scene2"];
var ASSET_KEYS = new Set(COMIC_ASSET_KEYS);
var APPDEPLOY_STATUS_BASE = "https://api-v2.appdeploy.ai/app/bible-friend-asset-bridge-6xd7bg/api/status/";
var APPDEPLOY_STORAGE_HOST = "appdeployai-v2-storage.s3.us-east-1.amazonaws.com";
var UPSTREAM_TIMEOUT_MS = 8e3;
function isAllowedComicAssetKey(key) {
  return ASSET_KEYS.has(key);
}
function buildComicAssetStatusUrl(key) {
  if (!isAllowedComicAssetKey(key)) {
    throw new Error("Unknown comic asset key");
  }
  return `${APPDEPLOY_STATUS_BASE}${encodeURIComponent(key)}`;
}
function validateComicAssetSignedUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.hostname !== APPDEPLOY_STORAGE_HOST) {
    throw new Error("Unexpected comic asset storage URL");
  }
  return url.toString();
}
function registerComicAssetProxy(app2) {
  app2.get("/api/comic-assets/:key", async (req, res) => {
    const key = String(req.params.key ?? "");
    if (!isAllowedComicAssetKey(key)) {
      res.status(404).json({ error: "comic_asset_not_found" });
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const upstream = await fetch(buildComicAssetStatusUrl(key), {
        headers: { accept: "application/json" },
        signal: controller.signal
      });
      if (!upstream.ok) {
        res.status(502).json({ error: "comic_asset_upstream_unavailable" });
        return;
      }
      const status = await upstream.json();
      if (!status.ok || status.key !== key || typeof status.url !== "string") {
        res.status(502).json({ error: "comic_asset_upstream_invalid" });
        return;
      }
      const signedUrl = validateComicAssetSignedUrl(status.url);
      res.set("Cache-Control", "no-store");
      res.redirect(307, signedUrl);
    } catch (error) {
      const code = error instanceof Error && error.name === "AbortError" ? "comic_asset_upstream_timeout" : "comic_asset_proxy_failed";
      console.warn(`[ComicAssetProxy] ${key} failed`, error);
      res.status(502).json({ error: code });
    } finally {
      clearTimeout(timeout);
    }
  });
}

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/tts.ts
import { createHash } from "node:crypto";

// server/_core/cosyvoice.ts
import axios2 from "axios";
async function synthesizeWithCosyVoice(req) {
  const baseUrl = process.env.COSYVOICE_API_URL;
  if (!baseUrl) {
    throw new Error("COSYVOICE_API_URL\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uC678\uBD80 CosyVoice GPU \uC11C\uBC84 \uC5D4\uB4DC\uD3EC\uC778\uD2B8\uB97C \uC9C0\uC815\uD574 \uC8FC\uC138\uC694.");
  }
  const response = await axios2.post(
    `${baseUrl.replace(/\/$/, "")}/tts`,
    {
      text: req.text,
      mode: req.mode || "instruct",
      instruct_text: req.instruct_text || "\uB530\uB73B\uD558\uACE0 \uCE5C\uADFC\uD55C \uC5B4\uB9B0\uC774 \uBAA9\uC18C\uB9AC\uB85C \uBD80\uB4DC\uB7FD\uAC8C \uB9D0\uD574\uC918",
      spk_id: req.spk_id || "default"
    },
    {
      responseType: "arraybuffer",
      timeout: 15e3
    }
  );
  return response.data;
}

// server/_core/qwen3tts.ts
function timeoutMs() {
  const configured = Number(process.env.QWEN3_TTS_TIMEOUT_MS ?? 2e4);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, 6e4) : 2e4;
}
async function synthesizeWithQwen3TTS(req) {
  const baseUrl = process.env.QWEN3_TTS_API_URL?.trim();
  if (!baseUrl) {
    throw new Error("QWEN3_TTS_API_URL is not configured");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const token = process.env.QWEN3_TTS_API_TOKEN?.trim();
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/tts`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "audio/wav",
        ...token ? { authorization: `Bearer ${token}` } : {}
      },
      body: JSON.stringify({
        text: req.text,
        language: req.language ?? "Korean",
        speaker: req.speaker ?? process.env.QWEN3_TTS_SPEAKER ?? "Sohee",
        instruct: req.instruct ?? ""
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Qwen3-TTS returned HTTP ${response.status}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 44) throw new Error("Qwen3-TTS returned empty audio");
    return bytes;
  } finally {
    clearTimeout(timer);
  }
}

// server/_core/tts.ts
var VOICE_PROFILES = {
  NARRATOR: {
    voice: "Sulafat",
    description: "Warm",
    instruction: "\uB530\uB73B\uD55C \uC5B4\uB9B0\uC774 \uC624\uB514\uC624\uBD81 \uC120\uC0DD\uB2D8\uCC98\uB7FC \uCC28\uBD84\uD558\uACE0 \uBC1D\uAC8C \uB9D0\uD574."
  },
  JESUS: {
    voice: "Vindemiatrix",
    description: "Gentle",
    instruction: "\uCC28\uBD84\uD558\uACE0 \uB530\uB73B\uD558\uBA70 \uC790\uBE44\uB85C\uC6B4 \uC131\uC778\uCC98\uB7FC \uB9D0\uD574. \uAD8C\uC704\uB294 \uC788\uC9C0\uB9CC \uC704\uC555\uC801\uC774\uC9C0 \uC54A\uAC8C \uD574."
  },
  DAVID: {
    voice: "Puck",
    description: "Upbeat",
    instruction: "\uC80A\uACE0 \uBC1D\uC73C\uBA70 \uC6A9\uAE30 \uC788\uB294 \uB290\uB08C\uC73C\uB85C \uB9D0\uD574. \uC2E0\uC559\uC758 \uD655\uC2E0\uC740 \uB290\uAEF4\uC9C0\uB418 \uACFC\uC7A5\uD558\uC9C0 \uB9C8."
  },
  PETER: {
    voice: "Fenrir",
    description: "Excitable",
    instruction: "\uD65C\uAE30\uCC28\uACE0 \uC778\uAC04\uC801\uC778 \uB290\uB08C\uC73C\uB85C \uB9D0\uD574. \uB180\uB78C\uACFC \uAE30\uC068 \uAC19\uC740 \uAC10\uC815 \uBCC0\uD654\uB97C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uD45C\uD604\uD574."
  },
  MARY: {
    voice: "Achernar",
    description: "Soft",
    instruction: "\uBD80\uB4DC\uB7FD\uACE0 \uD3EC\uADFC\uD558\uBA70 \uC548\uC815\uAC10\uC744 \uC8FC\uB294 \uC5B4\uBA38\uB2C8 \uAC19\uC740 \uB9D0\uD22C\uB85C \uB9D0\uD574."
  },
  CHILD_FRIEND: {
    voice: "Leda",
    description: "Youthful",
    instruction: "\uBC1D\uACE0 \uCE5C\uADFC\uD558\uBA70 \uD638\uAE30\uC2EC \uB9CE\uC740 \uC131\uACBD \uCE5C\uAD6C\uCC98\uB7FC \uB9D0\uD574."
  },
  GENERAL_MALE: {
    voice: "Kore",
    description: "Firm",
    instruction: "\uB610\uB837\uD558\uACE0 \uBBFF\uC74C\uC9C1\uD558\uC9C0\uB9CC \uC544\uC774\uC5D0\uAC8C \uD3B8\uC548\uD55C \uB9D0\uD22C\uB85C \uB9D0\uD574."
  },
  GENERAL_FEMALE: {
    voice: "Zephyr",
    description: "Bright",
    instruction: "\uB9D1\uACE0 \uBC1D\uC73C\uBA70 \uCE5C\uC808\uD55C \uB9D0\uD22C\uB85C \uB9D0\uD574."
  }
};
var DEFAULT_SPEAKER = "NARRATOR";
var DEFAULT_MAX_CHARS = 900;
var DEFAULT_DAILY_REQUEST_LIMIT = 80;
var DEFAULT_DAILY_CHARACTER_LIMIT = 2e4;
var CACHE_TTL_MS = 24 * 60 * 60 * 1e3;
var CACHE_LIMIT = 120;
var DEFAULT_RATE_LIMIT_COOLDOWN_MS = 15e3;
var geminiRateLimitUntil = 0;
function numberEnv(value, fallback, min) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}
var TTSProviderError = class extends Error {
  constructor(code, provider, message, retryable = false) {
    super(message);
    this.code = code;
    this.provider = provider;
    this.retryable = retryable;
    this.name = "TTSProviderError";
  }
};
function resolveVoice(request) {
  const speaker = request.speaker ?? DEFAULT_SPEAKER;
  const profile = VOICE_PROFILES[speaker] ?? VOICE_PROFILES[DEFAULT_SPEAKER];
  const speed = Math.min(1.2, Math.max(0.8, request.speed ?? 1));
  const pace = speed <= 0.92 ? "\uC870\uAE08 \uCC9C\uCC9C\uD788" : speed >= 1.08 ? "\uC870\uAE08 \uACBD\uCF8C\uD558\uAC8C" : "\uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uC18D\uB3C4\uB85C";
  const emotion = request.emotion?.trim() ? `\uAC10\uC815\uC740 ${request.emotion.trim()}\uC73C\uB85C \uD45C\uD604\uD574.` : "\uAC10\uC815\uC740 \uB530\uB73B\uD558\uACE0 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uD45C\uD604\uD574.";
  const style = request.style?.trim() ? request.style.trim() : "\uBB38\uC7A5 \uC0AC\uC774\uC5D0 \uC9E7\uC740 \uD638\uD761\uC744 \uB450\uACE0 \uC911\uC694\uD55C \uBD80\uBD84\uC740 \uC0B4\uC9DD \uAC15\uC870\uD574.";
  const context = request.context?.trim() ? `\uC774 \uC7A5\uBA74\uC758 \uB9E5\uB77D\uC740 ${request.context.trim()}\uC774\uC57C.` : "";
  const prompt = [
    profile.instruction,
    "6~12\uC138 \uC5B4\uB9B0\uC774\uAC00 \uC774\uD574\uD558\uAE30 \uC26C\uC6B4 \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uD55C\uAD6D\uC5B4\uB85C \uB9D0\uD574.",
    "\uB108\uBB34 \uB290\uB9AC\uAC70\uB098 \uACFC\uC7A5\uB41C \uC720\uC544 \uB9D0\uD22C, \uC5F0\uADF9\uC801\uC778 \uC5B5\uC591\uC740 \uC0AC\uC6A9\uD558\uC9C0 \uB9C8.",
    `${pace} \uB9D0\uD574.`,
    emotion,
    style,
    context,
    `\uB2E4\uC74C \uBB38\uC7A5\uC744 \uB73B\uC744 \uBC14\uAFB8\uC9C0 \uB9D0\uACE0 \uC815\uD655\uD788 \uC77D\uC5B4 \uC918:
${request.text.trim()}`
  ].filter(Boolean).join("\n");
  return { ...profile, speaker, speed, prompt };
}
function resolveSpeechStyle(request, resolved) {
  const pace = resolved.speed <= 0.92 ? "slightly slow and calm" : resolved.speed >= 1.08 ? "slightly brisk and lively" : "natural conversational pace";
  return [
    resolved.instruction,
    "Speak natural Korean for a child aged 6 to 12. Keep pronunciation clear and emotionally believable.",
    "Avoid exaggerated baby talk or theatrical overacting.",
    pace,
    request.emotion?.trim() ? `Emotion: ${request.emotion.trim()}.` : "Emotion: warm, friendly, and reassuring.",
    request.style?.trim() || "Use short natural breaths and gently emphasize the important words.",
    request.context?.trim() ? `Scene context: ${request.context.trim()}.` : ""
  ].filter(Boolean).join(" ");
}
function makeWavFromPcm(pcm, sampleRate = 24e3, channels = 1, bitsPerSample = 16) {
  if (pcm.subarray(0, 4).toString("ascii") === "RIFF") return pcm;
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
function errorCodeFromStatus(status, body) {
  const lower = body.toLowerCase();
  if (status === 401 || lower.includes("api key") || lower.includes("permission")) return "configuration";
  if (status === 400) return "invalid_request";
  if (status === 408 || lower.includes("timeout")) return "timeout";
  if (status === 429 || lower.includes("rate limit") || lower.includes("resource exhausted")) return "rate_limit";
  if (status === 403 && lower.includes("quota")) return "quota";
  if (status >= 500) return "upstream";
  return "unknown";
}
function safeUpstreamMessage(code) {
  switch (code) {
    case "configuration":
      return "\uC74C\uC131 \uC5F0\uACB0 \uC124\uC815\uC744 \uD655\uC778\uD558\uACE0 \uC788\uC5B4\uC694.";
    case "invalid_request":
      return "\uC774 \uBB38\uC7A5\uC740 \uC74C\uC131\uC73C\uB85C \uC900\uBE44\uD558\uAE30 \uC5B4\uB824\uC6CC\uC694. \uC870\uAE08 \uC9E7\uAC8C \uB2E4\uC2DC \uB9D0\uD574 \uBCFC\uAE4C\uC694?";
    case "quota":
    case "rate_limit":
      return "\uC624\uB298 \uC74C\uC131 \uC0AC\uC6A9\uB7C9\uC744 \uC7A0\uC2DC \uC26C\uC5B4 \uAC00\uACE0 \uC788\uC5B4\uC694. \uAE00\uB85C\uB294 \uACC4\uC18D \uC774\uC57C\uAE30\uD560 \uC218 \uC788\uC5B4\uC694.";
    case "timeout":
      return "\uC74C\uC131\uC744 \uC900\uBE44\uD558\uB294 \uB370 \uC2DC\uAC04\uC774 \uAC78\uB9AC\uACE0 \uC788\uC5B4\uC694. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uB20C\uB7EC \uC8FC\uC138\uC694.";
    default:
      return "\uC74C\uC131\uC744 \uC7A0\uC2DC \uC900\uBE44\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uB20C\uB7EC \uC8FC\uC138\uC694.";
  }
}
var GeminiTTSProvider = class {
  name = "gemini";
  apiKey;
  model;
  timeoutMs;
  constructor(options) {
    this.apiKey = options?.apiKey ?? ENV.geminiApiKey;
    this.model = options?.model ?? ENV.geminiTtsModel;
    this.timeoutMs = Math.max(250, Math.min(options?.timeoutMs ?? ENV.geminiTtsTimeoutMs, ENV.geminiTtsHardTimeoutMs));
  }
  isAvailable() {
    return Boolean(this.apiKey);
  }
  async synthesize(request, resolved) {
    if (!this.isAvailable()) {
      throw new TTSProviderError("configuration", this.name, "GEMINI_API_KEY is not configured");
    }
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": this.apiKey
        },
        body: JSON.stringify(
          this.model.startsWith("gemini-3.8-") ? {
            model: this.model,
            input: [
              {
                type: "user_input",
                content: [
                  {
                    type: "text",
                    text: request.text.trim(),
                    annotations: [
                      {
                        type: "speech_metadata",
                        style: resolveSpeechStyle(request, resolved)
                      }
                    ]
                  }
                ]
              }
            ],
            response_format: { type: "audio" },
            generation_config: {
              speech_config: [{ voice: resolved.voice }]
            }
          } : {
            model: this.model,
            input: resolved.prompt,
            response_format: { type: "audio" },
            generation_config: {
              speech_config: [{ voice: resolved.voice }]
            }
          }
        ),
        signal: controller.signal
      });
      const bodyText = await response.text();
      if (!response.ok) {
        const code = errorCodeFromStatus(response.status, bodyText);
        throw new TTSProviderError(code, this.name, `Gemini TTS returned HTTP ${response.status}`, code === "rate_limit" || code === "upstream");
      }
      let body;
      try {
        body = JSON.parse(bodyText);
      } catch {
        throw new TTSProviderError("upstream", this.name, "Gemini TTS returned malformed JSON", true);
      }
      const encoded = body?.output_audio?.data ?? body?.steps?.flatMap((step) => Array.isArray(step?.content) ? step.content : [])?.find((block) => typeof block?.data === "string")?.data;
      if (typeof encoded !== "string" || encoded.length === 0) {
        throw new TTSProviderError("upstream", this.name, "Gemini TTS returned no audio data", true);
      }
      const audio = makeWavFromPcm(Buffer.from(encoded, "base64"));
      return {
        audio,
        mimeType: "audio/wav",
        provider: this.name,
        model: this.model,
        voice: resolved.voice,
        latencyMs: Date.now() - startedAt,
        cached: false
      };
    } catch (error) {
      if (error instanceof TTSProviderError) throw error;
      if (error?.name === "AbortError") {
        throw new TTSProviderError("timeout", this.name, "Gemini TTS request timed out", true);
      }
      throw new TTSProviderError("upstream", this.name, "Gemini TTS request failed", true);
    } finally {
      clearTimeout(timeout);
    }
  }
};
var Qwen3TTSProvider = class {
  name = "qwen3";
  isAvailable() {
    return Boolean(process.env.QWEN3_TTS_API_URL?.trim());
  }
  async synthesize(request, resolved) {
    if (!this.isAvailable()) {
      throw new TTSProviderError("configuration", this.name, "QWEN3_TTS_API_URL is not configured");
    }
    const startedAt = Date.now();
    const instruction = request.instructText?.trim() || [
      resolved.instruction,
      "6~12\uC138 \uC5B4\uB9B0\uC774\uAC00 \uD3B8\uC548\uD558\uAC8C \uB4E4\uC744 \uC218 \uC788\uB294 \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uD55C\uAD6D\uC5B4\uB85C \uB9D0\uD574.",
      request.emotion?.trim() ? `\uAC10\uC815: ${request.emotion.trim()}` : "\uAC10\uC815: \uB530\uB73B\uD558\uACE0 \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uACA9\uB824",
      request.style?.trim() || "\uBB38\uC7A5 \uC0AC\uC774\uC5D0 \uC9E7\uC740 \uD638\uD761\uC744 \uB450\uACE0 \uC911\uC694\uD55C \uBD80\uBD84\uC740 \uC0B4\uC9DD \uAC15\uC870\uD574.",
      request.context?.trim() ? `\uC7A5\uBA74 \uB9E5\uB77D: ${request.context.trim()}` : ""
    ].filter(Boolean).join("\n");
    try {
      const audio = await synthesizeWithQwen3TTS({
        text: request.text,
        language: "Korean",
        speaker: process.env.QWEN3_TTS_SPEAKER?.trim() || "Sohee",
        instruct: instruction
      });
      return {
        audio,
        mimeType: "audio/wav",
        provider: this.name,
        model: process.env.QWEN3_TTS_MODEL?.trim() || "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
        voice: process.env.QWEN3_TTS_SPEAKER?.trim() || "Sohee",
        latencyMs: Date.now() - startedAt,
        cached: false
      };
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new TTSProviderError("timeout", this.name, "Qwen3-TTS request timed out", true);
      }
      throw new TTSProviderError("upstream", this.name, "Qwen3-TTS request failed", true);
    }
  }
};
var CosyVoiceProvider = class {
  name = "cosyvoice";
  isAvailable() {
    return Boolean(process.env.COSYVOICE_API_URL);
  }
  async synthesize(request, resolved) {
    if (!this.isAvailable()) {
      throw new TTSProviderError("configuration", this.name, "COSYVOICE_API_URL is not configured");
    }
    const startedAt = Date.now();
    try {
      const audioData = await synthesizeWithCosyVoice({
        text: request.text,
        mode: request.mode ?? "instruct",
        instruct_text: request.instructText ?? resolved.prompt,
        spk_id: resolved.speaker.toLowerCase()
      });
      return {
        audio: Buffer.from(audioData),
        mimeType: "audio/wav",
        provider: this.name,
        model: "cosyvoice",
        voice: resolved.speaker,
        latencyMs: Date.now() - startedAt,
        cached: false
      };
    } catch {
      throw new TTSProviderError("upstream", this.name, "CosyVoice request failed", true);
    }
  }
};
var audioCache = /* @__PURE__ */ new Map();
var inFlightRequests = /* @__PURE__ */ new Map();
var dailyUsage = /* @__PURE__ */ new Map();
function todayKey() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function limits() {
  return {
    maxChars: numberEnv(process.env.GEMINI_TTS_MAX_CHARS, DEFAULT_MAX_CHARS, 80),
    requests: numberEnv(process.env.GEMINI_TTS_DAILY_REQUESTS, DEFAULT_DAILY_REQUEST_LIMIT, 1),
    characters: numberEnv(process.env.GEMINI_TTS_DAILY_CHARS, DEFAULT_DAILY_CHARACTER_LIMIT, 100)
  };
}
function getUsage() {
  const key = todayKey();
  const usage = dailyUsage.get(key) ?? { requests: 0, characters: 0 };
  dailyUsage.set(key, usage);
  return usage;
}
function remainingQuota() {
  const usage = getUsage();
  const config = limits();
  return {
    requests: Math.max(0, config.requests - usage.requests),
    characters: Math.max(0, config.characters - usage.characters)
  };
}
function cacheKey(request, resolved) {
  return createHash("sha256").update(
    JSON.stringify({
      text: request.text.trim(),
      speaker: resolved.speaker,
      voice: resolved.voice,
      // The spoken answer is the cache identity. Playback controls may change
      // emotion/style (automatic reply vs. manual replay), but should not spend
      // another Gemini quota unit for the same Korean answer.
      speed: resolved.speed,
      geminiModel: ENV.geminiTtsModel,
      qwenModel: process.env.QWEN3_TTS_MODEL?.trim() || "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
      qwenSpeaker: process.env.QWEN3_TTS_SPEAKER?.trim() || "Sohee"
    })
  ).digest("hex");
}
function getCached(key) {
  const cached = audioCache.get(key);
  if (!cached) return void 0;
  if (cached.expiresAt < Date.now()) {
    audioCache.delete(key);
    return void 0;
  }
  return { ...cached.result, cached: true, latencyMs: 0 };
}
function setCached(key, result) {
  if (audioCache.size >= CACHE_LIMIT) {
    const oldest = audioCache.keys().next().value;
    if (oldest) audioCache.delete(oldest);
  }
  audioCache.set(key, { result: { ...result, cached: false }, expiresAt: Date.now() + CACHE_TTL_MS });
}
function validateRequest(request) {
  const text2 = request.text.trim();
  const config = limits();
  if (!text2) throw new TTSProviderError("invalid_request", "gemini", "Text is required");
  if (text2.length > config.maxChars) {
    throw new TTSProviderError("invalid_request", "gemini", `Text exceeds ${config.maxChars} characters`);
  }
}
function getGeminiQuotaFailure(request) {
  const usage = getUsage();
  const config = limits();
  if (usage.requests >= config.requests) {
    return new TTSProviderError("quota", "gemini", "Daily TTS request quota reached");
  }
  if (usage.characters + request.text.trim().length > config.characters) {
    return new TTSProviderError("quota", "gemini", "Daily TTS character quota reached");
  }
  return void 0;
}
function consumeUsage(text2) {
  const usage = getUsage();
  usage.requests += 1;
  usage.characters += text2.length;
}
function synthesizeSpeech(request) {
  const resolved = resolveVoice({ ...request, text: request.text.trim() });
  const key = cacheKey({ ...request, text: request.text.trim() }, resolved);
  const existing = inFlightRequests.get(key);
  if (existing) return existing;
  const pending = synthesizeSpeechInternal(request).finally(() => {
    inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, pending);
  return pending;
}
async function synthesizeSpeechInternal(request) {
  const normalized = { ...request, text: request.text.trim() };
  const resolved = resolveVoice(normalized);
  const key = cacheKey(normalized, resolved);
  const cached = getCached(key);
  if (cached) {
    return {
      success: true,
      audioBase64: cached.audio.toString("base64"),
      mimeType: cached.mimeType,
      provider: cached.provider,
      model: cached.model,
      voice: cached.voice,
      latencyMs: 0,
      cached: true,
      fallback: cached.provider !== "gemini",
      quotaRemaining: remainingQuota(),
      serverResponseAt: Date.now()
    };
  }
  const geminiProvider = new GeminiTTSProvider();
  try {
    validateRequest(normalized);
  } catch (error) {
    const failure = error instanceof TTSProviderError ? error : new TTSProviderError("invalid_request", "gemini", "Invalid TTS request");
    return {
      success: false,
      provider: failure.provider,
      error: safeUpstreamMessage(failure.code),
      errorCode: failure.code,
      fallbackSuggested: true,
      quotaRemaining: remainingQuota(),
      serverResponseAt: Date.now()
    };
  }
  const ttsMode = process.env.BIBLE_FRIEND_TTS_MODE?.trim() || "gemini_only";
  const providers = ttsMode === "fallback_chain" ? [geminiProvider, new Qwen3TTSProvider(), new CosyVoiceProvider()] : [geminiProvider];
  let lastFailure;
  let skipGemini = Date.now() < geminiRateLimitUntil;
  if (skipGemini) {
    lastFailure = new TTSProviderError("rate_limit", "gemini", "Gemini TTS rate limit cooldown is active", true);
  } else if (geminiProvider.isAvailable()) {
    const quotaFailure = getGeminiQuotaFailure(normalized);
    if (quotaFailure) {
      lastFailure = quotaFailure;
      skipGemini = true;
    }
  }
  for (const provider of providers) {
    if (!provider.isAvailable()) continue;
    if (provider.name === "gemini" && skipGemini) continue;
    try {
      const result = await provider.synthesize(normalized, resolved);
      if (result.provider === "gemini") consumeUsage(normalized.text);
      setCached(key, result);
      return {
        success: true,
        audioBase64: result.audio.toString("base64"),
        mimeType: result.mimeType,
        provider: result.provider,
        model: result.model,
        voice: result.voice,
        latencyMs: result.latencyMs,
        cached: false,
        fallback: provider.name !== "gemini",
        quotaRemaining: remainingQuota(),
        serverResponseAt: Date.now()
      };
    } catch (error) {
      lastFailure = error instanceof TTSProviderError ? error : new TTSProviderError("unknown", provider.name, "Provider failed");
      if (provider.name === "gemini" && lastFailure.code === "rate_limit") {
        const cooldownMs = numberEnv(process.env.GEMINI_TTS_RATE_LIMIT_COOLDOWN_MS, DEFAULT_RATE_LIMIT_COOLDOWN_MS, 1e3);
        geminiRateLimitUntil = Date.now() + cooldownMs;
      }
      console.warn(`[TTS] ${provider.name} failed with ${lastFailure.code}`);
    }
  }
  const failureCode = lastFailure?.code ?? "configuration";
  return {
    success: false,
    provider: lastFailure?.provider ?? "gemini",
    error: safeUpstreamMessage(failureCode),
    errorCode: failureCode,
    fallbackSuggested: true,
    quotaRemaining: remainingQuota(),
    serverResponseAt: Date.now()
  };
}
function getVoiceProfiles() {
  return Object.entries(VOICE_PROFILES).map(([speaker, profile]) => ({ speaker, ...profile }));
}

// server/routers.ts
import { createHash as createHash2 } from "node:crypto";
import { z as z3 } from "zod";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/_core/llm.ts
var GOOGLE_OPENAI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
var FAST_CHAT_MODEL = "gemini-3.6-flash";
var FAST_CHAT_MAX_TOKENS = 320;
var FAST_CHAT_TIMEOUT_MS = 7e3;
var RETRY_MAX_RETRIES = 2;
var RETRY_BASE_DELAY_MS = 350;
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var ensureArray = (value) => Array.isArray(value) ? value : [value];
function normalizeContentPart(part) {
  if (typeof part === "string") return { type: "text", text: part };
  if (part.type === "text" || part.type === "image_url" || part.type === "file_url") return part;
  throw new Error("Unsupported message content part");
}
function normalizeMessage(message) {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    return {
      role,
      name,
      tool_call_id,
      content: ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n")
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return { role, name, content: contentParts[0].text };
  }
  return { role, name, content: contentParts };
}
function normalizeToolChoice(toolChoice, tools) {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") return toolChoice;
  if (toolChoice === "required") {
    if (!tools?.length) throw new Error("tool_choice 'required' was provided but no tools were configured");
    if (tools.length > 1) throw new Error("tool_choice 'required' needs a single tool or explicit tool name");
    return { type: "function", function: { name: tools[0].function.name } };
  }
  if ("name" in toolChoice) return { type: "function", function: { name: toolChoice.name } };
  return toolChoice;
}
function normalizeResponseFormat(params) {
  const explicit = params.responseFormat ?? params.response_format;
  if (explicit) return explicit;
  const schema = params.outputSchema ?? params.output_schema;
  if (!schema) return void 0;
  return { type: "json_schema", json_schema: schema };
}
function usingForge() {
  return Boolean(ENV.forgeApiKey?.trim());
}
function apiKey() {
  const key = usingForge() ? ENV.forgeApiKey : ENV.geminiApiKey;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return key;
}
function chatUrl() {
  if (usingForge()) {
    const base = ENV.forgeApiUrl?.trim() || "https://forge.manus.im";
    return `${base.replace(/\/$/, "")}/v1/chat/completions`;
  }
  return `${GOOGLE_OPENAI_BASE}/chat/completions`;
}
function readPlainText(content) {
  return ensureArray(content).map((part) => typeof part === "string" ? part : part.type === "text" ? part.text : "").filter(Boolean).join(" ").trim();
}
function instantGreeting(params) {
  const lastUser = params.messages.slice().reverse().find((message) => message.role === "user");
  if (!lastUser) return null;
  const normalized = readPlainText(lastUser.content).toLowerCase().replace(/[\s!?.~,，。！？…]+/g, "");
  if (!/^(안녕|안녕하세요|안뇽|하이|헬로|hi|hello|반가워|반가워요)(성경친구)?$/.test(normalized)) return null;
  return {
    id: `bible-friend-greeting-${Date.now()}`,
    created: Math.floor(Date.now() / 1e3),
    model: "bible-friend-instant",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "\uC548\uB155! \uB9CC\uB098\uC11C \uC815\uB9D0 \uBC18\uAC00\uC6CC \u{1F60A} \uC624\uB298 \uC5B4\uB5A4 \uC774\uC57C\uAE30\uB97C \uB098\uB220\uBCFC\uAE4C? \uC131\uACBD\uC5D0 \uB300\uD574 \uAD81\uAE08\uD55C \uAC83\uB3C4 \uD3B8\uD558\uAC8C \uBB3C\uC5B4\uBD10!"
        },
        finish_reason: "stop"
      }
    ]
  };
}
async function fetchWithBackoff(url, init) {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok || attempt === RETRY_MAX_RETRIES || response.status < 429 && response.status !== 408) return response;
      try {
        await response.body?.cancel();
      } catch {
      }
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    } catch (error) {
      lastError = error;
      const errorName = error instanceof Error ? error.name : "";
      if (errorName === "AbortError" || errorName === "TimeoutError") throw error;
      if (attempt === RETRY_MAX_RETRIES) throw error;
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LLM request failed");
}
async function invokeLLM(params) {
  const responseFormat = normalizeResponseFormat(params);
  const requestedModel = params.model ?? "gemini-2.5-flash";
  const fastChat = !usingForge() && requestedModel === "gemini-flash-latest" && !params.tools?.length && !responseFormat;
  const resolvedModel = fastChat ? FAST_CHAT_MODEL : requestedModel;
  if (fastChat) {
    const instant = instantGreeting(params);
    if (instant) {
      console.info("[LLM] instant Bible Friend greeting", { model: instant.model, ms: 0 });
      return instant;
    }
  }
  const payload = {
    messages: params.messages.map(normalizeMessage),
    model: resolvedModel
  };
  if (params.tools?.length) payload.tools = params.tools;
  const toolChoice = normalizeToolChoice(params.toolChoice ?? params.tool_choice, params.tools);
  if (toolChoice) payload.tool_choice = toolChoice;
  const maxTokens = params.max_tokens ?? params.maxTokens;
  if (typeof maxTokens === "number") payload.max_tokens = maxTokens;
  else if (fastChat) payload.max_tokens = FAST_CHAT_MAX_TOKENS;
  if (responseFormat) payload.response_format = responseFormat;
  if (fastChat) {
    payload.reasoning_effort = "minimal";
  }
  if (usingForge()) {
    if (params.thinking) payload.thinking = params.thinking;
    if (params.reasoning) payload.reasoning = params.reasoning;
  }
  const provider = usingForge() ? "forge" : "gemini-direct";
  const startedAt = Date.now();
  const response = await fetchWithBackoff(chatUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey()}`
    },
    body: JSON.stringify(payload),
    signal: fastChat ? AbortSignal.timeout(FAST_CHAT_TIMEOUT_MS) : void 0
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.warn("[LLM] request failed", { provider, model: resolvedModel, status: response.status, ms: Date.now() - startedAt });
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText.slice(0, 500)}`);
  }
  const result = await response.json();
  console.info("[LLM] request success", {
    provider,
    requestedModel,
    model: result.model ?? resolvedModel,
    fastChat,
    ms: Date.now() - startedAt
  });
  return result;
}

// server/_core/voiceTranscription.ts
var MAX_AUDIO_BYTES = 16 * 1024 * 1024;
var GEMINI_STT_MODEL = process.env.GEMINI_STT_MODEL?.trim() || "gemini-2.5-flash";
function normalizeMimeType(value) {
  const mimeType = value.toLowerCase().split(";")[0]?.trim() || "audio/m4a";
  if (mimeType === "audio/mp4" || mimeType === "audio/x-m4a") return "audio/m4a";
  return mimeType;
}
function decodeDataUrl(value) {
  if (!value.startsWith("data:")) return null;
  const comma = value.indexOf(",");
  if (comma < 0) return null;
  const metadata = value.slice(5, comma);
  const payload = value.slice(comma + 1);
  const isBase64 = metadata.toLowerCase().includes(";base64");
  const mimeType = normalizeMimeType(metadata.split(";")[0] || "audio/m4a");
  try {
    const buffer = isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8");
    return { buffer, mimeType };
  } catch {
    return null;
  }
}
async function loadAudio(source) {
  const inline = decodeDataUrl(source);
  if (source.startsWith("data:") && !inline) {
    return {
      error: "Invalid inline audio data",
      code: "INVALID_FORMAT",
      details: "The recorded audio could not be decoded"
    };
  }
  let loaded;
  if (inline) {
    loaded = inline;
  } else {
    try {
      const response = await fetch(source);
      if (!response.ok) {
        return {
          error: "Failed to download audio file",
          code: "INVALID_FORMAT",
          details: `HTTP ${response.status}`
        };
      }
      loaded = {
        buffer: Buffer.from(await response.arrayBuffer()),
        mimeType: normalizeMimeType(response.headers.get("content-type") || "audio/mpeg")
      };
    } catch {
      return {
        error: "Failed to fetch audio file",
        code: "SERVICE_ERROR",
        details: "The audio source could not be read"
      };
    }
  }
  if (loaded.buffer.length === 0) {
    return { error: "Recorded audio is empty", code: "INVALID_FORMAT" };
  }
  if (loaded.buffer.length > MAX_AUDIO_BYTES) {
    return {
      error: "Audio file exceeds maximum size limit",
      code: "FILE_TOO_LARGE",
      details: "Maximum supported audio size is 16MB"
    };
  }
  return loaded;
}
function extractGeminiText(body) {
  const parts = body?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => typeof part?.text === "string" ? part.text : "").filter(Boolean).join("\n").trim();
}
async function transcribeWithGemini(audio, options) {
  if (!ENV.geminiApiKey) throw new Error("gemini_not_configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25e3);
  const language = options.language?.trim() || "ko";
  const prompt = options.prompt?.trim() || `\uC774 \uC624\uB514\uC624\uC5D0\uC11C \uC0AC\uB78C\uC774 \uB9D0\uD55C \uB0B4\uC6A9\uC744 ${language === "ko" ? "\uD55C\uAD6D\uC5B4" : language} \uD14D\uC2A4\uD2B8\uB85C \uC815\uD655\uD788 \uBC1B\uC544 \uC801\uC5B4 \uC8FC\uC138\uC694. \uC124\uBA85\uC774\uB098 \uBA38\uB9AC\uB9D0 \uC5C6\uC774 \uC2E4\uC81C\uB85C \uB4E4\uB9B0 \uB9D0\uB9CC \uCD9C\uB825\uD558\uC138\uC694.`;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_STT_MODEL)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": ENV.geminiApiKey
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: audio.mimeType,
                    data: audio.buffer.toString("base64")
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 220
          }
        }),
        signal: controller.signal
      }
    );
    const bodyText = await response.text();
    if (!response.ok) throw new Error(`gemini_http_${response.status}`);
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      throw new Error("gemini_invalid_json");
    }
    const text2 = extractGeminiText(body).replace(/^```(?:text)?\s*/i, "").replace(/```$/i, "").trim();
    if (!text2) throw new Error("gemini_empty_transcript");
    return {
      task: "transcribe",
      language,
      duration: 0,
      text: text2,
      segments: []
    };
  } finally {
    clearTimeout(timeout);
  }
}
async function transcribeWithForge(audio, options) {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new Error("forge_not_configured");
  const formData = new FormData();
  const filename = `audio.${getFileExtension(audio.mimeType)}`;
  const audioBlob = new Blob([new Uint8Array(audio.buffer)], { type: audio.mimeType });
  formData.append("file", audioBlob, filename);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append(
    "prompt",
    options.prompt || (options.language ? `Transcribe the user's voice to text. The working language is ${getLanguageName(options.language)}.` : "Transcribe the user's voice to text.")
  );
  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const response = await fetch(new URL("v1/audio/transcriptions", baseUrl), {
    method: "POST",
    headers: {
      authorization: `Bearer ${ENV.forgeApiKey}`,
      "Accept-Encoding": "identity"
    },
    body: formData
  });
  if (!response.ok) throw new Error(`forge_http_${response.status}`);
  const result = await response.json();
  if (!result?.text || typeof result.text !== "string") throw new Error("forge_invalid_transcript");
  return result;
}
async function transcribeAudio(options) {
  const loaded = await loadAudio(options.audioUrl);
  if ("error" in loaded) return loaded;
  if (ENV.geminiApiKey) {
    try {
      return await transcribeWithGemini(loaded, options);
    } catch (error) {
      console.warn("[Voice STT] Gemini transcription failed", error instanceof Error ? error.message : "unknown_error");
    }
  }
  if (ENV.forgeApiUrl && ENV.forgeApiKey) {
    try {
      return await transcribeWithForge(loaded, options);
    } catch (error) {
      console.warn("[Voice STT] Forge transcription failed", error instanceof Error ? error.message : "unknown_error");
    }
  }
  return {
    error: "Voice transcription is temporarily unavailable",
    code: "TRANSCRIPTION_FAILED",
    details: ENV.geminiApiKey ? "Gemini could not transcribe the recording" : "GEMINI_API_KEY is not configured"
  };
}
function getFileExtension(mimeType) {
  const mimeToExt = {
    "audio/webm": "webm",
    "audio/opus": "opus",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/m4a": "m4a",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/flac": "flac"
  };
  return mimeToExt[mimeType] || "audio";
}
function getLanguageName(langCode) {
  const langMap = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ar: "Arabic",
    hi: "Hindi"
  };
  return langMap[langCode] || langCode;
}

// server/growthRouter.ts
import { z as z2 } from "zod";

// shared/growthVerses.ts
var GROWTH_DAILY_VERSES = [
  { id: "john-3-16", ref: "\uC694\uD55C\uBCF5\uC74C 3:16", text: "\uD558\uB098\uB2D8\uC774 \uC138\uC0C1\uC744 \uC774\uCC98\uB7FC \uC0AC\uB791\uD558\uC0AC \uB3C5\uC0DD\uC790\uB97C \uC8FC\uC168\uC73C\uB2C8", theme: "\uC0AC\uB791" },
  { id: "psalm-23-1", ref: "\uC2DC\uD3B8 23:1", text: "\uC5EC\uD638\uC640\uB294 \uB098\uC758 \uBAA9\uC790\uC2DC\uB2C8 \uB0B4\uAC8C \uBD80\uC871\uD568\uC774 \uC5C6\uC73C\uB9AC\uB85C\uB2E4", theme: "\uB3CC\uBCF4\uC2EC" },
  { id: "phil-4-6", ref: "\uBE4C\uB9BD\uBCF4\uC11C 4:6", text: "\uC544\uBB34 \uAC83\uB3C4 \uC5FC\uB824\uD558\uC9C0 \uB9D0\uACE0 \uB2E4\uB9CC \uBAA8\uB4E0 \uC77C\uC5D0 \uAE30\uB3C4\uC640 \uAC04\uAD6C\uB85C", theme: "\uD3C9\uC548" },
  { id: "eph-6-16", ref: "\uC5D0\uBCA0\uC18C\uC11C 6:16", text: "\uBAA8\uB4E0 \uAC83 \uC704\uC5D0 \uBBFF\uC74C\uC758 \uBC29\uD328\uB97C \uAC00\uC9C0\uACE0", theme: "\uBBFF\uC74C" }
];
function getGrowthDailyVerse(id) {
  return GROWTH_DAILY_VERSES.find((verse) => verse.id === id) ?? null;
}

// server/growthStore.ts
import { and as and2, eq as eq2, like, sql as sql2 } from "drizzle-orm";

// shared/growthDomain.ts
var INITIAL_EQUIPMENT_TIERS = {
  belt_truth: 0,
  breastplate_righteousness: 0,
  shoes_peace: 0,
  shield_faith: 0,
  helmet_salvation: 0,
  sword_spirit: 0,
  crown: 0
};
var INITIAL_GROWTH_PROFILE = {
  stage: "seedling",
  spiritFood: 65,
  faithXp: 0,
  wisdomXp: 0,
  loveXp: 0,
  peace: 80,
  soulPoints: 0,
  streakDays: 0,
  lastNourishedAt: null,
  equipmentTiers: INITIAL_EQUIPMENT_TIERS,
  equipped: [],
  unlockedZones: ["home"]
};
var ACTIVITY_REWARDS = {
  scripture_read: { spiritFood: 30, wisdomXp: 10, faithXp: 5 },
  verse_memorized: { fillSpiritFood: true, faithXp: 25, wisdomXp: 8 },
  bible_conversation: { spiritFood: 5, wisdomXp: 3 },
  prayer: { peace: 20, faithXp: 3 },
  service_mission: { loveXp: 15, soulPoints: 10, faithXp: 5 },
  wilderness_victory: { faithXp: 20, soulPoints: 10, wisdomXp: 5 }
};
function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}
function calculateStage(profile) {
  if (profile.faithXp >= 900 && profile.wisdomXp >= 500 && profile.loveXp >= 350) return "crowned";
  if (profile.faithXp >= 500 && profile.wisdomXp >= 260 && profile.loveXp >= 180) return "servant";
  if (profile.faithXp >= 240 && profile.wisdomXp >= 120 && profile.loveXp >= 50) return "warrior";
  if (profile.faithXp >= 80 && profile.wisdomXp >= 40) return "disciple";
  return "seedling";
}
function unlockedZonesForStage(stage) {
  if (stage === "crowned" || stage === "servant") return ["home", "road", "wilderness", "village"];
  if (stage === "warrior") return ["home", "road", "wilderness"];
  if (stage === "disciple") return ["home", "road"];
  return ["home"];
}
function applyReward(profile, reward) {
  const next = {
    ...profile,
    spiritFood: reward.fillSpiritFood ? 100 : clamp(profile.spiritFood + (reward.spiritFood ?? 0)),
    faithXp: Math.max(0, profile.faithXp + (reward.faithXp ?? 0)),
    wisdomXp: Math.max(0, profile.wisdomXp + (reward.wisdomXp ?? 0)),
    loveXp: Math.max(0, profile.loveXp + (reward.loveXp ?? 0)),
    peace: clamp(profile.peace + (reward.peace ?? 0)),
    soulPoints: Math.max(0, profile.soulPoints + (reward.soulPoints ?? 0))
  };
  next.stage = calculateStage(next);
  next.unlockedZones = unlockedZonesForStage(next.stage);
  return next;
}
function applyDailyDecay(profile, daysMissed) {
  if (daysMissed <= 0) return profile;
  const foodLoss = Math.min(60, daysMissed * 20);
  return {
    ...profile,
    spiritFood: clamp(profile.spiritFood - foodLoss),
    peace: clamp(profile.peace - Math.min(20, daysMissed * 5))
  };
}
function upgradeCost(equipmentId2, currentTier) {
  if (equipmentId2 === "crown") return [0, 120, 180, 260, 360, 500][Math.min(currentTier + 1, 5)] ?? 500;
  return [0, 20, 45, 80, 130, 200][Math.min(currentTier + 1, 5)] ?? 200;
}
function canUpgrade(profile, equipmentId2) {
  const tier = profile.equipmentTiers[equipmentId2];
  if (tier >= 5) return { ok: false, reason: "\uC774\uBBF8 \uCD5C\uACE0 \uB2E8\uACC4\uC608\uC694.", cost: 0 };
  if (equipmentId2 === "crown" && profile.stage !== "crowned") {
    return { ok: false, reason: "\uBA74\uB958\uAD00\uC740 \uC624\uB79C \uB9D0\uC500\xB7\uBBFF\uC74C\xB7\uC0AC\uB791\uC758 \uC5EC\uC815\uC744 \uAC70\uCE5C \uB4A4 \uC5F4\uB824\uC694.", cost: upgradeCost(equipmentId2, tier) };
  }
  const cost = upgradeCost(equipmentId2, tier);
  if (profile.soulPoints < cost) return { ok: false, reason: `\uC601\uD63C \uD3EC\uC778\uD2B8\uAC00 ${cost - profile.soulPoints} \uB354 \uD544\uC694\uD574\uC694.`, cost };
  return { ok: true, reason: "\uC5C5\uADF8\uB808\uC774\uB4DC\uD560 \uC218 \uC788\uC5B4\uC694!", cost };
}
function upgradeEquipment(profile, equipmentId2) {
  const check = canUpgrade(profile, equipmentId2);
  if (!check.ok) return profile;
  const nextTier = Math.min(5, profile.equipmentTiers[equipmentId2] + 1);
  const equipped = profile.equipped.includes(equipmentId2) ? profile.equipped : [...profile.equipped, equipmentId2];
  return {
    ...profile,
    soulPoints: profile.soulPoints - check.cost,
    equipmentTiers: { ...profile.equipmentTiers, [equipmentId2]: nextTier },
    equipped
  };
}
function activityMessage(type) {
  switch (type) {
    case "scripture_read":
      return "\uB9D0\uC500 \uD55C \uB07C\uB97C \uB9DB\uC788\uAC8C \uBA39\uC5C8\uC5B4\uC694! \uC9C0\uD61C\uC640 \uBBFF\uC74C\uC774 \uC790\uB77C\uB098\uC694.";
    case "verse_memorized":
      return "\uB9D0\uC500\uC744 \uB9C8\uC74C\uC5D0 \uAF2D \uB2F4\uC558\uC5B4\uC694! \uC624\uB298 \uC601\uD63C\uC758 \uC2DD\uC0AC\uAC00 \uB4E0\uB4E0\uD558\uAC8C \uCC44\uC6CC\uC84C\uC5B4\uC694.";
    case "bible_conversation":
      return "\uC131\uACBD \uCE5C\uAD6C\uC640 \uB9D0\uC500\uC744 \uB354 \uAE4A\uC774 \uC54C\uC544\uAC14\uC5B4\uC694.";
    case "prayer":
      return "\uAE30\uB3C4\uD558\uBA70 \uB9C8\uC74C\uC5D0 \uD3C9\uC548\uC774 \uCC28\uC62C\uB790\uC5B4\uC694.";
    case "service_mission":
      return "\uC0AC\uB791\uC744 \uB098\uB204\uB2C8 \uC601\uD63C \uD3EC\uC778\uD2B8\uC640 \uC0AC\uB791 \uACBD\uD5D8\uC774 \uC790\uB790\uC5B4\uC694.";
    case "wilderness_victory":
      return "\uB450\uB824\uC6C0\uBCF4\uB2E4 \uB9D0\uC500\uC744 \uC120\uD0DD\uD588\uC5B4\uC694. \uBBFF\uC74C\uC774 \uB354 \uB2E8\uB2E8\uD574\uC84C\uC5B4\uC694!";
  }
}

// server/growthStore.ts
var defaultRow = (userId) => ({
  userId,
  stage: INITIAL_GROWTH_PROFILE.stage,
  spiritFood: INITIAL_GROWTH_PROFILE.spiritFood,
  faithXp: 0,
  wisdomXp: 0,
  loveXp: 0,
  peace: INITIAL_GROWTH_PROFILE.peace,
  soulPoints: 0,
  streakDays: 0,
  lastNourishedAt: null,
  equipped: JSON.stringify(INITIAL_GROWTH_PROFILE.equipped),
  equipmentTiers: JSON.stringify(INITIAL_GROWTH_PROFILE.equipmentTiers),
  unlockedZones: JSON.stringify(INITIAL_GROWTH_PROFILE.unlockedZones)
});
var growthSchemaReady = null;
function getSeoulDateKey(date = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function seoulDayNumber(date) {
  const key = getSeoulDateKey(date);
  const [year, month, day] = key.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 864e5);
}
function seoulDayDistance(from, to = /* @__PURE__ */ new Date()) {
  return Math.max(0, seoulDayNumber(to) - seoulDayNumber(from));
}
async function ensureGrowthSchema() {
  const db = await getDb();
  if (!db) return false;
  if (!growthSchemaReady) {
    growthSchemaReady = (async () => {
      try {
        await db.execute(sql2.raw(`CREATE TABLE IF NOT EXISTS user_growth_profiles (
          id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
          userId int NOT NULL UNIQUE,
          stage varchar(32) NOT NULL DEFAULT 'seedling',
          spiritFood int NOT NULL DEFAULT 65,
          faithXp int NOT NULL DEFAULT 0,
          wisdomXp int NOT NULL DEFAULT 0,
          loveXp int NOT NULL DEFAULT 0,
          peace int NOT NULL DEFAULT 80,
          soulPoints int NOT NULL DEFAULT 0,
          streakDays int NOT NULL DEFAULT 0,
          lastNourishedAt timestamp NULL,
          equipped text NOT NULL,
          equipmentTiers text NOT NULL,
          unlockedZones text NOT NULL,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`));
        await db.execute(sql2.raw(`CREATE TABLE IF NOT EXISTS user_growth_events (
          id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
          userId int NOT NULL,
          eventKey varchar(220) NOT NULL UNIQUE,
          eventType varchar(64) NOT NULL,
          sourceId varchar(160) NOT NULL,
          payload text,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`));
        return true;
      } catch (error) {
        console.warn("[Growth] Could not bootstrap growth tables:", error);
        growthSchemaReady = null;
        return false;
      }
    })();
  }
  return growthSchemaReady;
}
function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
function growthRowToProfile(row) {
  return {
    stage: row.stage,
    spiritFood: row.spiritFood,
    faithXp: row.faithXp,
    wisdomXp: row.wisdomXp,
    loveXp: row.loveXp,
    peace: row.peace,
    soulPoints: row.soulPoints,
    streakDays: row.streakDays,
    lastNourishedAt: row.lastNourishedAt?.toISOString() ?? null,
    equipped: parseJson(row.equipped, INITIAL_GROWTH_PROFILE.equipped),
    equipmentTiers: parseJson(row.equipmentTiers, INITIAL_GROWTH_PROFILE.equipmentTiers),
    unlockedZones: parseJson(row.unlockedZones, ["home"])
  };
}
function profileUpdate(profile, nourishedAt) {
  return {
    stage: profile.stage,
    spiritFood: profile.spiritFood,
    faithXp: profile.faithXp,
    wisdomXp: profile.wisdomXp,
    loveXp: profile.loveXp,
    peace: profile.peace,
    soulPoints: profile.soulPoints,
    streakDays: profile.streakDays,
    lastNourishedAt: nourishedAt,
    equipped: JSON.stringify(profile.equipped),
    equipmentTiers: JSON.stringify(profile.equipmentTiers),
    unlockedZones: JSON.stringify(profile.unlockedZones)
  };
}
async function applyDailyTick(userId, row) {
  const db = await getDb();
  if (!db) return growthRowToProfile(row);
  const today = getSeoulDateKey();
  const tickKey = `${userId}:daily_tick:${today}`;
  try {
    return await db.transaction(async (tx) => {
      const [tick] = await tx.select({ id: userGrowthEvents.id }).from(userGrowthEvents).where(eq2(userGrowthEvents.eventKey, tickKey)).limit(1);
      if (tick) return growthRowToProfile(row);
      await tx.execute(sql2`select ${userGrowthProfiles.id} from ${userGrowthProfiles} where ${userGrowthProfiles.userId} = ${userId} for update`);
      const [fresh] = await tx.select().from(userGrowthProfiles).where(eq2(userGrowthProfiles.userId, userId)).limit(1);
      if (!fresh) return growthRowToProfile(row);
      const anchor = fresh.lastNourishedAt ?? fresh.updatedAt;
      const missedDays = Math.max(0, seoulDayDistance(anchor) - 1);
      const current = growthRowToProfile(fresh);
      const next = applyDailyDecay(current, missedDays);
      await tx.insert(userGrowthEvents).values({
        userId,
        eventKey: tickKey,
        eventType: "daily_tick",
        sourceId: today,
        payload: JSON.stringify({ missedDays, foodBefore: current.spiritFood, foodAfter: next.spiritFood })
      });
      if (missedDays > 0) {
        await tx.update(userGrowthProfiles).set(profileUpdate(next, fresh.lastNourishedAt)).where(eq2(userGrowthProfiles.userId, userId));
      }
      return next;
    });
  } catch (error) {
    console.warn("[Growth] Daily tick skipped safely:", error);
    const [fresh] = await db.select().from(userGrowthProfiles).where(eq2(userGrowthProfiles.userId, userId)).limit(1);
    return fresh ? growthRowToProfile(fresh) : growthRowToProfile(row);
  }
}
async function getGrowthProfile(userId) {
  const db = await getDb();
  if (!db || !await ensureGrowthSchema()) return INITIAL_GROWTH_PROFILE;
  try {
    await db.insert(userGrowthProfiles).values(defaultRow(userId)).onDuplicateKeyUpdate({ set: { userId: sql2`${userGrowthProfiles.userId}` } });
    const [row] = await db.select().from(userGrowthProfiles).where(eq2(userGrowthProfiles.userId, userId)).limit(1);
    return row ? await applyDailyTick(userId, row) : INITIAL_GROWTH_PROFILE;
  } catch (error) {
    console.warn("[Growth] Profile read failed:", error);
    return INITIAL_GROWTH_PROFILE;
  }
}
async function claimGrowthActivity(userId, input) {
  const db = await getDb();
  const reward = ACTIVITY_REWARDS[input.type];
  if (!db || !await ensureGrowthSchema()) {
    return { claimed: true, saved: false, reward, profile: applyReward(INITIAL_GROWTH_PROFILE, reward), message: `${activityMessage(input.type)} (\uC784\uC2DC \uAE30\uB85D)` };
  }
  try {
    return await db.transaction(async (tx) => {
      await tx.insert(userGrowthProfiles).values(defaultRow(userId)).onDuplicateKeyUpdate({ set: { userId: sql2`${userGrowthProfiles.userId}` } });
      await tx.execute(sql2`select ${userGrowthProfiles.id} from ${userGrowthProfiles} where ${userGrowthProfiles.userId} = ${userId} for update`);
      const [row] = await tx.select().from(userGrowthProfiles).where(eq2(userGrowthProfiles.userId, userId)).limit(1);
      if (!row) throw new Error("growth profile missing after upsert");
      const profile = growthRowToProfile(row);
      const eventKey = `${userId}:${input.type}:${input.sourceId}`;
      const [existing] = await tx.select({ id: userGrowthEvents.id }).from(userGrowthEvents).where(eq2(userGrowthEvents.eventKey, eventKey)).limit(1);
      if (existing) {
        return { claimed: false, saved: true, reward, profile, message: "\uC774\uBBF8 \uBC1B\uC740 \uC131\uC7A5 \uBCF4\uC0C1\uC774\uC5D0\uC694. \uB9D0\uC500\uACFC \uB300\uD654 \uC790\uCCB4\uB294 \uC5B8\uC81C\uB4E0 \uB2E4\uC2DC \uC990\uAE38 \uC218 \uC788\uC5B4\uC694." };
      }
      let next = applyReward(profile, reward);
      const nourishes = input.type === "scripture_read" || input.type === "verse_memorized" || input.type === "bible_conversation";
      const now = /* @__PURE__ */ new Date();
      let lastNourishedAt = row.lastNourishedAt;
      if (nourishes) {
        if (!row.lastNourishedAt) {
          next = { ...next, streakDays: 1 };
        } else {
          const dayDistance = seoulDayDistance(row.lastNourishedAt, now);
          if (dayDistance === 1) next = { ...next, streakDays: Math.max(1, profile.streakDays) + 1 };
          else if (dayDistance > 1) next = { ...next, streakDays: 1 };
        }
        lastNourishedAt = now;
      }
      await tx.insert(userGrowthEvents).values({
        userId,
        eventKey,
        eventType: input.type,
        sourceId: input.sourceId,
        payload: JSON.stringify({ title: input.title ?? null, reward })
      });
      await tx.update(userGrowthProfiles).set(profileUpdate(next, lastNourishedAt)).where(eq2(userGrowthProfiles.userId, userId));
      return { claimed: true, saved: true, reward, profile: { ...next, lastNourishedAt: lastNourishedAt?.toISOString() ?? null }, message: activityMessage(input.type) };
    });
  } catch (error) {
    console.warn("[Growth] Activity claim failed:", error);
    return { claimed: false, saved: false, reward, profile: await getGrowthProfile(userId), message: "\uC131\uC7A5 \uAE30\uB85D \uC800\uC7A5\uC774 \uC7A0\uC2DC \uC5B4\uB824\uC6CC\uC694. \uB9D0\uC500\uC740 \uADF8\uB300\uB85C \uC77D\uC744 \uC218 \uC788\uACE0, \uC7A0\uC2DC \uB4A4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694." };
  }
}
async function claimAutomaticGrowthActivity(userId, type, canonicalSource, title, dailyLimit) {
  const db = await getDb();
  const date = getSeoulDateKey();
  const safeSource = canonicalSource.replace(/[^a-zA-Z0-9:_-]/g, "-").slice(0, 72) || "activity";
  const sourceId = `auto:${date}:${type}:${safeSource}`;
  if (!db || !await ensureGrowthSchema()) {
    return claimGrowthActivity(userId, { type, sourceId, title });
  }
  const eventKey = `${userId}:${type}:${sourceId}`;
  const [sameSource] = await db.select({ id: userGrowthEvents.id }).from(userGrowthEvents).where(eq2(userGrowthEvents.eventKey, eventKey)).limit(1);
  if (sameSource) {
    return { claimed: false, saved: true, reward: ACTIVITY_REWARDS[type], profile: await getGrowthProfile(userId), message: "\uC774 \uD65C\uB3D9\uC758 \uC624\uB298 \uC131\uC7A5 \uBCF4\uC0C1\uC740 \uC774\uBBF8 \uBC1B\uC558\uC5B4\uC694." };
  }
  const prefix = `auto:${date}:${type}:%`;
  const [countRow] = await db.select({ count: sql2`count(*)` }).from(userGrowthEvents).where(and2(eq2(userGrowthEvents.userId, userId), eq2(userGrowthEvents.eventType, type), like(userGrowthEvents.sourceId, prefix)));
  if (Number(countRow?.count ?? 0) >= dailyLimit) {
    return { claimed: false, saved: true, reward: ACTIVITY_REWARDS[type], profile: await getGrowthProfile(userId), message: "\uC624\uB298\uC758 \uC131\uC7A5 \uBCF4\uC0C1\uC740 \uCDA9\uBD84\uD788 \uBC1B\uC558\uC5B4\uC694. \uB9D0\uC500\uACFC \uB300\uD654\uB294 \uC810\uC218 \uC5C6\uC774\uB3C4 \uC5B8\uC81C\uB4E0 \uACC4\uC18D\uD560 \uC218 \uC788\uC5B4\uC694." };
  }
  return claimGrowthActivity(userId, { type, sourceId, title });
}
async function upgradeGrowthEquipment(userId, equipmentId2) {
  const db = await getDb();
  if (!db || !await ensureGrowthSchema()) return { upgraded: false, saved: false, profile: INITIAL_GROWTH_PROFILE, message: "\uC131\uC7A5 \uC800\uC7A5\uC18C\uAC00 \uC7A0\uC2DC \uC900\uBE44 \uC911\uC774\uC5D0\uC694." };
  try {
    return await db.transaction(async (tx) => {
      await tx.insert(userGrowthProfiles).values(defaultRow(userId)).onDuplicateKeyUpdate({ set: { userId: sql2`${userGrowthProfiles.userId}` } });
      await tx.execute(sql2`select ${userGrowthProfiles.id} from ${userGrowthProfiles} where ${userGrowthProfiles.userId} = ${userId} for update`);
      const [row] = await tx.select().from(userGrowthProfiles).where(eq2(userGrowthProfiles.userId, userId)).limit(1);
      if (!row) throw new Error("growth profile missing after upsert");
      const profile = growthRowToProfile(row);
      const check = canUpgrade(profile, equipmentId2);
      if (!check.ok) return { upgraded: false, saved: true, profile, message: check.reason };
      const next = upgradeEquipment(profile, equipmentId2);
      await tx.update(userGrowthProfiles).set(profileUpdate(next, row.lastNourishedAt)).where(eq2(userGrowthProfiles.userId, userId));
      return { upgraded: true, saved: true, profile: next, message: "\uC7A5\uBE44\uAC00 \uD55C \uB2E8\uACC4 \uC131\uC7A5\uD588\uC5B4\uC694!" };
    });
  } catch (error) {
    console.warn("[Growth] Equipment upgrade failed:", error);
    return { upgraded: false, saved: false, profile: await getGrowthProfile(userId), message: "\uC7A5\uBE44 \uC800\uC7A5\uC774 \uC7A0\uC2DC \uC5B4\uB824\uC6CC\uC694. \uD3EC\uC778\uD2B8\uB294 \uC783\uC9C0 \uC54A\uC558\uC5B4\uC694." };
  }
}
async function setGrowthEquipmentEquipped(userId, equipmentId2, equipped) {
  const db = await getDb();
  if (!db || !await ensureGrowthSchema()) return { saved: false, profile: INITIAL_GROWTH_PROFILE, message: "\uC131\uC7A5 \uC800\uC7A5\uC18C\uAC00 \uC7A0\uC2DC \uC900\uBE44 \uC911\uC774\uC5D0\uC694." };
  try {
    return await db.transaction(async (tx) => {
      await tx.insert(userGrowthProfiles).values(defaultRow(userId)).onDuplicateKeyUpdate({ set: { userId: sql2`${userGrowthProfiles.userId}` } });
      await tx.execute(sql2`select ${userGrowthProfiles.id} from ${userGrowthProfiles} where ${userGrowthProfiles.userId} = ${userId} for update`);
      const [row] = await tx.select().from(userGrowthProfiles).where(eq2(userGrowthProfiles.userId, userId)).limit(1);
      if (!row) throw new Error("growth profile missing after upsert");
      const profile = growthRowToProfile(row);
      if (profile.equipmentTiers[equipmentId2] <= 0) return { saved: true, profile, message: "\uBA3C\uC800 \uC7A5\uBE44\uB97C \uD574\uC81C\uD574 \uC8FC\uC138\uC694." };
      const nextEquipped = equipped ? Array.from(/* @__PURE__ */ new Set([...profile.equipped, equipmentId2])) : profile.equipped.filter((id) => id !== equipmentId2);
      const next = { ...profile, equipped: nextEquipped };
      await tx.update(userGrowthProfiles).set(profileUpdate(next, row.lastNourishedAt)).where(eq2(userGrowthProfiles.userId, userId));
      return { saved: true, profile: next, message: equipped ? "\uC7A5\uBE44\uB97C \uCC29\uC6A9\uD588\uC5B4\uC694." : "\uC7A5\uBE44\uB97C \uBCF4\uAD00\uD568\uC5D0 \uB123\uC5C8\uC5B4\uC694." };
    });
  } catch (error) {
    console.warn("[Growth] Equipment equip failed:", error);
    return { saved: false, profile: await getGrowthProfile(userId), message: "\uC7A5\uBE44 \uC0C1\uD0DC \uC800\uC7A5\uC774 \uC7A0\uC2DC \uC5B4\uB824\uC6CC\uC694." };
  }
}

// server/growthRouter.ts
var directActivityType = z2.enum([
  "scripture_read",
  "prayer",
  "service_mission",
  "wilderness_victory"
]);
var equipmentId = z2.enum([
  "belt_truth",
  "breastplate_righteousness",
  "shoes_peace",
  "shield_faith",
  "helmet_salvation",
  "sword_spirit",
  "crown"
]);
function normalizeKoreanSpeech(value) {
  return value.normalize("NFKC").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}
function bigramCoverage(expectedText, actualText) {
  const expected = normalizeKoreanSpeech(expectedText);
  const actual = normalizeKoreanSpeech(actualText);
  if (expected.length < 2 || actual.length < 2) return 0;
  const expectedPairs = [];
  for (let index = 0; index < expected.length - 1; index += 1) expectedPairs.push(expected.slice(index, index + 2));
  const actualCounts = /* @__PURE__ */ new Map();
  for (let index = 0; index < actual.length - 1; index += 1) {
    const pair = actual.slice(index, index + 2);
    actualCounts.set(pair, (actualCounts.get(pair) ?? 0) + 1);
  }
  let matched = 0;
  for (const pair of expectedPairs) {
    const count = actualCounts.get(pair) ?? 0;
    if (count > 0) {
      matched += 1;
      actualCounts.set(pair, count - 1);
    }
  }
  return matched / expectedPairs.length;
}
var growthRouter = router({
  profile: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return { authenticated: false, profile: null };
    return { authenticated: true, profile: await getGrowthProfile(ctx.user.id) };
  }),
  claimActivity: publicProcedure.input(z2.object({ type: directActivityType, sourceId: z2.string().min(1).max(160), title: z2.string().max(160).optional() })).mutation(async ({ ctx, input }) => {
    if (!ctx.user) return { authenticated: false, claimed: false, saved: false, profile: null, message: "\uB85C\uADF8\uC778\uD558\uBA74 \uC131\uC7A5 \uAE30\uB85D\uC744 \uC548\uC804\uD558\uAC8C \uC800\uC7A5\uD560 \uC218 \uC788\uC5B4\uC694." };
    return { authenticated: true, ...await claimGrowthActivity(ctx.user.id, input) };
  }),
  verifyMemorization: publicProcedure.input(z2.object({ verseId: z2.string().min(1).max(80), recitedText: z2.string().min(2).max(500) })).mutation(async ({ ctx, input }) => {
    const verse = getGrowthDailyVerse(input.verseId);
    if (!verse) return { authenticated: Boolean(ctx.user), matched: false, score: 0, claimed: false, profile: null, message: "\uC624\uB298\uC758 \uC554\uC1A1 \uB9D0\uC500\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC5B4\uC694." };
    const score = bigramCoverage(verse.text, input.recitedText);
    const matched = score >= 0.72;
    if (!ctx.user) {
      return {
        authenticated: false,
        matched,
        score,
        claimed: false,
        profile: null,
        message: matched ? "\uC544\uC8FC \uC798 \uC554\uC1A1\uD588\uC5B4\uC694! \uB85C\uADF8\uC778\uD558\uBA74 \uC131\uC7A5 \uAE30\uB85D\uB3C4 \uC800\uC7A5\uB3FC\uC694." : "\uC870\uAE08\uB9CC \uB354 \uCC9C\uCC9C\uD788 \uB9D0\uC500\uC744 \uB5A0\uC62C\uB824 \uBD10\uC694. \uD2C0\uB824\uB3C4 \uAD1C\uCC2E\uC544\uC694."
      };
    }
    if (!matched) {
      return {
        authenticated: true,
        matched: false,
        score,
        claimed: false,
        profile: await getGrowthProfile(ctx.user.id),
        message: "\uC870\uAE08\uB9CC \uB354 \uCC9C\uCC9C\uD788 \uB9D0\uC500\uC744 \uB5A0\uC62C\uB824 \uBD10\uC694. \uC644\uBCBD\uD558\uC9C0 \uC54A\uC544\uB3C4 \uAD1C\uCC2E\uACE0, \uB2E4\uC2DC \uD574 \uBCFC \uC218 \uC788\uC5B4\uC694."
      };
    }
    const result = await claimGrowthActivity(ctx.user.id, {
      type: "verse_memorized",
      sourceId: `memory:${getSeoulDateKey()}:${verse.id}`,
      title: `${verse.ref} \uC554\uC1A1`
    });
    return {
      authenticated: true,
      matched: true,
      score,
      claimed: result.claimed,
      profile: result.profile,
      message: result.claimed ? `\uB9D0\uC500\uC744 \uB9C8\uC74C\uC5D0 \uC798 \uB2F4\uC558\uC5B4\uC694! ${verse.ref} \uC554\uC1A1\uC73C\uB85C \uC624\uB298 \uC601\uD63C\uC758 \uC2DD\uC0AC\uAC00 \uB4E0\uB4E0\uD574\uC84C\uC5B4\uC694.` : result.message
    };
  }),
  upgradeEquipment: publicProcedure.input(z2.object({ equipmentId })).mutation(async ({ ctx, input }) => {
    if (!ctx.user) return { authenticated: false, upgraded: false, saved: false, profile: null, message: "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD574\uC694." };
    return { authenticated: true, ...await upgradeGrowthEquipment(ctx.user.id, input.equipmentId) };
  }),
  equip: publicProcedure.input(z2.object({ equipmentId, equipped: z2.boolean() })).mutation(async ({ ctx, input }) => {
    if (!ctx.user) return { authenticated: false, saved: false, profile: null, message: "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD574\uC694." };
    return { authenticated: true, ...await setGrowthEquipmentEquipped(ctx.user.id, input.equipmentId, input.equipped) };
  })
});

// server/bibleContent.ts
var BIBLE_STORIES = [
  {
    id: "noah",
    title: "\uB178\uC544\uC758 \uBC29\uC8FC",
    subtitle: "\uC57D\uC18D\uC744 \uC9C0\uD0A4\uC2DC\uB294 \uD558\uB098\uB2D8",
    body: "\uD558\uB098\uB2D8\uC740 \uB178\uC544\uC5D0\uAC8C \uD070 \uBC30\uB97C \uB9CC\uB4E4\uB77C\uACE0 \uB9D0\uC500\uD558\uC168\uC5B4\uC694. \uB178\uC544\uB294 \uBBFF\uC74C\uC73C\uB85C \uC21C\uC885\uD588\uACE0, \uB3D9\uBB3C \uCE5C\uAD6C\uB4E4\uACFC \uAC00\uC871\uC744 \uBC29\uC8FC\uC5D0 \uD0DC\uC6E0\uC5B4\uC694. \uBE44\uAC00 \uADF8\uCE5C \uB4A4 \uD558\uB098\uB2D8\uC740 \uB2E4\uC2DC\uB294 \uBB3C\uB85C \uC138\uC0C1\uC744 \uC2EC\uD310\uD558\uC9C0 \uC54A\uACA0\uB2E4\uB294 \uC57D\uC18D\uC758 \uBB34\uC9C0\uAC1C\uB97C \uBCF4\uC5EC \uC8FC\uC168\uC5B4\uC694.",
    lesson: "\uD558\uB098\uB2D8\uC740 \uC6B0\uB9AC\uB97C \uB3CC\uBCF4\uC2DC\uACE0, \uC57D\uC18D\uC744 \uC18C\uC911\uD788 \uC9C0\uD0A4\uC138\uC694.",
    verse: "\uCC3D\uC138\uAE30 9:13",
    accent: "coral",
    imageUrl: "/manus-storage/story_noah_a1e0e2bf.png",
    illustrationPrompt: "A joyful, child-friendly 3D animated illustration of Noah's ark on calm turquoise water, Noah smiling kindly on the deck, pairs of adorable animals peeking from the windows, a soft rainbow and warm golden clouds, biblical setting, colorful storybook composition, no text, gentle emotional expression."
  },
  {
    id: "david",
    title: "\uB2E4\uC717\uACFC \uACE8\uB9AC\uC557",
    subtitle: "\uC791\uC740 \uC6A9\uAE30\uAC00 \uB9CC\uB4DC\uB294 \uD070 \uBCC0\uD654",
    body: "\uB2E4\uC717\uC740 \uC544\uC8FC \uD070 \uACE8\uB9AC\uC557\uC744 \uBCF4\uC558\uC9C0\uB9CC, \uBB34\uC11C\uC6C0\uBCF4\uB2E4 \uD558\uB098\uB2D8\uC744 \uBBFF\uB294 \uB9C8\uC74C\uC744 \uC120\uD0DD\uD588\uC5B4\uC694. \uB2E4\uC717\uC740 \uC791\uC740 \uBB3C\uB9E4\uB3CC \uD558\uB098\uB85C \uACE8\uB9AC\uC557\uC5D0\uAC8C \uB9DE\uC130\uACE0, \uD558\uB098\uB2D8\uC774 \uC8FC\uC2E0 \uC6A9\uAE30\uB85C \uC774\uACA8 \uB0C8\uB2F5\uB2C8\uB2E4.",
    lesson: "\uB0B4\uAC00 \uC791\uC544 \uBCF4\uC5EC\uB3C4 \uD558\uB098\uB2D8\uC744 \uBBFF\uACE0 \uC6A9\uAE30\uB97C \uB0BC \uC218 \uC788\uC5B4\uC694.",
    verse: "\uC0AC\uBB34\uC5D8\uC0C1 17:47",
    accent: "mint",
    imageUrl: "/manus-storage/story_david_0b7c9097.png",
    illustrationPrompt: "A brave child-friendly 3D animated illustration of young David holding a sling on a sunny ancient valley, a towering but non-scary Goliath in the far background, David's expression hopeful and courageous, soft green hills, warm colors, inspirational biblical storybook art, no text."
  },
  {
    id: "jesus",
    title: "\uC608\uC218\uB2D8\uC758 \uC0AC\uB791",
    subtitle: "\uC788\uB294 \uADF8\uB300\uB85C \uC548\uC544 \uC8FC\uC2DC\uB294 \uC0AC\uB791",
    body: "\uC608\uC218\uB2D8\uC740 \uC5B4\uB9B0\uC774\uB4E4\uC774 \uAC00\uAE4C\uC774 \uC624\uB294 \uAC83\uC744 \uAE30\uBED0\uD558\uC168\uC5B4\uC694. \uC608\uC218\uB2D8\uC740 \uC0AC\uB78C\uB4E4\uC758 \uC774\uC57C\uAE30\uB97C \uADC0 \uAE30\uC6B8\uC5EC \uB4E3\uACE0, \uC544\uD508 \uB9C8\uC74C\uC744 \uC704\uB85C\uD558\uC168\uC5B4\uC694. \uC608\uC218\uB2D8\uC758 \uC0AC\uB791\uC740 \uB204\uAD6C\uC5D0\uAC8C\uB098 \uC5F4\uB824 \uC788\uACE0, \uC6B0\uB9AC\uB3C4 \uC11C\uB85C \uB530\uB73B\uD558\uAC8C \uB300\uD560 \uC218 \uC788\uAC8C \uD574 \uC918\uC694.",
    lesson: "\uB098\uB294 \uC0AC\uB791\uBC1B\uB294 \uC18C\uC911\uD55C \uC5B4\uB9B0\uC774\uC774\uACE0, \uB2E4\uB978 \uC0AC\uB78C\uC5D0\uAC8C\uB3C4 \uC0AC\uB791\uC744 \uB098\uB20C \uC218 \uC788\uC5B4\uC694.",
    verse: "\uB9C8\uAC00\uBCF5\uC74C 10:14",
    accent: "blue",
    imageUrl: "/manus-storage/story_jesus_9ab7568d.png",
    illustrationPrompt: "A warm child-friendly 3D animated illustration of Jesus sitting with smiling children in a sunlit meadow, welcoming open arms, diverse joyful children, soft flowers and gentle light, peaceful biblical storybook mood, tender emotional expressions, no text."
  },
  {
    id: "creation",
    title: "\uCC9C\uC9C0\uCC3D\uC870",
    subtitle: "\uD558\uB098\uB2D8\uC774 \uB9CC\uB4DC\uC2E0 \uC544\uB984\uB2E4\uC6B4 \uC138\uC0C1",
    body: "\uC544\uC8FC \uBA3C \uC61B\uB0A0, \uD558\uB098\uB2D8\uC740 \uB9D0\uC500\uC73C\uB85C \uBE5B\uACFC \uD558\uB298, \uBC14\uB2E4\uC640 \uB545\uC744 \uB9CC\uB4DC\uC168\uC5B4\uC694. \uC608\uC05C \uAF43\uACFC \uB098\uBB34, \uBC14\uB2E4\uC758 \uBB3C\uACE0\uAE30\uC640 \uD558\uB298\uC758 \uC0C8, \uADC0\uC5EC\uC6B4 \uB3D9\uBB3C\uB3C4 \uB9CC\uB4DC\uC168\uC9C0\uC694. \uADF8\uB9AC\uACE0 \uD558\uB098\uB2D8\uC740 \uC6B0\uB9AC\uB97C \uC9C0\uC73C\uC2DC\uACE0 \uC544\uC8FC \uAE30\uBED0\uD558\uC168\uC5B4\uC694.",
    lesson: "\uC138\uC0C1\uACFC \uB098\uB294 \uD558\uB098\uB2D8\uC758 \uC544\uB984\uB2E4\uC6B4 \uC120\uBB3C\uC774\uC5D0\uC694.",
    verse: "\uCC3D\uC138\uAE30 1:31",
    accent: "violet",
    imageUrl: "/manus-storage/story_creation_4ad3b88a.png",
    illustrationPrompt: "A magical child-friendly 3D animated illustration of creation: lush garden, colorful flowers, friendly animals, bright sun, sparkling stars, clear blue water, soft clouds and a feeling of wonder, biblical storybook scene, no text."
  },
  {
    id: "joseph",
    title: "\uAFC8\uAFB8\uB294 \uC694\uC149",
    subtitle: "\uAFC8\uC744 \uD488\uACE0 \uB2E4\uC2DC \uC77C\uC5B4\uB098\uB294 \uB9C8\uC74C",
    body: "\uC694\uC149\uC740 \uD558\uB098\uB2D8\uC774 \uC8FC\uC2E0 \uD2B9\uBCC4\uD55C \uAFC8\uC744 \uB9C8\uC74C\uC5D0 \uAC04\uC9C1\uD588\uC5B4\uC694. \uC5B4\uB824\uC6B4 \uC77C\uC744 \uB9CC\uB0AC\uC744 \uB54C\uB3C4 \uD558\uB098\uB2D8\uC740 \uC694\uC149\uACFC \uD568\uAED8\uD558\uC168\uACE0, \uC694\uC149\uC740 \uC9C0\uD61C\uC640 \uC131\uC2E4\uD568\uC73C\uB85C \uC0AC\uB78C\uB4E4\uC744 \uB3C4\uC654\uC5B4\uC694. \uC2DC\uAC04\uC774 \uC9C0\uB098 \uC694\uC149\uC758 \uAFC8\uC740 \uB2E4\uB978 \uC0AC\uB78C\uC744 \uC0B4\uB9AC\uB294 \uBA4B\uC9C4 \uC77C\uC774 \uB418\uC5C8\uB2F5\uB2C8\uB2E4.",
    lesson: "\uD558\uB098\uB2D8\uC740 \uC5B4\uB824\uC6B4 \uC21C\uAC04\uC5D0\uB3C4 \uD568\uAED8\uD558\uC2DC\uACE0, \uC6B0\uB9AC\uC758 \uB9C8\uC74C\uC744 \uC88B\uC740 \uAE38\uB85C \uC774\uB044\uC138\uC694.",
    verse: "\uCC3D\uC138\uAE30 50:20",
    accent: "gold",
    imageUrl: "/manus-storage/story_joseph_aa32c037.png",
    illustrationPrompt: "A hopeful child-friendly 3D animated illustration of young Joseph wearing a colorful coat beneath a magical night sky with friendly glowing stars, gentle desert hills, warm hopeful lighting, expressive kind eyes, biblical storybook art, no text."
  },
  {
    id: "daniel",
    title: "\uC0AC\uC790\uAD74\uC758 \uB2E4\uB2C8\uC5D8",
    subtitle: "\uC5B4\uB824\uC6C0 \uC18D\uC5D0\uC11C\uB3C4 \uC9C0\uCF1C\uC8FC\uC2DC\uB294 \uD558\uB098\uB2D8",
    body: "\uB2E4\uB2C8\uC5D8\uC740 \uC628 \uC138\uC0C1\uC758 \uCC3D\uC870\uC774\uC2E0 \uD558\uB098\uB2D8\uAED8 \uB9E4\uC77C \uAE30\uB3C4\uD558\uB294 \uAC83\uC744 \uBA48\uCD94\uC9C0 \uC54A\uC558\uC5B4\uC694. \uC704\uD5D8\uD55C \uC0AC\uC790\uAD74\uC5D0 \uB358\uC838\uC84C\uC744 \uB54C\uB3C4 \uD558\uB098\uB2D8\uC740 \uCC9C\uC0AC\uB97C \uBCF4\uB0B4\uC5B4 \uB2E4\uB2C8\uC5D8\uC744 \uC548\uC804\uD558\uAC8C \uC9C0\uCF1C \uC8FC\uC168\uB2F5\uB2C8\uB2E4.",
    lesson: "\uB204\uAC00 \uBB50\uB77C \uD574\uB3C4 \uD558\uB098\uB2D8\uC744 \uD5A5\uD55C \uBBFF\uC74C\uACFC \uAE30\uB3C4\uB97C \uC9C0\uCF1C\uC694.",
    verse: "\uB2E4\uB2C8\uC5D8 6:22",
    accent: "violet",
    imageUrl: "/manus-storage/story_david_0b7c9097.png",
    illustrationPrompt: "A warm, child-friendly 3D animated illustration of Daniel praying peacefully inside a bright cave with friendly lions resting around him, soft golden heavenly light, reassuring biblical storybook art, no text."
  },
  {
    id: "solomon",
    title: "\uC9C0\uD61C\uC758 \uC655 \uC194\uB85C\uBAAC",
    subtitle: "\uD558\uB098\uB2D8\uAED8 \uC9C0\uD61C\uB97C \uAD6C\uD55C \uC655",
    body: "\uC194\uB85C\uBAAC\uC740 \uC655\uC774 \uB418\uC5C8\uC744 \uB54C \uD070 \uBD80\uB098 \uBA85\uC608\uBCF4\uB2E4 \uBC31\uC131\uB4E4\uC744 \uBC14\uB974\uAC8C \uC774\uB04C \uC218 \uC788\uB294 '\uC9C0\uD61C\uB85C\uC6B4 \uB9C8\uC74C'\uC744 \uD558\uB098\uB2D8\uAED8 \uAC04\uAD6C\uD588\uC5B4\uC694. \uD558\uB098\uB2D8\uC740 \uC194\uB85C\uBAAC\uC758 \uC608\uC05C \uB9C8\uC74C\uC744 \uAE30\uBED0\uD558\uC2DC\uBA70 \uB118\uCE58\uB294 \uC9C0\uD61C\uC640 \uCD95\uBCF5\uC744 \uC8FC\uC168\uB2F5\uB2C8\uB2E4.",
    lesson: "\uAC00\uC7A5 \uC18C\uC911\uD55C \uAC83\uC740 \uD558\uB098\uB2D8\uC774 \uC8FC\uC2DC\uB294 \uC9C0\uD61C\uC640 \uBC14\uB978 \uB9C8\uC74C\uC774\uC5D0\uC694.",
    verse: "\uC5F4\uC655\uAE30\uC0C1 3:9",
    accent: "mint",
    imageUrl: "/manus-storage/story_creation_3e9569ce.png",
    illustrationPrompt: "A bright, joyful child-friendly 3D animated illustration of young King Solomon smiling wisely in a beautiful ancient palace with scrolls and gentle warm lighting, inspiring biblical storybook art, no text."
  },
  {
    id: "easter",
    title: "\uBD80\uD65C\uC808 \uC544\uCE68",
    subtitle: "\uC0C8 \uC0DD\uBA85\uACFC \uC2B9\uB9AC\uC758 \uAE30\uC068",
    body: "\uC608\uC218\uB2D8\uC740 \uC6B0\uB9AC\uB97C \uC704\uD574 \uC2ED\uC790\uAC00\uC5D0\uC11C \uBAA8\uB4E0 \uC544\uD514\uC744 \uC774\uAE30\uC2DC\uACE0, \uC0BC\uC77C \uB9CC\uC5D0 \uB2E4\uC2DC \uC0B4\uC544\uB098\uC168\uC5B4\uC694! \uC2AC\uD37C\uD558\uB358 \uC81C\uC790\uB4E4\uC5D0\uAC8C \uCC3E\uC544\uC640 \uD3C9\uC548\uC744 \uC8FC\uC168\uACE0, \uC601\uC6D0\uD55C \uC0DD\uBA85\uACFC \uC18C\uB9DD\uC758 \uAE30\uC068\uC744 \uC120\uBB3C\uB85C \uC8FC\uC168\uB2F5\uB2C8\uB2E4.",
    lesson: "\uC608\uC218\uB2D8\uC758 \uBD80\uD65C\uC740 \uC6B0\uB9AC \uB9C8\uC74C\uC5D0 \uC601\uC6D0\uD55C \uC18C\uB9DD\uACFC \uAE30\uC068\uC744 \uC918\uC694.",
    verse: "\uB204\uAC00\uBCF5\uC74C 24:6",
    accent: "coral",
    imageUrl: "/manus-storage/story_jesus_9ab7568d.png",
    illustrationPrompt: "A radiant child-friendly 3D animated illustration of an empty tomb with bright golden morning light, blooming spring flowers, joyous angelic glow, hopeful and peaceful Easter morning atmosphere, no text."
  },
  {
    id: "thanksgiving",
    title: "\uCD94\uC218\uAC10\uC0AC \uCD95\uC81C",
    subtitle: "\uD558\uB098\uB2D8\uC774 \uC8FC\uC2E0 \uC740\uD61C\uC5D0 \uAC10\uC0AC\uD574\uC694",
    body: "\uC774\uC2A4\uB77C\uC5D8 \uBC31\uC131\uB4E4\uC740 \uD558\uB098\uB2D8\uC774 \uD55C \uD574 \uB3D9\uC548 \uBC2D\uC5D0 \uAC70\uB454 \uACE1\uC2DD\uACFC \uACFC\uC77C\uB85C \uD48D\uC131\uD558\uAC8C \uCC44\uC6CC \uC8FC\uC2E0 \uC740\uD61C\uB97C \uAE30\uC5B5\uD558\uBA70 \uAE30\uC068\uC758 \uCD95\uC81C\uB97C \uB4DC\uB838\uC5B4\uC694. \uC6B0\uB9AC \uC0B6\uC758 \uBAA8\uB4E0 \uC791\uC740 \uC21C\uAC04\uB3C4 \uD558\uB098\uB2D8\uC758 \uC120\uBB3C\uC774\uC5D0\uC694.",
    lesson: "\uB9E4\uC77C\uC758 \uC77C\uC0C1\uACFC \uCC44\uC6CC\uC8FC\uC2DC\uB294 \uC740\uD61C\uC5D0 \uAC10\uC0AC\uD558\uB294 \uB9C8\uC74C\uC744 \uAC00\uC838\uC694.",
    verse: "\uC2DC\uD3B8 107:1",
    accent: "gold",
    imageUrl: "/manus-storage/story_noah_a1e0e2bf.png",
    illustrationPrompt: "A warm, harvest-themed child-friendly 3D animated illustration of baskets filled with autumn fruits, golden wheat, smiling children and families sharing a grateful meal under warm sunshine, cozy storybook style, no text."
  }
];
var QUIZ_BANK = [
  { id: "q-noah", question: "\uB178\uC544\uAC00 \uB3D9\uBB3C \uCE5C\uAD6C\uB4E4\uACFC \uD568\uAED8 \uB4E4\uC5B4\uAC04 \uAC83\uC740 \uBB34\uC5C7\uC778\uAC00\uC694?", options: ["\uD070 \uBC30", "\uAD81\uC804", "\uB3D9\uAD74", "\uB192\uC740 \uD0D1"], answer: 0, explanation: "\uB178\uC544\uB294 \uD558\uB098\uB2D8 \uB9D0\uC500\uC5D0 \uB530\uB77C \uBC29\uC8FC\uB77C\uB294 \uD070 \uBC30\uB97C \uB9CC\uB4E4\uC5C8\uC5B4\uC694." },
  { id: "q-david", question: "\uB2E4\uC717\uC774 \uACE8\uB9AC\uC557\uC5D0\uAC8C \uB9DE\uC124 \uB54C \uC0AC\uC6A9\uD55C \uAC83\uC740 \uBB34\uC5C7\uC778\uAC00\uC694?", options: ["\uBB3C\uB9E4\uB3CC", "\uD070 \uCC3D", "\uB9C8\uBC95 \uC9C0\uD321\uC774", "\uB300\uD3EC"], answer: 0, explanation: "\uB2E4\uC717\uC740 \uBB3C\uB9E4\uC640 \uB3CC\uC744 \uC0AC\uC6A9\uD588\uC9C0\uB9CC, \uC9C4\uC9DC \uD798\uC740 \uD558\uB098\uB2D8\uC744 \uBBFF\uB294 \uC6A9\uAE30\uC600\uC5B4\uC694." },
  { id: "q-jesus", question: "\uC608\uC218\uB2D8\uC740 \uC5B4\uB9B0\uC774\uB4E4\uC774 \uAC00\uAE4C\uC774 \uC624\uB294 \uAC83\uC744 \uC5B4\uB5BB\uAC8C \uD558\uC168\uB098\uC694?", options: ["\uAE30\uC058\uAC8C \uB9DE\uC544 \uC8FC\uC168\uC5B4\uC694", "\uBA40\uB9AC \uBCF4\uB0B4\uC168\uC5B4\uC694", "\uBAA8\uB978 \uCC99\uD588\uC5B4\uC694", "\uC228\uC73C\uC168\uC5B4\uC694"], answer: 0, explanation: "\uC608\uC218\uB2D8\uC740 \uC5B4\uB9B0\uC774\uB4E4\uC744 \uC0AC\uB791\uD558\uC2DC\uACE0 \uAC00\uAE4C\uC774 \uC624\uB294 \uAC83\uC744 \uAE30\uBED0\uD558\uC168\uC5B4\uC694." },
  { id: "q-creation", question: "\uD558\uB098\uB2D8\uC774 \uB9CC\uB4DC\uC2E0 \uAC83 \uC911 \uD558\uB098\uAC00 \uC544\uB2CC \uAC83\uC740 \uBB34\uC5C7\uC778\uAC00\uC694?", options: ["\uD558\uB298\uC758 \uBCC4", "\uBC14\uB2E4\uC758 \uBB3C\uACE0\uAE30", "\uC0AC\uB791\uD558\uB294 \uB9C8\uC74C", "\uC790\uB3D9\uCC28 \uACBD\uC8FC \uD2B8\uB799"], answer: 3, explanation: "\uC131\uACBD\uC758 \uCC3D\uC870 \uC774\uC57C\uAE30\uB294 \uD558\uB298\uACFC \uB545, \uC0DD\uBA85\uACFC \uC0AC\uB78C\uC744 \uB9D0\uD574\uC694. \uC790\uB3D9\uCC28 \uACBD\uC8FC \uD2B8\uB799\uC740 \uD6E8\uC52C \uB098\uC911\uC5D0 \uC0AC\uB78C\uC774 \uB9CC\uB4E0 \uAC83\uC774\uB78D\uB2C8\uB2E4." },
  { id: "q-joseph", question: "\uC694\uC149\uC740 \uC5B4\uB824\uC6B4 \uC21C\uAC04\uC5D0\uB3C4 \uB204\uAD6C\uC640 \uD568\uAED8\uD588\uB098\uC694?", options: ["\uD558\uB098\uB2D8", "\uC544\uBB34\uB3C4 \uC5C6\uC774 \uD63C\uC790", "\uACE8\uB9AC\uC557", "\uBC14\uB2E4 \uAD34\uBB3C"], answer: 0, explanation: "\uD558\uB098\uB2D8\uC740 \uC694\uC149\uC774 \uC5B4\uB824\uC6B4 \uC77C\uC744 \uB9CC\uB0A0 \uB54C\uB3C4 \uD568\uAED8\uD558\uC168\uC5B4\uC694." },
  { id: "q-easter", question: "\uC608\uC218\uB2D8\uC740 \uC2ED\uC790\uAC00\uC5D0\uC11C \uC774\uAE30\uC2DC\uACE0 \uBA87 \uC77C \uB9CC\uC5D0 \uB2E4\uC2DC \uC0B4\uC544\uB098\uC168\uB098\uC694?", options: ["\uC0BC\uC77C \uB9CC\uC5D0", "\uC77C\uC8FC\uC77C \uB4A4", "\uD55C \uB2EC \uB4A4", "\uBC14\uB85C \uB2E4\uC74C \uB0A0"], answer: 0, explanation: "\uC608\uC218\uB2D8\uC740 \uBD80\uD65C\uD558\uC154\uC11C \uC6B0\uB9AC\uC5D0\uAC8C \uC601\uC6D0\uD55C \uC18C\uB9DD\uC744 \uC8FC\uC168\uC5B4\uC694." },
  { id: "q-thanksgiving", question: "\uD558\uB098\uB2D8\uC758 \uC740\uD61C\uC5D0 \uAC10\uC0AC\uB4DC\uB9AC\uBA70 \uC5F4\uB9E4\uB97C \uB098\uB204\uB294 \uC808\uAE30\uB294 \uBB34\uC5C7\uC778\uAC00\uC694?", options: ["\uCD94\uC218\uAC10\uC0AC\uC808", "\uC5EC\uB984\uBC29\uD559", "\uC6B4\uB3D9\uD68C", "\uC0C8\uD574 \uCCAB\uB0A0"], answer: 0, explanation: "\uD55C \uD574 \uB3D9\uC548 \uBCA0\uD480\uC5B4\uC8FC\uC2E0 \uC740\uD61C\uC5D0 \uAC10\uC0AC\uD558\uB294 \uCD94\uC218\uAC10\uC0AC\uC808\uC774\uC5D0\uC694." }
];
var CHILD_SAFE_SYSTEM_PROMPT = `\uB108\uB294 '\uC131\uACBD \uCE5C\uAD6C'\uB77C\uB294 \uC774\uB984\uC758 \uB530\uB73B\uD55C \uC5B4\uB9B0\uC774 \uC131\uACBD \uC548\uB0B4\uC790\uC57C. \uBAA8\uB4E0 \uB2F5\uBCC0\uC740 \uBC18\uB4DC\uC2DC \uD55C\uAD6D\uC5B4\uB85C \uC791\uC131\uD574.

\uB2F5\uBCC0 \uADDC\uCE59:
1. \uCD08\uB4F1\uD559\uC0DD\uB3C4 \uC774\uD574\uD560 \uC218 \uC788\uB294 \uC9E7\uACE0 \uC26C\uC6B4 \uBB38\uC7A5\uACFC \uAD6C\uCCB4\uC801\uC778 \uC608\uC2DC\uB97C \uC0AC\uC6A9\uD574.
2. \uBA3C\uC800 \uC544\uC774\uC758 \uB9C8\uC74C\uC744 \uACF5\uAC10\uD574 \uC8FC\uACE0, \uADF8\uB2E4\uC74C \uC131\uACBD \uB0B4\uC6A9\uACFC \uC758\uBBF8\uB97C \uC124\uBA85\uD574.
3. \uAE30\uC068, \uB180\uB77C\uC6C0, \uC704\uB85C, \uACA9\uB824\uAC00 \uB290\uAEF4\uC9C0\uB294 \uB530\uB73B\uD55C \uAC10\uC815 \uD45C\uD604\uC744 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC0AC\uC6A9\uD574. \uB2E4\uB9CC \uACFC\uC7A5\uD558\uAC70\uB098 \uC544\uC774\uB97C \uC555\uBC15\uD558\uC9C0 \uB9C8.
4. \uC131\uACBD \uAD6C\uC808\uC774\uB098 \uC774\uC57C\uAE30\uB97C \uC124\uBA85\uD560 \uB54C\uB294 \uBCF8\uBB38\uC5D0 \uC5C6\uB294 \uC0AC\uC2E4\uC744 \uD655\uC815\uC801\uC73C\uB85C \uB9CC\uB4E4\uC9C0 \uB9D0\uACE0, \uD544\uC694\uD55C \uACBD\uC6B0 '\uC131\uACBD\uC5D0\uB294 \uC774\uB807\uAC8C \uAE30\uB85D\uB418\uC5B4 \uC788\uC5B4\uC694'\uB77C\uACE0 \uB9D0\uD574.
5. \uD3ED\uB825\xB7\uC8FD\uC74C\xB7\uB450\uB824\uC6B4 \uB0B4\uC6A9\uC740 \uC790\uADF9\uC801\uC73C\uB85C \uBB18\uC0AC\uD558\uC9C0 \uB9D0\uACE0 \uC544\uC774\uC5D0\uAC8C \uC548\uC804\uD55C \uC5B8\uC5B4\uB85C \uC9E7\uAC8C \uC124\uBA85\uD574.
6. \uAC1C\uC778 \uC815\uBCF4, \uC704\uD5D8\uD55C \uD589\uB3D9, \uC131\uC778 \uC8FC\uC81C, \uC758\uB8CC\xB7\uBC95\uB960\xB7\uC704\uAE30 \uC0C1\uB2F4\uC740 \uB2F5\uD558\uC9C0 \uB9D0\uACE0 \uBBFF\uC744 \uC218 \uC788\uB294 \uBCF4\uD638\uC790\uB098 \uC804\uBB38\uAC00\uC5D0\uAC8C \uD568\uAED8 \uC774\uC57C\uAE30\uD558\uB77C\uACE0 \uC548\uB0B4\uD574.
7. \uD558\uB098\uB2D8\uACFC \uC608\uC218\uB2D8\uC5D0 \uAD00\uD55C \uC9C8\uBB38\uC5D0\uB294 \uC874\uC911\uACFC \uC0AC\uB791\uC758 \uD0DC\uB3C4\uB97C \uC720\uC9C0\uD558\uB418, \uC544\uC774\uC758 \uAC10\uC815\uACFC \uC9C8\uBB38\uC744 \uD2C0\uB838\uB2E4\uACE0 \uAFB8\uC9D6\uC9C0 \uB9C8.
8. \uB2F5\uBCC0\uC740 2~4\uAC1C\uC758 \uC9E7\uC740 \uBB38\uB2E8, \uCD1D 180\uC790 \uC548\uD30E\uC73C\uB85C \uB9C8\uBB34\uB9AC\uD574. \uB9C8\uC9C0\uB9C9\uC5D0 \uC544\uC774\uAC00 \uC0DD\uAC01\uD574 \uBCFC \uC218 \uC788\uB294 \uC791\uC740 \uC9C8\uBB38\uC744 \uD558\uB098 \uB367\uBD99\uC5EC.`;
function buildBibleSystemPrompt(context) {
  return `${CHILD_SAFE_SYSTEM_PROMPT}${context ? `

\uD604\uC7AC \uCC38\uACE0\uD560 \uC774\uC57C\uAE30:
${context}` : ""}`;
}
function getSafeFallbackAnswer(question) {
  if (/무섭|무서|죽고|죽음|아파|괴로|위험/.test(question)) {
    return "\uADF8 \uC9C8\uBB38\uC744 \uD558\uBA70 \uB9C8\uC74C\uC774 \uC870\uAE08 \uBB34\uC11C\uC6E0\uC744 \uC218\uB3C4 \uC788\uACA0\uAD6C\uB098. \uAD1C\uCC2E\uC544, \uD63C\uC790 \uACE0\uBBFC\uD558\uC9C0 \uC54A\uC544\uB3C4 \uB3FC. \uC131\uACBD\uC740 \uD558\uB098\uB2D8\uC774 \uD798\uB4E0 \uB9C8\uC74C\uC744 \uC678\uBA74\uD558\uC9C0 \uC54A\uC73C\uC2DC\uACE0 \uC6B0\uB9AC \uACC1\uC5D0 \uD568\uAED8\uD558\uC2E0\uB2E4\uACE0 \uC54C\uB824 \uC918. \uC9C0\uAE08 \uB9C8\uC74C\uC774 \uB9CE\uC774 \uD798\uB4E4\uB2E4\uBA74 \uBCF4\uD638\uC790, \uBD80\uBAA8\uB2D8\uC774\uB098 \uC120\uC0DD\uB2D8\uC5D0\uAC8C \uAF2D \uD568\uAED8 \uC774\uC57C\uAE30\uD574 \uBCF4\uC790. \uC624\uB298 \uAC00\uC7A5 \uB4E3\uACE0 \uC2F6\uC740 \uC704\uB85C\uB294 \uBB34\uC5C7\uC77C\uAE4C?";
  }
  return "\uC815\uB9D0 \uB530\uB73B\uD558\uACE0 \uBA4B\uC9C4 \uC9C8\uBB38\uC774\uC57C! \uC131\uACBD\uC740 \uD558\uB098\uB2D8\uC774 \uC6B0\uB9AC\uB97C \uC0AC\uB791\uD558\uC2DC\uACE0, \uC5B4\uB824\uC6B4 \uC21C\uAC04\uC5D0\uB3C4 \uD568\uAED8\uD558\uC2E0\uB2E4\uACE0 \uC54C\uB824 \uC918. \uC774 \uC774\uC57C\uAE30\uB97C \uCC9C\uCC9C\uD788 \uC0B4\uD3B4\uBCF4\uBA74\uC11C \uC6B0\uB9AC \uC0DD\uD65C\uC5D0\uC11C \uC0AC\uB791\uACFC \uC6A9\uAE30\uB97C \uC5B4\uB5BB\uAC8C \uC2E4\uCC9C\uD560\uC9C0 \uC0DD\uAC01\uD574 \uBCF4\uC790. \uC624\uB298 \uB124 \uB9C8\uC74C\uC5D0 \uAC00\uC7A5 \uC640\uB2FF\uB294 \uBD80\uBD84\uC740 \uBB34\uC5C7\uC774\uC5C8\uC744\uAE4C?";
}
function getStoryById(id) {
  return BIBLE_STORIES.find((story) => story.id === id) ?? BIBLE_STORIES[0];
}
var BIBLE_TREASURE_CARDS = [
  { cardId: "card-love-1", title: "\uC0AC\uB791\uC758 \uC120\uBB3C", verse: "\uC694\uD55C\uBCF5\uC74C 3:16", content: "\uD558\uB098\uB2D8\uC774 \uC138\uC0C1\uC744 \uC774\uCC98\uB7FC \uC0AC\uB791\uD558\uC0AC \uB3C5\uC0DD\uC790\uB97C \uC8FC\uC168\uC73C\uB2C8", iconEmoji: "\u{1F496}" },
  { cardId: "card-courage-1", title: "\uB450\uB824\uC6C0 \uC5C6\uB294 \uC6A9\uAE30", verse: "\uC5EC\uD638\uC218\uC544 1:9", content: "\uAC15\uD558\uACE0 \uB2F4\uB300\uD558\uB77C \uB450\uB824\uC6CC\uD558\uC9C0 \uB9D0\uBA70 \uB180\uB77C\uC9C0 \uB9D0\uB77C", iconEmoji: "\u{1F6E1}\uFE0F" },
  { cardId: "card-wisdom-1", title: "\uBE5B\uB098\uB294 \uC9C0\uD61C", verse: "\uC7A0\uC5B8 3:5", content: "\uB108\uB294 \uB9C8\uC74C\uC744 \uB2E4\uD558\uC5EC \uC5EC\uD638\uC640\uB97C \uC2E0\uB8B0\uD558\uACE0 \uB124 \uBA85\uCCA0\uC744 \uC758\uC9C0\uD558\uC9C0 \uB9D0\uB77C", iconEmoji: "\u{1F31F}" },
  { cardId: "card-peace-1", title: "\uAE30\uC068\uACFC \uD3C9\uC548", verse: "\uBE4C\uB9BD\uBCF4\uC11C 4:4", content: "\uC8FC \uC548\uC5D0\uC11C \uD56D\uC0C1 \uAE30\uBED0\uD558\uB77C \uB0B4\uAC00 \uB2E4\uC2DC \uB9D0\uD558\uB178\uB2C8 \uAE30\uBED0\uD558\uB77C", iconEmoji: "\u{1F54A}\uFE0F" },
  { cardId: "card-shepherd-1", title: "\uB4E0\uB4E0\uD55C \uBAA9\uC790", verse: "\uC2DC\uD3B8 23:1", content: "\uC5EC\uD638\uC640\uB294 \uB098\uC758 \uBAA9\uC790\uC2DC\uB2C8 \uB0B4\uAC8C \uBD80\uC871\uD568\uC774 \uC5C6\uC73C\uB9AC\uB85C\uB2E4", iconEmoji: "\u{1F33F}" }
];

// server/routers.ts
var model = "gemini-flash-latest";
function readLLMText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.filter((item) => Boolean(item && typeof item === "object" && "text" in item && typeof item.text === "string")).map((item) => item.text).join("\n");
  }
  return "";
}
function randomQuiz() {
  return QUIZ_BANK[Math.floor(Math.random() * QUIZ_BANK.length)] ?? QUIZ_BANK[0];
}
function stableActivityKey(value) {
  return createHash2("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 18);
}
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  content: router({
    stories: publicProcedure.query(() => BIBLE_STORIES),
    story: publicProcedure.input(z3.object({ id: z3.string() })).query(({ input }) => getStoryById(input.id)),
    quiz: publicProcedure.query(() => randomQuiz()),
    score: publicProcedure.query(async ({ ctx }) => ctx.user ? getUserScore(ctx.user.id) : 0),
    treasureCards: publicProcedure.query(async ({ ctx }) => ctx.user ? getUserTreasureCards(ctx.user.id) : []),
    collectCard: publicProcedure.input(
      z3.object({
        cardId: z3.string(),
        title: z3.string(),
        verse: z3.string(),
        content: z3.string(),
        category: z3.enum(["story", "quiz"]),
        iconEmoji: z3.string(),
        points: z3.number().int().min(0).max(100).default(0)
      })
    ).mutation(async ({ ctx, input }) => {
      if (!ctx.user) return { success: false, collected: false, score: 0, saved: false, growth: null };
      const { points, ...card } = input;
      const result = await claimUserTreasureCardReward(
        {
          userId: ctx.user.id,
          ...card
        },
        points
      );
      const growth = input.category === "story" ? await claimAutomaticGrowthActivity(ctx.user.id, "scripture_read", `story-${input.cardId}`, `${input.title} \uB9D0\uC500 \uC77D\uAE30`, 3) : null;
      return { success: true, ...result, growth };
    }),
    drawDailyCard: publicProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user) return { success: false, card: null, alreadyDrawn: false };
      const alreadyDrawn = await hasDrawnToday(ctx.user.id);
      const cardDef = BIBLE_TREASURE_CARDS[Math.floor(Math.random() * BIBLE_TREASURE_CARDS.length)] ?? BIBLE_TREASURE_CARDS[0];
      const collected = await addUserTreasureCard({
        userId: ctx.user.id,
        cardId: cardDef.cardId,
        title: cardDef.title,
        verse: cardDef.verse,
        content: cardDef.content,
        category: "story",
        iconEmoji: cardDef.iconEmoji
      });
      const currentScore = await getUserScore(ctx.user.id);
      await updateUserScore(ctx.user.id, currentScore + 20);
      return { success: true, card: cardDef, collected, alreadyDrawn };
    }),
    prayerNotes: publicProcedure.query(async ({ ctx }) => ctx.user ? getUserPrayerNotes(ctx.user.id) : []),
    addPrayerNote: publicProcedure.input(z3.object({ noteText: z3.string().min(1).max(500), verseRef: z3.string().max(128).optional() })).mutation(async ({ ctx, input }) => {
      if (!ctx.user) return { success: false, growth: null };
      const success = await addUserPrayerNote({
        userId: ctx.user.id,
        noteText: input.noteText,
        verseRef: input.verseRef ?? null
      });
      const growth = success ? await claimAutomaticGrowthActivity(ctx.user.id, "prayer", "daily-prayer", "\uAE30\uB3C4 \uB178\uD2B8\uC640 \uD568\uAED8 \uAE30\uB3C4\uD558\uAE30", 1) : null;
      return { success, growth };
    })
  }),
  growth: growthRouter,
  ai: router({
    ask: publicProcedure.input(z3.object({ question: z3.string().min(1).max(600), storyId: z3.string().optional() })).mutation(async ({ ctx, input }) => {
      const story = input.storyId ? getStoryById(input.storyId) : void 0;
      const context = story ? `${story.title}: ${story.body}
\uD575\uC2EC: ${story.lesson}
\uAD6C\uC808: ${story.verse}` : void 0;
      let answer = "";
      try {
        const response = await invokeLLM({
          model,
          thinking: { budget_tokens: 512 },
          messages: [
            { role: "system", content: buildBibleSystemPrompt(context) },
            { role: "user", content: input.question }
          ]
        });
        answer = readLLMText(response.choices?.[0]?.message?.content);
      } catch (error) {
        console.warn("[Bible Agent] Gemini request failed; using safe fallback", error);
      }
      if (!answer.trim()) answer = getSafeFallbackAnswer(input.question);
      let growth = null;
      if (ctx.user) {
        await saveChatHistory({ userId: ctx.user.id, userMessage: input.question, agentResponse: answer });
        growth = await claimAutomaticGrowthActivity(
          ctx.user.id,
          "bible_conversation",
          `chat-${stableActivityKey(input.question)}`,
          "\uC131\uACBD \uCE5C\uAD6C\uC640 \uB9D0\uC500 \uB300\uD654",
          3
        );
      }
      return { answer, model, saved: Boolean(ctx.user), growth };
    }),
    suggestPrayerVerse: publicProcedure.input(z3.object({ prayerText: z3.string().min(1).max(300) })).mutation(async ({ input }) => {
      try {
        const response = await invokeLLM({
          model,
          messages: [
            { role: "system", content: "\uB108\uB294 \uC5B4\uB9B0\uC774 \uC131\uACBD \uCE5C\uAD6C\uC57C. \uC544\uC774\uAC00 \uC801\uC740 \uAE30\uB3C4 \uB0B4\uC6A9\uC744 \uC77D\uACE0 \uADF8 \uB9C8\uC74C\uC5D0 \uAF2D \uC5B4\uC6B8\uB9AC\uB294 \uC131\uACBD \uAD6C\uC808\uACFC \uB530\uB73B\uD55C \uC704\uB85C \uD55C\uB9C8\uB514\uB97C JSON\uC73C\uB85C \uCD94\uCC9C\uD574 \uC918." },
            { role: "user", content: `\uAE30\uB3C4 \uB0B4\uC6A9: "${input.prayerText}"` }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "prayer_suggestion",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  verseRef: { type: "string" },
                  verseText: { type: "string" },
                  encouragement: { type: "string" }
                },
                required: ["verseRef", "verseText", "encouragement"],
                additionalProperties: false
              }
            }
          }
        });
        const raw = readLLMText(response.choices?.[0]?.message?.content);
        if (raw) return JSON.parse(raw);
      } catch {
      }
      return {
        verseRef: "\uC2DC\uD3B8 23:1",
        verseText: "\uC5EC\uD638\uC640\uB294 \uB098\uC758 \uBAA9\uC790\uC2DC\uB2C8 \uB0B4\uAC8C \uBD80\uC871\uD568\uC774 \uC5C6\uC73C\uB9AC\uB85C\uB2E4",
        encouragement: "\uD558\uB098\uB2D8\uC740 \uC5B8\uC81C\uB098 \uB124 \uACC1\uC5D0\uC11C \uB530\uB73B\uD558\uAC8C \uC548\uC544\uC8FC\uC2E0\uB2E8\uB2E4. \uD798\uB0B4\uB834!"
      };
    }),
    history: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return [];
      return getChatHistory(ctx.user.id, 30);
    }),
    orchestrate: publicProcedure.input(z3.object({ focus: z3.string().min(1).max(240).default("\uC544\uC774\uB4E4\uC744 \uC704\uD55C \uC131\uACBD \uCF58\uD150\uCE20") })).mutation(async ({ input }) => {
      try {
        const response = await invokeLLM({
          model,
          thinking: { budget_tokens: 768 },
          messages: [
            {
              role: "system",
              content: "\uB108\uB294 \uC5B4\uB9B0\uC774 \uC131\uACBD \uC571\uC758 \uCF58\uD150\uCE20 \uC624\uCF00\uC2A4\uD2B8\uB808\uC774\uD130\uC57C. \uB530\uB73B\uD558\uACE0 \uC548\uC804\uD55C \uD55C\uAD6D\uC5B4\uB85C \uC774\uC57C\uAE30 1\uAC1C\uC640 \uD034\uC988 1\uAC1C\uB97C \uC124\uACC4\uD574. \uC131\uACBD \uBCF8\uBB38\uC5D0 \uC5C6\uB294 \uB0B4\uC6A9\uC744 \uC0AC\uC2E4\uCC98\uB7FC \uB9CC\uB4E4\uC9C0 \uB9D0\uACE0, \uC544\uC774\uAC00 \uC774\uD574\uD560 \uC218 \uC788\uAC8C \uAC04\uB2E8\uD788 \uC368."
            },
            { role: "user", content: `${input.focus}\uC5D0 \uB9DE\uB294 \uC624\uB298\uC758 \uC791\uC740 \uCF58\uD150\uCE20\uB97C \uB9CC\uB4E4\uC5B4 \uC918.` }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "bible_friend_content",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  storyTitle: { type: "string" },
                  storyHook: { type: "string" },
                  storyLesson: { type: "string" },
                  quizQuestion: { type: "string" },
                  quizAnswer: { type: "string" },
                  encouragement: { type: "string" }
                },
                required: ["storyTitle", "storyHook", "storyLesson", "quizQuestion", "quizAnswer", "encouragement"],
                additionalProperties: false
              }
            }
          }
        });
        const raw = readLLMText(response.choices?.[0]?.message?.content);
        if (raw) return JSON.parse(raw);
      } catch (error) {
        console.warn("[Bible Orchestrator] Gemini request failed; using fallback content", error);
      }
      const story = BIBLE_STORIES[Math.floor(Math.random() * BIBLE_STORIES.length)] ?? BIBLE_STORIES[0];
      const quiz = randomQuiz();
      return {
        storyTitle: story.title,
        storyHook: story.body.split(".")[0] + ".",
        storyLesson: story.lesson,
        quizQuestion: quiz.question,
        quizAnswer: quiz.options[quiz.answer],
        encouragement: "\uC624\uB298\uB3C4 \uC544\uC8FC \uBA4B\uC9C4 \uC9C8\uBB38\uC774\uC57C! \uCC9C\uCC9C\uD788 \uC0DD\uAC01\uD558\uACE0, \uC0AC\uB791\uC744 \uD55C \uAC78\uC74C \uC2E4\uCC9C\uD574 \uBCF4\uC790."
      };
    })
  }),
  game: router({
    addScore: publicProcedure.input(z3.object({ points: z3.number().int().min(0).max(100) })).mutation(async ({ ctx, input }) => {
      if (!ctx.user) return { score: input.points, saved: false };
      const current = await getUserScore(ctx.user.id);
      const score = current + input.points;
      await updateUserScore(ctx.user.id, score);
      return { score, saved: true };
    })
  }),
  voice: router({
    transcribe: publicProcedure.input(z3.object({
      audioDataUrl: z3.string().max(22e6),
      language: z3.string().max(8).default("ko")
    })).mutation(async ({ input }) => transcribeAudio({
      audioUrl: input.audioDataUrl,
      language: input.language,
      prompt: "\uC5B4\uB9B0\uC774\uAC00 \uD55C\uAD6D\uC5B4\uB85C \uB9D0\uD55C \uC131\uACBD \uC9C8\uBB38\uC744 \uC815\uD655\uD558\uACE0 \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uBB38\uC7A5\uC73C\uB85C \uBC1B\uC544 \uC801\uC5B4 \uC8FC\uC138\uC694."
    }))
  }),
  tts: router({
    profiles: publicProcedure.query(() => getVoiceProfiles()),
    synthesize: publicProcedure.input(
      z3.object({
        text: z3.string().min(1).max(900),
        speaker: z3.enum(["NARRATOR", "JESUS", "DAVID", "PETER", "MARY", "CHILD_FRIEND", "GENERAL_MALE", "GENERAL_FEMALE"]).optional(),
        emotion: z3.string().max(80).optional(),
        style: z3.string().max(240).optional(),
        speed: z3.number().min(0.8).max(1.2).optional(),
        context: z3.string().max(240).optional(),
        mode: z3.enum(["sft", "zero_shot", "cross_lingual", "instruct"]).optional(),
        instructText: z3.string().max(500).optional()
      })
    ).mutation(async ({ input }) => synthesizeSpeech(input))
  })
});

// api/[...path].ts
var app = express();
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ limit: "4mb", extended: true }));
app.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true, runtime: "vercel-express" });
});
app.get("/api/voice-health", (_req, res) => {
  res.status(200).json({
    ok: true,
    geminiConfigured: Boolean(ENV.geminiApiKey),
    qwen3Configured: Boolean(process.env.QWEN3_TTS_API_URL),
    cosyVoiceConfigured: Boolean(process.env.COSYVOICE_API_URL),
    ttsMode: process.env.BIBLE_FRIEND_TTS_MODE?.trim() || "gemini_only",
    providerChain: (process.env.BIBLE_FRIEND_TTS_MODE?.trim() || "gemini_only") === "fallback_chain" ? ["gemini", "qwen3", "cosyvoice"] : ["gemini"],
    model: ENV.geminiTtsModel,
    timeoutMs: ENV.geminiTtsTimeoutMs,
    hardTimeoutMs: ENV.geminiTtsHardTimeoutMs,
    serverAudioPreferred: true,
    browserFallbackAvailable: false
  });
});
app.get("/api/voice-probe", async (_req, res) => {
  const startedAt = Date.now();
  const result = await synthesizeSpeech({
    text: "\uC548\uB155! \uB098\uB294 \uC131\uACBD \uCE5C\uAD6C\uC57C. \uC624\uB298 \uB9C8\uC74C\uC5D0 \uB5A0\uC624\uB974\uB294 \uC9C8\uBB38\uC774 \uC788\uB2C8? \u{1F308}",
    speaker: "CHILD_FRIEND",
    emotion: "\uBC1D\uACE0 \uCE5C\uADFC\uD55C \uBAA9\uC18C\uB9AC"
  });
  const summary = result.success ? {
    success: true,
    provider: result.provider,
    model: result.model,
    voice: result.voice,
    latencyMs: result.latencyMs,
    cached: result.cached,
    audioBytesApprox: Math.floor(result.audioBase64.length * 3 / 4)
  } : {
    success: false,
    provider: result.provider,
    errorCode: result.errorCode,
    error: result.error
  };
  res.status(200).json({
    ok: result.success,
    totalMs: Date.now() - startedAt,
    timeoutMs: ENV.geminiTtsTimeoutMs,
    hardTimeoutMs: ENV.geminiTtsHardTimeoutMs,
    result: summary
  });
});
registerComicAssetProxy(app);
registerStorageProxy(app);
registerOAuthRoutes(app);
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);
function restoreRewrittenPath(req) {
  const rawPath = req.query?.path;
  const routePath = Array.isArray(rawPath) ? rawPath.map(String).join("/") : typeof rawPath === "string" ? rawPath : void 0;
  if (!routePath) return;
  const incoming = new URL(req.url ?? "/", "http://localhost");
  incoming.searchParams.delete("path");
  const query = incoming.searchParams.toString();
  req.url = `/api/${routePath}${query ? `?${query}` : ""}`;
}
function handler(req, res) {
  restoreRewrittenPath(req);
  return app(req, res);
}
export {
  handler as default
};
