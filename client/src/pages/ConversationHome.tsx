import { blobToDataUrl, pickRecordingMimeType } from "@/lib/voiceCapture";
import { transcribeAndSend } from "@/lib/voiceConversationFlow";
import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  ChevronRight,
  CircleHelp,
  Flame,
  Heart,
  Mic,
  MessageCircleMore,
  NotebookText,
  RefreshCcw,
  Send,
  Sparkles,
  Sprout,
  Star,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ConversationView = "home" | "chat" | "voice" | "answer" | "history";

type IconTileProps = {
  tone: "heart" | "pray" | "question" | "candle" | "chat" | "story" | "growth" | "record";
  size?: "sm" | "md" | "lg";
};

const QUICK_QUESTIONS = [
  { tone: "heart" as const, label: "하나님은 나를 정말 사랑하시나요?" },
  { tone: "pray" as const, label: "기도는 어떻게 하는 건가요?" },
  { tone: "question" as const, label: "예수님은 왜 세상에 오셨나요?" },
  { tone: "candle" as const, label: "용서하는 것이 왜 중요할까요?" },
];

const HISTORY_ITEMS = [
  {
    tone: "heart" as const,
    title: "하나님은 나를 사랑하시나요?",
    summary: "하나님은 당신을 지금 이 순간에도 변함없이 사랑하십니다.",
    date: "오늘 10:30",
  },
  {
    tone: "pray" as const,
    title: "기도는 왜 필요할까요?",
    summary: "기도는 하나님과 대화하는 시간이에요. 우리의 마음을 하나님께 전하고…",
    date: "어제 20:15",
  },
  {
    tone: "record" as const,
    title: "용서에 대해 배웠어요",
    summary: "용서는 다른 사람을 위한 선물이자 나 자신을 위한 자유예요.",
    date: "5월 18일",
  },
  {
    tone: "story" as const,
    title: "예수님은 왜 오셨나요?",
    summary: "예수님은 우리를 구원하고 하나님의 사랑을 보여주셨어요.",
    date: "5월 15일",
  },
];

const NAV_ITEMS = [
  { id: "conversation" as const, label: "대화", tone: "chat" as const },
  { id: "story" as const, label: "스토리", tone: "story" as const },
  { id: "growth" as const, label: "성장", tone: "growth" as const },
  { id: "record" as const, label: "기록", tone: "record" as const },
];

function IconTile({ tone, size = "md" }: IconTileProps) {
  const icons: Record<IconTileProps["tone"], ReactNode> = {
    heart: <Heart aria-hidden="true" fill="currentColor" />,
    pray: <Sparkles aria-hidden="true" />,
    question: <CircleHelp aria-hidden="true" />,
    candle: <Flame aria-hidden="true" fill="currentColor" />,
    chat: <MessageCircleMore aria-hidden="true" fill="currentColor" />,
    story: <BookOpen aria-hidden="true" />,
    growth: <Sprout aria-hidden="true" />,
    record: <NotebookText aria-hidden="true" />,
  };

  return <span className={`bf-icon-tile bf-icon-${tone} bf-icon-${size}`}>{icons[tone]}</span>;
}

function Brand({ onHome }: { onHome: () => void }) {
  return (
    <header className="bf-conversation-header">
      <button type="button" className="bf-brand-button" onClick={onHome} aria-label="성경 친구 대화 홈">
        <span className="bf-brand-logo" aria-hidden="true">
          <img src="/assets/bible-friend-mascot.svg" alt="" width="34" height="34" decoding="async" />
        </span>
        <strong>성경 친구</strong>
      </button>
    </header>
  );
}

function Mascot({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={`bf-mascot ${compact ? "is-compact" : ""} ${className}`.trim()} aria-hidden="true">
      <img
        src="/assets/bible-friend-mascot.svg"
        alt=""
        width={compact ? 48 : 180}
        height={compact ? 58 : 210}
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
}

export default function ConversationHome() {
  const askMutation = trpc.ai.ask.useMutation();
  const transcribeMutation = trpc.voice.transcribe.useMutation();
  const [view, setView] = useState<ConversationView>("home");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "안녕! 무엇이 궁금한지 말해줄래? 😊" },
  ]);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [micError, setMicError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const sendMessageRef = useRef<(content: string) => Promise<void> | void>(() => undefined);

  const lastAssistantMessage = useMemo(
    () => messages.slice().reverse().find(message => message.role === "assistant")?.content ?? "",
    [messages],
  );

  const sendMessage = async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || askMutation.isPending) return;

    setView("chat");
    setDraft("");
    setMicError(null);
    setIsListening(false);
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
  sendMessageRef.current = sendMessage;

  const stopMediaRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
  };

  const startMediaRecording = async () => {
    if (mediaRecorderRef.current?.state === "recording") return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicError("이 기기에서는 음성 인식을 사용할 수 없어요. 글로 질문해 주세요.");
      setIsListening(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      mediaChunksRef.current = [];

      recorder.ondataavailable = event => {
        if (event.data.size > 0) mediaChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || mimeType || "audio/mp4" });
        mediaRecorderRef.current = null;
        mediaChunksRef.current = [];
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;

        if (blob.size < 800) {
          setMicError("조금 더 길게 말한 뒤 다시 눌러 주세요.");
          setIsListening(false);
          return;
        }

        setMicError(null);
        try {
          const text = await transcribeAndSend({
            audioDataUrl: await blobToDataUrl(blob),
            transcribe: input => transcribeMutation.mutateAsync(input),
            send: sendMessageRef.current,
          });
          setRecognizedText(text);
        } catch {
          setMicError("음성을 글로 바꾸지 못했어요. 다시 말하거나 글로 질문해 주세요.");
        } finally {
          setIsListening(false);
        }
      };

      recorder.onerror = () => {
        setMicError("마이크를 준비하지 못했어요. 권한을 허용한 뒤 다시 눌러 주세요.");
        mediaRecorderRef.current = null;
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
        setIsListening(false);
      };

      recorder.start(250);
      setRecognizedText("");
      setMicError(null);
      setIsListening(true);
    } catch {
      setMicError("마이크 권한이 필요해요. 브라우저 설정에서 마이크를 허용해 주세요.");
      setIsListening(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const speechWindow = window as typeof window & { SpeechRecognition?: any; webkitSpeechRecognition?: any };
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      setRecognizedText("");
      setMicError(null);
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const text = event.results?.[0]?.[0]?.transcript?.trim();
      if (!text) return;
      setRecognizedText(text);
      void sendMessageRef.current(text);
    };

    recognition.onend = () => setIsListening(false);

    recognition.onerror = (event: any) => {
      setIsListening(false);
      const errorCode = event?.error;
      if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
        setMicError("마이크 권한이 필요해요. 브라우저 설정에서 마이크를 허용해 주세요.");
        return;
      }
      setMicError("브라우저 음성 인식이 불안정해 녹음 방식으로 다시 듣고 있어요.");
      void startMediaRecording();
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.stop?.();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.();
      stopMediaRecording();
    };
  }, []);

  const beginListening = () => {
    if (isListening || mediaRecorderRef.current?.state === "recording") return;
    setView("voice");
    setRecognizedText("");
    setMicError(null);

    const recognition = recognitionRef.current;
    if (!recognition) {
      void startMediaRecording();
      return;
    }

    try {
      recognition.start();
    } catch {
      void startMediaRecording();
    }
  };

  const toggleListening = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      stopMediaRecording();
      return;
    }
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop?.();
      return;
    }
    beginListening();
  };

  const submitDraft = () => void sendMessage(draft);

  const goHome = () => {
    recognitionRef.current?.stop?.();
    stopMediaRecording();
    setIsListening(false);
    setMicError(null);
    setView("home");
  };

  return (
    <div className="bf-conversation-shell">
      <div className="bf-conversation-app" data-design-source="figma:Gs1HH9OGCLpndjS6BQQ8rN">
        <Brand onHome={goHome} />

        <main className={`bf-conversation-main bf-view-${view}`}>
          {view === "home" && (
            <section className="bf-chat-landing" aria-labelledby="conversation-title">
              <div className="bf-home-hero-copy">
                <h1 id="conversation-title">대화</h1>
                <p>궁금한 것을 성경 친구와 나눠요</p>
              </div>

              <div className="bf-home-mascot-backdrop" aria-hidden="true" />
              <Mascot className="bf-home-mascot" />

              <div className="bf-chat-greeting-card">
                <p>안녕!<br />오늘 마음에 있는<br />질문이 있니?</p>
                <Sparkles className="bf-greeting-sparkle" aria-hidden="true" />
              </div>

              <div className="bf-quick-question-list" aria-label="추천 질문">
                {QUICK_QUESTIONS.map(item => (
                  <button key={item.label} type="button" className="bf-quick-question" onClick={() => void sendMessage(item.label)}>
                    <IconTile tone={item.tone} />
                    <span className="bf-quick-label">{item.label}</span>
                    <ChevronRight className="bf-quick-chevron" aria-hidden="true" />
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
                    {message.role === "assistant" && <Mascot compact className="bf-chat-avatar" />}
                    <div className="bf-chat-bubble">{message.content}</div>
                  </article>
                ))}
                {askMutation.isPending && <div className="bf-chat-thinking">성경 친구가 답을 준비하고 있어요…</div>}
              </div>

              {lastAssistantMessage && messages.length > 1 && (
                <section className="bf-verse-card" aria-label="오늘의 말씀 카드">
                  <span className="bf-verse-bookmark" aria-hidden="true" />
                  <strong className="bf-verse-kicker">오늘의 말씀</strong>
                  <h2>요한복음 3:16</h2>
                  <p>하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라</p>
                </section>
              )}

              <div className="bf-followup-actions" aria-label="후속 질문">
                <button type="button" onClick={() => void sendMessage("더 쉽게 설명해줘")}>더 쉽게 설명해줘</button>
                <button type="button" onClick={() => void sendMessage("이 내용으로 짧게 기도해줘")}>기도해줘</button>
                <button type="button">관련 이야기 보기</button>
              </div>
            </section>
          )}

          {view === "voice" && (
            <section className="bf-voice-mode" aria-labelledby="voice-mode-title">
              <div className="bf-voice-heading">
                <h1 id="voice-mode-title">대화</h1>
                <p>말씀을 들려주시면<br />친구가 함께 나눌게요</p>
              </div>

              <div className={`bf-listening-stage ${isListening ? "is-listening" : ""}`}>
                <div className="bf-listening-ring ring-three" aria-hidden="true" />
                <div className="bf-listening-ring ring-two" aria-hidden="true" />
                <div className="bf-listening-ring ring-one" aria-hidden="true" />
                <Mascot className="bf-listening-mascot" />
                <div className="bf-waveform" aria-hidden="true">
                  {[20, 38, 54, 34, 46, 24, 46, 34, 54, 38, 20].map((height, index) => (
                    <i key={`${height}-${index}`} style={{ height }} />
                  ))}
                </div>
              </div>

              <div className="bf-voice-status" role="status" aria-live="polite">
                <strong><span aria-hidden="true">●</span> {isListening ? "듣고 있어요" : transcribeMutation.isPending ? "말을 글로 바꾸고 있어요" : "말하기를 눌러 주세요"}</strong>
                <span>{micError ?? "편하게 말씀해 주세요"}</span>
              </div>

              <blockquote>{recognizedText ? `“ ${recognizedText} ”` : "“ 하나님은 왜 나를 사랑하시나요? ”"}</blockquote>

              <div className="bf-voice-actions">
                <button type="button" onClick={beginListening} disabled={isListening || transcribeMutation.isPending}>
                  <RefreshCcw aria-hidden="true" />
                  <span><strong>다시 말하기</strong><small>처음부터 다시 말할게요</small></span>
                </button>
                <button type="button" onClick={() => { recognitionRef.current?.stop?.(); stopMediaRecording(); setIsListening(false); setView("chat"); }}>
                  <MessageCircleMore aria-hidden="true" />
                  <span><strong>대화로 전환</strong><small>텍스트 대화로 바꿔요</small></span>
                </button>
              </div>
            </section>
          )}

          {view === "answer" && (
            <section className="bf-answer-detail" aria-labelledby="answer-detail-title">
              <div className="bf-answer-hero">
                <div>
                  <h1 id="answer-detail-title">질문에 대한 답변이에요.</h1>
                  <p>하나님의 말씀을 함께<br />살펴볼까요?</p>
                </div>
                <Mascot className="bf-answer-mascot" />
              </div>

              <section className="bf-answer-verse-card">
                <strong>오늘의 말씀</strong>
                <h2>빌립보서 4:6</h2>
                <p>“아무 것도 염려하지 말고, 다만 모든 일에 기도와 간구로, 너희 구할 것을 감사함으로 하나님께 아뢰라”</p>
                <IconTile tone="record" size="lg" />
              </section>

              <section className="bf-answer-explanation-card">
                <h2><Star aria-hidden="true" fill="currentColor" /> 친구의 설명</h2>
                <p>{lastAssistantMessage || "이 말씀은 우리가 걱정될 때 어떻게 해야 하는지 알려줘요. 마음이 불안하거나 고민이 생기면, 하나님께 솔직하게 이야기하고 기도하라고 해요. 그리고 이미 주신 것들에 감사하는 마음을 가질 때, 우리의 마음이 평안해진답니다."}</p>
              </section>

              <div className="bf-answer-actions">
                <button type="button"><Volume2 aria-hidden="true" />음성으로 듣기</button>
                <button type="button" onClick={() => void sendMessage("이 답변 내용으로 짧게 기도해줘")}>짧은 기도</button>
                <button type="button" onClick={() => setView("history")}>기록에 저장</button>
              </div>
            </section>
          )}

          {view === "history" && (
            <section className="bf-conversation-history" aria-labelledby="history-title">
              <div className="bf-history-heading">
                <div>
                  <h1 id="history-title">나의 대화</h1>
                  <p>저장된 대화를 다시 만나보세요</p>
                </div>
                <Mascot className="bf-history-mascot" />
              </div>

              <div className="bf-history-filters" role="tablist" aria-label="대화 기록 필터">
                <button type="button" role="tab" aria-selected="true">최근</button>
                <button type="button" role="tab">즐겨찾기</button>
                <button type="button" role="tab">성경 구절</button>
                <button type="button" role="tab">기도</button>
              </div>

              <div className="bf-history-list">
                {HISTORY_ITEMS.map(item => (
                  <article key={item.title} className="bf-history-card">
                    <IconTile tone={item.tone} size="lg" />
                    <div className="bf-history-copy">
                      <h2>{item.title}</h2>
                      <p>{item.summary}</p>
                    </div>
                    <time>{item.date}</time>
                    <Star className="bf-history-star" aria-label="즐겨찾기" />
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
          {draft.trim() ? (
            <button type="button" className="bf-send-entry" onClick={submitDraft} disabled={askMutation.isPending} aria-label="메시지 보내기">
              <Send aria-hidden="true" />
              <span>전송</span>
            </button>
          ) : (
            <button
              type="button"
              className={`bf-voice-entry ${isListening ? "is-listening" : ""}`}
              onClick={toggleListening}
              aria-label={isListening ? "음성 듣기 완료" : "말하기"}
            >
              <Mic aria-hidden="true" />
              <span>{isListening ? "완료" : "말하기"}</span>
            </button>
          )}
        </div>

        <nav className="bf-bottom-nav" aria-label="주요 메뉴">
          {NAV_ITEMS.map(item => {
            const active = item.id === "conversation" ? view !== "history" : item.id === "record" && view === "history";
            if (item.id === "growth") {
              return (
                <a key={item.id} href="/growth-game" className={active ? "active" : ""}>
                  <IconTile tone={item.tone} size="sm" />
                  <span>{item.label}</span>
                </a>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                className={active ? "active" : ""}
                onClick={() => {
                  if (item.id === "conversation") goHome();
                  if (item.id === "record") setView("history");
                }}
              >
                <IconTile tone={item.tone} size="sm" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
