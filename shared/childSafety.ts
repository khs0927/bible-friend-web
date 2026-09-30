// Child-safety screening for the AI friend. Runs on the server before and
// after every model call. Same rules as bible-friend-android (packages/core
// safety.ts and the Rust bf-core crate); keep the three in sync.

export type SafetyCategory = "ok" | "personal_info" | "self_harm" | "abuse";

export interface ScreenResult {
  category: SafetyCategory;
  /** A canned, pre-approved reply. When present the model must not be called. */
  cannedReply?: string;
}

const PERSONAL_INFO_PATTERNS: RegExp[] = [
  /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/, // mobile numbers
  /\d{6}[-\s]?[1-4]\d{6}/, // resident registration numbers
  /[\w.+-]+@[\w-]+\.[\w.]+/, // e-mail addresses
  /\d+\s*동\s*\d+\s*호/, // apartment unit
];

const SELF_HARM = /죽고\s*싶|자살|자해|사라지고\s*싶|살기\s*싫|없어지고\s*싶/;
const ABUSE = /때려|때리|맞았|맞아|학대|괴롭혀|괴롭힘|만지지\s*말|비밀로\s*하라/;
const ABUSE_ACTOR = /누가|아빠|엄마|선생님|형|오빠|언니|누나|어른|친구/;

export const SAFE_REPLIES = {
  personal_info:
    "알려줘서 고마워! 그런데 전화번호나 주소, 학교 같은 소중한 개인 정보는 성경 친구에게도 말하지 않는 게 안전해. 그 대신 오늘 궁금한 성경 이야기를 들려줄래? 😊",
  self_harm:
    "지금 마음이 많이 힘들구나. 그렇게 느끼는 너는 정말 소중한 사람이야. 이 이야기는 꼭 엄마, 아빠나 믿을 수 있는 어른에게 지금 바로 말해 주면 좋겠어. 어른에게 말하기 어렵다면 청소년상담전화 1388에 전화할 수 있어. 하나님은 힘든 마음을 가진 너를 꼭 안아 주셔. 💛",
  abuse:
    "그런 일이 있었다면 너의 잘못이 아니야. 꼭 믿을 수 있는 어른(부모님, 선생님)에게 말해 줘. 위험하다고 느껴지면 112나 아동보호 상담 1391에 도움을 요청할 수 있어. 하나님은 언제나 너를 지켜 주고 싶어 하셔. 💛",
} as const;

export function screenChildInput(text: string): ScreenResult {
  const normalized = text.normalize("NFC");
  if (SELF_HARM.test(normalized)) return { category: "self_harm", cannedReply: SAFE_REPLIES.self_harm };
  if (ABUSE.test(normalized) && ABUSE_ACTOR.test(normalized)) return { category: "abuse", cannedReply: SAFE_REPLIES.abuse };
  if (PERSONAL_INFO_PATTERNS.some(re => re.test(normalized))) {
    return { category: "personal_info", cannedReply: SAFE_REPLIES.personal_info };
  }
  return { category: "ok" };
}

const MAX_REPLY_CHARS = 700;

/** Strips links/markdown noise and bounds the length of a model reply. */
export function sanitizeReply(reply: string): string {
  let text = reply
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const chars = Array.from(text);
  if (chars.length > MAX_REPLY_CHARS) {
    const cut = chars.slice(0, MAX_REPLY_CHARS);
    let lastStop = -1;
    cut.forEach((c, i) => {
      if (".!?요".includes(c)) lastStop = i;
    });
    text = (lastStop > MAX_REPLY_CHARS / 2 ? cut.slice(0, lastStop + 1) : cut).join("");
  }
  return text;
}
