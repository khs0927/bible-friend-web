import {
  ACTIVITY_REWARDS,
  INITIAL_GROWTH_PROFILE,
  activityMessage,
  applyDailyDecay,
  applyReward,
  upgradeEquipment,
  type EquipmentId,
  type GrowthActivityInput,
  type GrowthActivityResult,
  type GrowthProfile,
} from "@shared/growthDomain";

const STORAGE_KEY = "bible-friend:growth-local:v1";
const MAX_EVENT_KEYS = 240;

export interface LocalGrowthState {
  version: 1;
  profile: GrowthProfile;
  claimedEventKeys: string[];
  lastOpenedDay: string;
  lastNourishedDay: string | null;
  updatedAt: string;
}

function cloneInitialProfile(): GrowthProfile {
  return {
    ...INITIAL_GROWTH_PROFILE,
    equipmentTiers: { ...INITIAL_GROWTH_PROFILE.equipmentTiers },
    equipped: [...INITIAL_GROWTH_PROFILE.equipped],
    unlockedZones: [...INITIAL_GROWTH_PROFILE.unlockedZones],
  };
}

export function seoulDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year || 1970, Math.max(0, (month || 1) - 1), date || 1);
}

function daysBetween(from: string, to: string) {
  return Math.max(0, Math.round((parseDay(to) - parseDay(from)) / 86_400_000));
}

function baseState(today = seoulDayKey()): LocalGrowthState {
  return {
    version: 1,
    profile: cloneInitialProfile(),
    claimedEventKeys: [],
    lastOpenedDay: today,
    lastNourishedDay: null,
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeProfile(value: Partial<GrowthProfile> | undefined): GrowthProfile {
  const initial = cloneInitialProfile();
  if (!value) return initial;
  return {
    ...initial,
    ...value,
    equipmentTiers: { ...initial.equipmentTiers, ...(value.equipmentTiers ?? {}) },
    equipped: Array.isArray(value.equipped) ? value.equipped : [],
    unlockedZones: Array.isArray(value.unlockedZones) && value.unlockedZones.length ? value.unlockedZones : ["home"],
  };
}

export function readLocalGrowthState(): LocalGrowthState {
  const today = seoulDayKey();
  if (typeof window === "undefined") return baseState(today);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return baseState(today);
    const parsed = JSON.parse(raw) as Partial<LocalGrowthState>;
    const previousOpened = typeof parsed.lastOpenedDay === "string" ? parsed.lastOpenedDay : today;
    const missed = Math.max(0, daysBetween(previousOpened, today) - 1);
    const state: LocalGrowthState = {
      version: 1,
      profile: applyDailyDecay(sanitizeProfile(parsed.profile), missed),
      claimedEventKeys: Array.isArray(parsed.claimedEventKeys) ? parsed.claimedEventKeys.filter(item => typeof item === "string").slice(-MAX_EVENT_KEYS) : [],
      lastOpenedDay: today,
      lastNourishedDay: typeof parsed.lastNourishedDay === "string" ? parsed.lastNourishedDay : null,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
    if (previousOpened !== today) writeLocalGrowthState(state);
    return state;
  } catch {
    return baseState(today);
  }
}

export function writeLocalGrowthState(state: LocalGrowthState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
  window.dispatchEvent(new CustomEvent("bible-friend:growth-local-changed"));
}

function nextStreak(state: LocalGrowthState, today: string) {
  if (state.lastNourishedDay === today) return state.profile.streakDays;
  if (!state.lastNourishedDay) return 1;
  return daysBetween(state.lastNourishedDay, today) === 1 ? state.profile.streakDays + 1 : 1;
}

export function claimLocalGrowthActivity(state: LocalGrowthState, input: GrowthActivityInput): { state: LocalGrowthState; result: GrowthActivityResult } {
  const key = `${input.type}:${input.sourceId}`;
  if (state.claimedEventKeys.includes(key)) {
    return {
      state,
      result: { claimed: false, profile: state.profile, reward: {}, message: "이미 받은 성장 보상이에요. 다른 말씀과 믿음 행동을 이어가 볼까요?" },
    };
  }

  const reward = ACTIVITY_REWARDS[input.type];
  const today = seoulDayKey();
  let profile = applyReward(state.profile, reward);
  const nourishes = input.type === "scripture_read" || input.type === "verse_memorized" || input.type === "bible_conversation";
  if (nourishes) {
    profile = {
      ...profile,
      streakDays: nextStreak(state, today),
      lastNourishedAt: new Date().toISOString(),
    };
  }
  const nextState: LocalGrowthState = {
    ...state,
    profile,
    lastOpenedDay: today,
    lastNourishedDay: nourishes ? today : state.lastNourishedDay,
    claimedEventKeys: [...state.claimedEventKeys, key].slice(-MAX_EVENT_KEYS),
    updatedAt: new Date().toISOString(),
  };
  writeLocalGrowthState(nextState);
  return { state: nextState, result: { claimed: true, profile, reward, message: activityMessage(input.type) } };
}

export function upgradeLocalEquipment(state: LocalGrowthState, equipmentId: EquipmentId) {
  const profile = upgradeEquipment(state.profile, equipmentId);
  const changed = profile !== state.profile;
  if (!changed) return { state, changed: false };
  const nextState = { ...state, profile, updatedAt: new Date().toISOString() };
  writeLocalGrowthState(nextState);
  return { state: nextState, changed: true };
}

export function equipLocalEquipment(state: LocalGrowthState, equipmentId: EquipmentId, equipped: boolean) {
  if (state.profile.equipmentTiers[equipmentId] <= 0) return { state, changed: false };
  const current = state.profile.equipped;
  const nextEquipped = equipped ? Array.from(new Set([...current, equipmentId])) : current.filter(id => id !== equipmentId);
  const nextState = { ...state, profile: { ...state.profile, equipped: nextEquipped }, updatedAt: new Date().toISOString() };
  writeLocalGrowthState(nextState);
  return { state: nextState, changed: true };
}

function normalized(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

export function memorizationSimilarity(expected: string, spoken: string) {
  const a = normalized(expected);
  const b = normalized(spoken);
  if (!a || !b) return 0;
  const bigrams = (value: string) => {
    const map = new Map<string, number>();
    for (let index = 0; index < value.length - 1; index += 1) {
      const gram = value.slice(index, index + 2);
      map.set(gram, (map.get(gram) ?? 0) + 1);
    }
    return map;
  };
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const aa = bigrams(a);
  const bb = bigrams(b);
  let overlap = 0;
  aa.forEach((count, gram) => { overlap += Math.min(count, bb.get(gram) ?? 0); });
  return (2 * overlap) / (a.length - 1 + b.length - 1);
}

export function verifyLocalMemorization(state: LocalGrowthState, verseId: string, expected: string, spoken: string) {
  const similarity = memorizationSimilarity(expected, spoken);
  if (similarity < 0.72) {
    return { state, similarity, claimed: false, message: `조금만 더 해 볼까요? 말씀과 약 ${Math.round(similarity * 100)}% 비슷하게 들렸어요.` };
  }
  const claimed = claimLocalGrowthActivity(state, { type: "verse_memorized", sourceId: `memory:${seoulDayKey()}:${verseId}`, title: verseId });
  return { state: claimed.state, similarity, claimed: claimed.result.claimed, message: claimed.result.message };
}

export function resetLocalGrowthState() {
  const state = baseState();
  writeLocalGrowthState(state);
  return state;
}
