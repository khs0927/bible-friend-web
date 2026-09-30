// Local-first Records: recent conversations, favorites and prayers live on the
// device (localStorage), so they work without an account on the web and in the
// Android app. Reducers are pure; the store wraps them with persistence and a
// subscription for useSyncExternalStore.

import { useSyncExternalStore } from "react";

export type RecentConversation = { id: string; question: string; answer: string; verseId: string; at: string };
export type FavoriteItem = {
  id: string;
  kind: "answer" | "verse";
  title: string;
  body: string;
  verseId?: string;
  at: string;
};
export type PrayerStatus = "기도 중" | "응답됨";
export type PrayerRecord = {
  id: string;
  title: string;
  gratitude?: string;
  topic?: string;
  body?: string;
  category: string;
  status: PrayerStatus;
  at: string;
  answeredAt?: string;
};
export type RecordsState = {
  version: 1;
  recents: RecentConversation[];
  favorites: FavoriteItem[];
  prayers: PrayerRecord[];
};

export const MAX_RECENTS = 50;
export const EMPTY_RECORDS: RecordsState = { version: 1, recents: [], favorites: [], prayers: [] };

function newId(prefix: string, at: string) {
  return `${prefix}-${Date.parse(at).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function addRecent(state: RecordsState, entry: Omit<RecentConversation, "id">): RecordsState {
  const recent = { ...entry, id: newId("r", entry.at) };
  return { ...state, recents: [recent, ...state.recents].slice(0, MAX_RECENTS) };
}

/** Favorites are keyed by content so saving the same thing twice is a no-op. */
export function favoriteKey(item: Pick<FavoriteItem, "kind" | "body" | "verseId">) {
  return item.kind === "verse" ? `verse:${item.verseId}` : `answer:${item.body}`;
}

export function isFavorite(state: RecordsState, item: Pick<FavoriteItem, "kind" | "body" | "verseId">) {
  const key = favoriteKey(item);
  return state.favorites.some(f => favoriteKey(f) === key);
}

export function toggleFavorite(state: RecordsState, item: Omit<FavoriteItem, "id">): RecordsState {
  const key = favoriteKey(item);
  if (state.favorites.some(f => favoriteKey(f) === key)) {
    return { ...state, favorites: state.favorites.filter(f => favoriteKey(f) !== key) };
  }
  return { ...state, favorites: [{ ...item, id: newId("f", item.at) }, ...state.favorites] };
}

export function removeFavorites(state: RecordsState, ids: string[]): RecordsState {
  return { ...state, favorites: state.favorites.filter(f => !ids.includes(f.id)) };
}

export function addPrayer(state: RecordsState, prayer: Omit<PrayerRecord, "id" | "status">): RecordsState {
  const record: PrayerRecord = { ...prayer, id: newId("p", prayer.at), status: "기도 중" };
  return { ...state, prayers: [record, ...state.prayers] };
}

export function setPrayerStatus(state: RecordsState, id: string, status: PrayerStatus, at: string): RecordsState {
  return {
    ...state,
    prayers: state.prayers.map(p =>
      p.id === id ? { ...p, status, answeredAt: status === "응답됨" ? at : undefined } : p,
    ),
  };
}

export function deletePrayer(state: RecordsState, id: string): RecordsState {
  return { ...state, prayers: state.prayers.filter(p => p.id !== id) };
}

export function clearRecents(state: RecordsState): RecordsState {
  return { ...state, recents: [] };
}

/** "오늘 09:30", "어제 20:15", or "5월 18일" relative to `now`. */
export function formatRecordTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (diff === 0) return `오늘 ${hm}`;
  if (diff === 1) return `어제 ${hm}`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = "bible-friend-records-v1";
const LEGACY_PRAYERS_KEY = "bible-friend-record-prayers";
// Sample prayers the old Records screen seeded; don't migrate them as real ones.
const LEGACY_SEED_IDS = new Set([1, 2, 3]);

type LegacyPrayer = { id: number; title: string; status?: string; gratitude?: string; topic?: string; body?: string; category?: string };

export function parseRecords(raw: string | null, legacyPrayersRaw: string | null, now: string): RecordsState {
  try {
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RecordsState>;
      if (parsed?.version === 1) {
        return {
          version: 1,
          recents: Array.isArray(parsed.recents) ? parsed.recents : [],
          favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
          prayers: Array.isArray(parsed.prayers) ? parsed.prayers : [],
        };
      }
    }
    if (legacyPrayersRaw) {
      const legacy = JSON.parse(legacyPrayersRaw) as LegacyPrayer[];
      const prayers: PrayerRecord[] = (Array.isArray(legacy) ? legacy : [])
        .filter(p => !LEGACY_SEED_IDS.has(p.id))
        .map(p => ({
          id: `p-legacy-${p.id}`,
          title: p.title,
          gratitude: p.gratitude,
          topic: p.topic,
          body: p.body,
          category: p.category ?? "감사",
          status: p.status === "응답됨" ? "응답됨" : "기도 중",
          at: Number.isFinite(p.id) && p.id > 1e12 ? new Date(p.id).toISOString() : now,
        }));
      return { ...EMPTY_RECORDS, prayers };
    }
  } catch {
    // Corrupt storage: start fresh rather than breaking the app.
  }
  return EMPTY_RECORDS;
}

function safeGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

let current: RecordsState | null = null;
const listeners = new Set<() => void>();

export function getRecords(): RecordsState {
  current ??= parseRecords(safeGet(STORAGE_KEY), safeGet(LEGACY_PRAYERS_KEY), new Date().toISOString());
  return current;
}

export function updateRecords(update: (state: RecordsState) => RecordsState) {
  current = update(getRecords());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage full or unavailable; keep the in-memory state for this session.
  }
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    current = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useRecords(): RecordsState {
  return useSyncExternalStore(subscribe, getRecords, () => EMPTY_RECORDS);
}

export function nowIso() {
  return new Date().toISOString();
}
