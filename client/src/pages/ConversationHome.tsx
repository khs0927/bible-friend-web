import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ConversationView = "home" | "chat" | "voice" | "answer" | "history";

const QUICK_QUESTIONS = [
  { icon: "❤️", label: "하나님은 나를 정말 사랑하시나요?" },
  { icon: "📖", label: "기도는 어떻게 하는 건가요?" },
  { icon: "⭐", label: "예수님은 왜 세상에 오셨나요?" },
  { icon: "🕯️", label: "용서하는 것이 왜 중요할까요?" },
];

const HISTORY_ITEMS = [
  {
    icon: "❤️",
    title: "하나님은 나를 사랑하시나요?",
    summary: "하나님은 당신을 지금 이 순간에도 변함없이 사랑하십니다.",
    date: "오늘 10:30",
    favorite: true,
  },
  {
    icon: "🙏",
    title: "기도는 왜 필요할까요?",
    summary: "기도는 하나님과 대화하는 시간이에요.",
    date: "어제 20:15",
    favorite: false,
  },
  {
    icon: "📕",
    title: "용서에 대해 배웠어요",
    summary: "용서는 다른 사람을 위한 선물이자 나 자신을 위한 자유예요.",
    date: "5월 18일",
    favorite: true,
  },
  {
    icon: "⭐",
    title: "예수님은 왜 오셨나요?",
    summary: "예수님은 우리를 구원하고 하나님의 사랑을 보여주셨어요.",
    date: "5월 15일",
    favorite: false,
  },
];

const NAV_ITEMS = [
  { id: "conversation", label: "대화", icon: "💬" },
  { id: "story", label: "스토리", icon: "📖" },
  { id: "growth", label: "성장", icon: "🌱" },
  { id: "record", label: "기록", icon: "📔" },
] as const;

export default function ConversationHome() {
  const askMutation = trpc.ai.ask.useMutation();
  const [view, setView] = useState<ConversationView>("home");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "안녕! 무엇이 궁금한지 말해줄래? 😊" },
  ]);

  const lastAssistantMessage = useMemo(
    () => messages.slice().reverse().find(message => message.role === "assistant")?.content ?? "",
    [messages],
  );

  const sendMessage = async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || askMutation.isPending) return;

    setView("chat");
    setDraft("");
    setMessages(current => [...current, { role: "user", content: question }]);

    try {
      const result = await askMutation.mutateAsync({ question });
      setMessages(current => [...current, { role: "assistant", content: result.answer }]);
    } catch {
      setMessages(current => [
        ...current,
        {
          role: "assistant",
          content: "잠시 연결이 원활하지 않아요. 조금 뒤에 다시 질문해 주세요.",
        },
      ]);
    }
  };

  const submitDraft = () => void sendMessage(draft);

  return (
    <div className="bf-conversation-app" data-design-source="figma-pending">
      <header className="bf-conversation-header">
        <button type="button" className="bf-brand-button" onClick={() => setView("home")} aria-label="성경 친구 대화 홈">
          <span className="bf-brand-icon-slot" aria-hidden="true">🙂</span>
          <strong>성경 친구</strong>
        </button>
      </header>

      <main className="bf-conversation-main">
        {view === "home" && (
          <section className="bf-chat-landing" aria-labelledby="conversation-title">
            <div className="bf-chat-landing-copy">
              <h1 id="conversation-title">대화</h1>
              <p>궁금한 것을 성경 친구와 나눠요</p>
            </div>

            <div className="bf-chat-hero">
              <div className="bf-chat-greeting-card">
                <p>안녕!<br />오늘 마음에 있는<br />질문이 있니?</p>
              </div>
              <div className="bf-mascot-slot" data-figma-slot="conversation-mascot" aria-label="성경 친구 캐릭터 이미지 자리" />
            </div>

            <div className="bf-quick-question-list" aria-label="추천 질문">
              {QUICK_QUESTIONS.map(item => (
                <button key={item.label} type="button" className="bf-quick-question" onClick={() => void sendMessage(item.label)}>
                  <span className="bf-quick-question-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                  <span aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {view === "chat" && (
          <section className="bf-chat-thread" aria-label="성경 친구와의 대화">
            <div className="bf-chat-messages" aria-live="polite">
              {messages.map((message, index) => (
                <article key={`${message.role}-${index}`} className={`bf-chat-bubble-row ${message.role}`}>
                  <div className="bf-chat-avatar-slot" data-role={message.role} aria-hidden="true">
                    {message.role === "assistant" ? "🙂" : "👦"}
                  </div>
                  <div className="bf-chat-bubble">{message.content}</div>
                </article>
              ))}
              {askMutation.isPending && <div className="bf-chat-thinking">성경 친구가 답을 준비하고 있어요…</div>}
            </div>

            {lastAssistantMessage && messages.length > 1 && (
              <section className="bf-verse-card" aria-label="오늘의 말씀 카드">
                <div className="bf-verse-card-heading">
                  <span aria-hidden="true">📖</span>
                  <strong>오늘의 말씀</strong>
                </div>
                <h2>요한복음 3:16</h2>
                <p>말씀 카드 영역은 Figma 디자인과 실제 응답 메타데이터 연결을 위해 구조만 준비되어 있습니다.</p>
              </section>
            )}

            <div className="bf-followup-actions" aria-label="후속 질문">
              <button type="button" onClick={() => void sendMessage("더 쉽게 설명해줘")}>❓ 더 쉽게 설명해줘</button>
              <button type="button" onClick={() => void sendMessage("이 내용으로 짧게 기도해줘")}>🙏 기도해줘</button>
              <button type="button">📖 관련 이야기 보기</button>
              <button type="button" onClick={() => setView("answer")}>답변 자세히 보기</button>
            </div>
          </section>
        )}

        {view === "voice" && (
          <section className="bf-voice-mode" aria-labelledby="voice-mode-title">
            <div className="bf-voice-mode-copy">
              <h1 id="voice-mode-title">대화</h1>
              <p>말씀을 들려주시면 친구가 함께 나눌게요</p>
            </div>
            <div className="bf-voice-mascot-slot" data-figma-slot="voice-mascot" aria-label="듣고 있는 성경 친구 캐릭터 이미지 자리" />
            <div className="bf-voice-status" role="status">
              <strong>듣고 있어요</strong>
              <span>편하게 말씀해 주세요</span>
            </div>
            <blockquote>“하나님은 왜 나를 사랑하시나요?”</blockquote>
            <div className="bf-voice-actions">
              <button type="button" onClick={() => setView("voice")}>🔄 다시 말하기</button>
              <button type="button" onClick={() => setView("chat")}>💬 대화로 전환</button>
            </div>
          </section>
        )}

        {view === "answer" && (
          <section className="bf-answer-detail" aria-labelledby="answer-detail-title">
            <button type="button" className="bf-back-button" onClick={() => setView("chat")}>‹</button>
            <div className="bf-answer-hero">
              <div>
                <h1 id="answer-detail-title">질문에 대한 답변이에요.</h1>
                <p>하나님의 말씀을 함께 살펴볼까요?</p>
              </div>
              <div className="bf-answer-mascot-slot" data-figma-slot="answer-mascot" aria-label="성경을 들고 있는 캐릭터 이미지 자리" />
            </div>
            <section className="bf-answer-verse-card">
              <span>오늘의 말씀</span>
              <h2>빌립보서 4:6</h2>
              <p>“아무 것도 염려하지 말고, 다만 모든 일에 기도와 간구로…”</p>
            </section>
            <section className="bf-answer-explanation-card">
              <h2>⭐ 친구의 설명</h2>
              <p>{lastAssistantMessage || "답변 설명 영역입니다. 실제 대화 응답과 연결됩니다."}</p>
            </section>
            <div className="bf-answer-actions">
              <button type="button">🔊 음성으로 듣기</button>
              <button type="button" onClick={() => void sendMessage("이 답변 내용으로 짧게 기도해줘")}>🫶 짧은 기도</button>
              <button type="button">🔖 기록에 저장</button>
            </div>
          </section>
        )}

        {view === "history" && (
          <section className="bf-conversation-history" aria-labelledby="history-title">
            <div className="bf-history-heading">
              <h1 id="history-title">나의 대화</h1>
              <p>저장된 대화를 다시 만나보세요</p>
            </div>
            <div className="bf-history-filters" role="tablist" aria-label="대화 기록 필터">
              <button type="button" role="tab" aria-selected="true">최근</button>
              <button type="button" role="tab">⭐ 즐겨찾기</button>
              <button type="button" role="tab">📖 성경 구절</button>
              <button type="button" role="tab">🕯️ 기도</button>
            </div>
            <div className="bf-history-list">
              {HISTORY_ITEMS.map(item => (
                <article key={item.title} className="bf-history-card">
                  <span className="bf-history-icon" aria-hidden="true">{item.icon}</span>
                  <div>
                    <h2>{item.title}</h2>
                    <p>{item.summary}</p>
                  </div>
                  <div className="bf-history-meta">
                    <time>{item.date}</time>
                    <span aria-label={item.favorite ? "즐겨찾기" : "즐겨찾기 안 됨"}>{item.favorite ? "⭐" : "☆"}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="bf-conversation-composer" aria-label="대화 입력">
        <textarea
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submitDraft();
            }
          }}
          rows={1}
          placeholder="메시지를 입력해 주세요"
          aria-label="메시지 입력"
        />
        <button type="button" className="bf-voice-entry" onClick={() => setView("voice")} aria-label="말하기 모드 열기">🎙️ 말하기</button>
        <button type="button" onClick={submitDraft} disabled={!draft.trim() || askMutation.isPending} aria-label="메시지 보내기">전송</button>
      </div>

      <nav className="bf-bottom-nav bf-bottom-nav-four" aria-label="주요 메뉴">
        {NAV_ITEMS.map(item => {
          if (item.id === "growth") {
            return (
              <a key={item.id} href="/growth-game" data-tab={item.id}>
                <span className="bf-bottom-icon-slot" data-figma-icon={item.id} aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              data-tab={item.id}
              className={item.id === "conversation" ? "active" : ""}
              onClick={() => {
                if (item.id === "conversation") setView("home");
                if (item.id === "record") setView("history");
              }}
            >
              <span className="bf-bottom-icon-slot" data-figma-icon={item.id} aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
