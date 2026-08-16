import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";

type Message = { role: "system" | "user" | "assistant"; content: string };
import { trpc } from "@/lib/trpc";
import { getScoreLabel } from "@/lib/scoreStatus";
import { VoiceStatusBadge } from "@/components/VoiceStatusBadge";
import { getVoiceStateFromPlaybackError, getVoiceStateFromPlaybackStarted, getVoiceToggleLabel, type VoiceStatus } from "@/lib/voiceStatus";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Heart,
  Lightbulb,
  Loader2,
  Mic,
  MessageCircleHeart,
  Pause,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AudioPlaybackQueue, type TTSMutation, type VoiceRequest } from "@/lib/audioPlaybackQueue";
import { blobToDataUrl, pickRecordingMimeType } from "@/lib/voiceCapture";
import { askAndSpeak, transcribeAndSend } from "@/lib/voiceConversationFlow";
import { getVoiceMicAriaLabel, getVoiceMicLabel, getVoiceMicStateClass } from "@/lib/voiceMicPresentation";

const FRIEND_MASCOT_URL = "/manus-storage/bible-friend-mascot_06125680.png";
const CHAT_BACKGROUND_URL = "/manus-storage/bible-friend-chat-bg_371dab14.png";

const initialMessages: Message[] = [
  {
    role: "assistant",
    content: "안녕! 나는 성경 친구야. 오늘 마음에 떠오르는 질문이 있니? 🌈",
  },
];

export function HomeVoiceStatus({ enabled, status, error }: { enabled: boolean; status: VoiceStatus; error: string | null }) {
  return <VoiceStatusBadge enabled={enabled} status={status} error={error} />;
}

export default function Home() {
  const { user } = useAuth();
  const storiesQuery = trpc.content.stories.useQuery();
  const scoreQuery = trpc.content.score.useQuery();
  const askMutation = trpc.ai.ask.useMutation();
  const ttsMutation = trpc.tts.synthesize.useMutation();
  const transcribeMutation = trpc.voice.transcribe.useMutation();
  const orchestrateMutation = trpc.ai.orchestrate.useMutation();
  const addScoreMutation = trpc.game.addScore.useMutation({
    onSuccess: () => scoreQuery.refetch(),
  });
  const treasureQuery = trpc.content.treasureCards.useQuery();
  const collectCardMutation = trpc.content.collectCard.useMutation({
    onSuccess: () => treasureQuery.refetch(),
  });
  const dailyDrawMutation = trpc.content.drawDailyCard.useMutation({
    onSuccess: (res) => {
      if (res.success && res.card) {
        if (res.alreadyDrawn) {
          alert("오늘의 보물 카드는 이미 뽑았어요! 내일 또 새로운 카드를 뽑으러 와요.");
        } else {
          setNewlyCollectedCard({ title: res.card.title, verse: res.card.verse, iconEmoji: res.card.iconEmoji });
          treasureQuery.refetch();
        }
      }
    }
  });
  const prayerNotesQuery = trpc.content.prayerNotes.useQuery(undefined, { enabled: Boolean(user) });
  const addPrayerNoteMutation = trpc.content.addPrayerNote.useMutation({
    onSuccess: (res) => {
      if (res.success) {
        setNewPrayerText("");
        setNewPrayerVerse("");
        prayerNotesQuery.refetch();
        alert("기도 노트에 따뜻한 마음이 예쁘게 담겼어요! 🙏");
      }
    }
  });
  const [newPrayerText, setNewPrayerText] = useState("");
  const [newPrayerVerse, setNewPrayerVerse] = useState("");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [newlyCollectedCard, setNewlyCollectedCard] = useState<{ title: string; verse: string; iconEmoji: string } | null>(null);
  const [activeTreasureCard, setActiveTreasureCard] = useState<{ id: number; title: string; verse: string; content: string; iconEmoji: string } | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("ready");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isMicPressed, setIsMicPressed] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"home" | "stories" | "game" | "more" | "records">("home");
  const [treasureThemeFilter, setTreasureThemeFilter] = useState<"all" | "love" | "wisdom" | "courage">("all");
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizCorrect, setQuizCorrect] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<{ storyTitle: string; storyHook: string; storyLesson: string; quizQuestion: string; quizAnswer: string; encouragement: string } | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const micPointerDownRef = useRef(false);
  const handleSendRef = useRef<(content: string) => void>(() => undefined);
  const skipNextVoiceClickRef = useRef(false);
  const audioQueueRef = useRef<AudioPlaybackQueue | null>(null);
  const voiceReadyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!audioQueueRef.current) {
    audioQueueRef.current = new AudioPlaybackQueue(ttsMutation as TTSMutation, {
      onPlaybackStarted: info => {
        if (voiceReadyTimerRef.current) clearTimeout(voiceReadyTimerRef.current);
        const nextState = getVoiceStateFromPlaybackStarted(info.provider);
        setVoiceStatus(nextState.status);
        setVoiceError(nextState.error);
        console.info("[Bible Friend Voice Timing] first-playable", {
          provider: info.provider,
          startedAt: info.startedAt,
          serverResponseAt: info.serverResponseAt ?? null,
          serverToFirstPlayableMs: info.serverResponseAt ? info.startedAt - info.serverResponseAt : null,
        });
      },
      onPlaybackFinished: () => {
        if (voiceReadyTimerRef.current) clearTimeout(voiceReadyTimerRef.current);
        voiceReadyTimerRef.current = setTimeout(() => setVoiceStatus("ready"), 800);
      },
      onServerResponse: info => {
        console.info("[Bible Friend Voice Timing] server-response", {
          provider: info.provider ?? null,
          serverResponseAt: info.serverResponseAt,
          observedAt: info.observedAt,
          observationLatencyMs: info.observedAt - info.serverResponseAt,
          synthesisLatencyMs: info.latencyMs ?? null,
          success: info.success,
        });
      },
      onPlaybackError: info => {
        if (voiceReadyTimerRef.current) clearTimeout(voiceReadyTimerRef.current);
        const nextState = getVoiceStateFromPlaybackError(info.code, info.message);
        setVoiceStatus(nextState.status);
        setVoiceError(nextState.error);
      },
      // Automatic replies stay on server-generated audio only. This prevents
      // iPhone's mechanical Web Speech voice from silently replacing Gemini.
      allowBrowserFallback: false,
    });
  }
  const stories = storiesQuery.data ?? [];
  const selectedStory = stories.find(story => story.id === selectedStoryId) ?? null;
  const score = scoreQuery.data ?? 0;
  const scoreLabel = getScoreLabel({ isLoading: scoreQuery.isLoading, isError: scoreQuery.isError, data: scoreQuery.data });
  const quizQuery = trpc.content.quiz.useQuery(undefined, { enabled: quizStarted });
  const quiz = quizQuery.data;

  const speakText = (request: VoiceRequest) => {
    if (!voiceEnabled) return;
    audioQueueRef.current?.prime();
    // One Gemini request per answer keeps the expressive prosody intact and
    // avoids exhausting the free TTS request quota sentence by sentence.
    audioQueueRef.current?.enqueue({ ...request, text: request.text.trim() });
  };

  useEffect(() => {
    return () => {
      audioQueueRef.current?.cancel();
      if (voiceReadyTimerRef.current) clearTimeout(voiceReadyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!voiceEnabled) audioQueueRef.current?.cancel();
  }, [voiceEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const speechWindow = window as typeof window & { SpeechRecognition?: any; webkitSpeechRecognition?: any };
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        setMicError(null);
        setIsListening(true);
        setIsMicPressed(true);
      };
      recognition.onend = () => {
        setIsListening(false);
        if (!micPointerDownRef.current) setIsMicPressed(false);
        skipNextVoiceClickRef.current = false;
      };
      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (!micPointerDownRef.current) setIsMicPressed(false);
        skipNextVoiceClickRef.current = false;
        const errorCode = event?.error;
        setMicError(errorCode === "not-allowed" || errorCode === "service-not-allowed"
          ? "마이크 권한이 필요해요. 브라우저 설정에서 마이크를 허용해 주세요."
          : "음성을 듣지 못했어요. 잠시 후 다시 눌러 주세요.");
        if (errorCode !== "not-allowed" && errorCode !== "service-not-allowed") void startMediaRecording();
      };
      recognition.onresult = (event: any) => {
        const text = event.results[0]?.[0]?.transcript?.trim();
        if (text) handleSendRef.current(text);
      };
    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, []);

  const speakNow = (request: VoiceRequest) => {
    if (!voiceEnabled) return;
    audioQueueRef.current?.prime();
    // A speaker-button tap must still use Gemini TTS. It only primes Web Audio
    // from the user gesture; it must never start the mechanical browser voice.
    speakText(request);
  };

  const selectedStoryContext = useMemo(() => selectedStory?.id, [selectedStory]);

  const handleSend = async (content: string) => {
    const question = content.trim();
    if (!question || askMutation.isPending) return;
    if (voiceEnabled) audioQueueRef.current?.prime();
    const nextMessages: Message[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    try {
      const answer = await askAndSpeak({
        input: { question, storyId: selectedStoryContext },
        ask: input => askMutation.mutateAsync(input).then(result => result.answer),
        speak: speakText,
        context: selectedStory?.title,
      });
      setMessages(current => [...current, { role: "assistant", content: answer }]);
    } catch {
      const fallback = "잠깐 연결이 쉬어 가고 있어요. 그래도 하나님은 우리 곁에 계셔요. 조금 뒤에 다시 물어봐 줄래?";
      setMessages(current => [...current, { role: "assistant", content: fallback }]);
      speakText({ text: fallback, speaker: "CHILD_FRIEND", emotion: "안심시키는 따뜻함" });
    }
  };
  handleSendRef.current = handleSend;

  useEffect(() => {
    if (!voiceEnabled) {
      audioQueueRef.current?.cancel();
      stopMediaRecording();
      recognitionRef.current?.stop?.();
      setIsListening(false);
      setIsMicPressed(false);
    }
  }, [voiceEnabled]);

  const stopMediaRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
  };

  const startMediaRecording = async () => {
    if (mediaRecorderRef.current?.state === "recording") return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicError("이 기기에서는 마이크 인식을 사용할 수 없어요. 글로 질문해 주세요.");
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
      recorder.ondataavailable = event => { if (event.data.size > 0) mediaChunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        const blob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || mimeType || "audio/mp4" });
        mediaRecorderRef.current = null;
        mediaChunksRef.current = [];
        if (blob.size < 800) {
          setMicError("조금 더 길게 말한 뒤 다시 눌러 주세요.");
          setIsListening(false);
          return;
        }
        setMicError(null);
        try {
          await transcribeAndSend({
            audioDataUrl: await blobToDataUrl(blob),
            transcribe: input => transcribeMutation.mutateAsync(input),
            send: handleSendRef.current,
          });
        } catch {
          setMicError("음성을 글로 바꾸지 못했어요. 글로 질문해도 괜찮아요.");
        } finally {
          setIsListening(false);
          setIsMicPressed(false);
        }
      };
      recorder.onerror = () => {
        setMicError("마이크를 준비하지 못했어요. 권한을 허용한 뒤 다시 눌러 주세요.");
        mediaRecorderRef.current = null;
        setIsListening(false);
        if (!micPointerDownRef.current) setIsMicPressed(false);
      };
      recorder.start(250);
      setMicError(null);
      setIsListening(true);
      setIsMicPressed(true);
    } catch {
      setMicError("마이크 권한이 필요해요. 브라우저 설정에서 마이크를 허용해 주세요.");
      setIsListening(false);
      if (!micPointerDownRef.current) setIsMicPressed(false);
    }
  };

  const beginListening = (fromPointer = false) => {
    if (isListening || mediaRecorderRef.current?.state === "recording" || skipNextVoiceClickRef.current) return;
    setMicError(null);
    audioQueueRef.current?.prime();
    const recognition = recognitionRef.current;
    if (!recognition) {
      skipNextVoiceClickRef.current = fromPointer;
      void startMediaRecording();
      return;
    }
    skipNextVoiceClickRef.current = fromPointer;
    try {
      recognition.start();
    } catch {
      skipNextVoiceClickRef.current = false;
      void startMediaRecording();
    }
  };

  const toggleListening = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      stopMediaRecording();
      return;
    }
    const recognition = recognitionRef.current;
    if (skipNextVoiceClickRef.current) {
      skipNextVoiceClickRef.current = false;
      return;
    }
    if (recognition && isListening) recognition.stop();
    else beginListening();
  };

  const startQuiz = () => {
    setActiveTab("game");
    setQuizStarted(true);
    setQuizAnswered(false);
    setQuizCorrect(false);
  };

  const answerQuiz = (index: number) => {
    if (quizAnswered || !quiz) return;
    const correct = index === quiz.answer;
    setQuizAnswered(true);
    setQuizCorrect(correct);
    if (correct) {
      addScoreMutation.mutate({ points: 1 });
      const cardPayload = {
        cardId: `quiz-${quiz.question.slice(0, 10)}`,
        title: "지혜의 보물 카드",
        verse: "잠언 2:6",
        content: quiz.explanation,
        category: "quiz" as const,
        iconEmoji: "🗺️",
      };
      collectCardMutation.mutate(cardPayload, {
        onSuccess: (res) => {
          if (res.collected) {
            setNewlyCollectedCard({ title: cardPayload.title, verse: cardPayload.verse, iconEmoji: cardPayload.iconEmoji });
          }
        },
      });
      speakText({ text: "정답이야! 말씀 보물 카드를 획득했어!", speaker: "CHILD_FRIEND", emotion: "기쁘고 신나는 축하" });
    } else if (voiceEnabled) {
      speakText({ text: `괜찮아! 정답은 ${quiz.options[quiz.answer]}야. 함께 다시 알아보자.`, speaker: "CHILD_FRIEND", emotion: "다정하게 격려" });
    }
  };

  const nextQuiz = async () => {
    setQuizAnswered(false);
    setQuizCorrect(false);
    await quizQuery.refetch();
  };

  const openStory = (id: string) => setSelectedStoryId(id);
  const closeStory = () => setSelectedStoryId(null);
  const tellStory = () => {
    if (!selectedStory) return;
    const storyText = `${selectedStory.title}. ${selectedStory.body} ${selectedStory.lesson}`;
    setMessages(current => [...current, { role: "assistant", content: storyText }]);
    speakText({ text: storyText, speaker: "NARRATOR", emotion: "경이롭고 따뜻한 이야기", context: selectedStory.title });
    const cardPayload = {
      cardId: `story-${selectedStory.id}`,
      title: selectedStory.title,
      verse: selectedStory.verse,
      content: selectedStory.lesson,
      category: "story" as const,
      iconEmoji: "✨",
    };
    collectCardMutation.mutate(cardPayload, {
      onSuccess: (res) => {
        if (res.collected) {
          setNewlyCollectedCard({ title: cardPayload.title, verse: cardPayload.verse, iconEmoji: cardPayload.iconEmoji });
        }
      },
    });
    closeStory();
  };

  const createTodayContent = async () => {
    const generated = await orchestrateMutation.mutateAsync({ focus: "오늘 아이가 용기와 사랑을 배울 수 있는 성경 이야기" });
    setGeneratedContent(generated);
  };

  return (
    <div className="bf-app">
      <div className="bf-ambient bf-ambient-one" />
      <div className="bf-ambient bf-ambient-two" />
      <AnimatePresence>
        {newlyCollectedCard && (
          <motion.div className="bf-confetti-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setNewlyCollectedCard(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div className="bf-treasure-popup" initial={{ scale: 0.5, rotate: -10, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ type: "spring", damping: 12, stiffness: 200 }} style={{ background: "#fff", padding: "30px", borderRadius: "24px", textAlign: "center", maxWidth: "340px", width: "100%", boxShadow: "0 20px 40px rgba(0,0,0,0.25)", border: "3px solid #eab308", position: "relative", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
              <div style={{ position: "absolute", top: "-10px", right: "-10px", fontSize: "60px", opacity: 0.15 }}>🌟</div>
              <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.4, 1] }} transition={{ delay: 0.1, duration: 0.5 }} style={{ fontSize: "56px", marginBottom: "12px" }}>{newlyCollectedCard.iconEmoji}</motion.div>
              <span className="bf-kicker" style={{ color: "#d97706", fontWeight: "bold" }}>🎉 보물 카드 획득!</span>
              <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "8px 0 6px", color: "#1f2937" }}>{newlyCollectedCard.title}</h2>
              <p style={{ fontSize: "14px", color: "#4b5563", marginBottom: "16px" }}>{newlyCollectedCard.verse}</p>
              <button className="bf-primary-button full" onClick={() => setNewlyCollectedCard(null)}>말씀 보물함에 담기</button>
            </motion.div>
          </motion.div>
        )}
        {activeTreasureCard && (
          <motion.div className="bf-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveTreasureCard(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div className="bf-story-modal" initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 15, scale: 0.98 }} onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: "28px", borderRadius: "24px", maxWidth: "360px", width: "100%", boxShadow: "0 20px 40px rgba(0,0,0,0.25)", border: "2px solid #eab308", textAlign: "center", position: "relative" }}>
              <button className="bf-modal-close" onClick={() => setActiveTreasureCard(null)} aria-label="닫기" style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>{activeTreasureCard.iconEmoji}</div>
              <span className="bf-kicker" style={{ color: "#d97706", fontWeight: "bold" }}>말씀 보물 카드</span>
              <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "6px 0 4px" }}>{activeTreasureCard.title}</h2>
              <p style={{ fontSize: "13px", color: "#d97706", fontWeight: "bold", marginBottom: "12px" }}>{activeTreasureCard.verse}</p>
              <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.5", marginBottom: "20px" }}>{activeTreasureCard.content}</p>
              <button className="bf-primary-button full" onClick={() => {
                speakNow({ text: `${activeTreasureCard.title}. ${activeTreasureCard.verse}. ${activeTreasureCard.content}`, speaker: "CHILD_FRIEND", emotion: "따뜻하고 다정한 목소리" });
              }}><Volume2 size={16} /> 성경 친구 목소리로 듣기</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <header className="bf-topbar">
        <a href="#top" className="bf-brand" aria-label="성경 친구 홈">
          <span className="bf-brand-mark"><img src={FRIEND_MASCOT_URL} alt="" /></span>
          <span><strong>성경 친구</strong></span>
        </a>
        <p className="bf-top-copy">궁금한 건 뭐든 성경친구에게 물어봐요</p>
      </header>

      <main id="top" className="bf-main">
        {activeTab === "home" && (
          <section className="bf-home-screen">
            <section className="bf-section bf-chat-section">
              <div className="bf-chat-surface bf-chat-surface-art" style={{ backgroundImage: `url(${CHAT_BACKGROUND_URL})` }}>
                <div className="bf-chat-utility">
                  {voiceStatus === "error" && <HomeVoiceStatus enabled={voiceEnabled} status={voiceStatus} error={voiceError} />}
                  <button className={`bf-round-icon ${voiceEnabled ? "is-on" : ""}`} onClick={() => setVoiceEnabled(value => !value)} aria-label={getVoiceToggleLabel(voiceEnabled)} aria-pressed={voiceEnabled} title={getVoiceToggleLabel(voiceEnabled)}>{voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
                </div>
                <div className="bf-chat-friend-bg" aria-hidden="true"><span>✦</span><img src={FRIEND_MASCOT_URL} alt="" /></div>
                <ChatPanel messages={messages} onSendMessage={handleSend} isLoading={askMutation.isPending} onSpeak={speakText} onSpeakNow={speakNow} />
              </div>
            </section>
          </section>
        )}

        {activeTab === "stories" && <section className="bf-tab-page"><button className="bf-back-button" onClick={() => setActiveTab("home")}><ArrowLeft size={15} /> 홈으로 돌아가기</button><div className="bf-tab-title"><span className="bf-kicker">STORY GARDEN</span><h1>성경 이야기 정원</h1><p>마음에 닿는 이야기를 골라 천천히 만나 보세요.</p></div><div className="bf-story-grid">{stories.map(story => <button key={story.id} className={`bf-story-card ${story.accent}`} onClick={() => openStory(story.id)}><div className="bf-story-art"><img src={story.imageUrl} alt="" /><span>✨</span></div><div className="bf-story-copy"><strong>{story.title}</strong><span>{story.subtitle}</span><small>이야기 열기 <ArrowRight size={11} /></small></div></button>)}</div></section>}

        {activeTab === "game" && (() => {
          const [miniGameStarted, setMiniGameStarted] = useState(false);
          const [cardIndex, setCardIndex] = useState(0);
          const [matchedCount, setMatchedCount] = useState(0);
          const [gameDone, setGameDone] = useState(false);
          const gameCards = [
            { title: "사랑의 선물", verse: "요한복음 3:16", hint: "하나님이 세상을 이처럼 사랑하사..." },
            { title: "두려움 없는 용기", verse: "여호수아 1:9", hint: "강하고 담대하라 두려워하지 말며..." },
            { title: "빛나는 지혜", verse: "잠언 3:5", hint: "너는 마음을 다하여 여호와를 신뢰하고..." },
          ];
          const currentCard = gameCards[cardIndex];
          const options = [currentCard.verse, "시편 23:1", "창세기 1:1", "마태복음 6:9"].sort(() => Math.random() - 0.5);
          const [selectedOpt, setSelectedOpt] = useState<string | null>(null);

          return (
            <section className="bf-tab-page">
              <button className="bf-back-button" onClick={() => setActiveTab("home")}><ArrowLeft size={15} /> 홈으로 돌아가기</button>
              <div className="bf-tab-title">
                <span className="bf-kicker">TREASURE MATCH</span>
                <h1>보물 카드 짝맞추기 미니게임</h1>
                <p>수집한 보물 카드의 성경 구절과 힌트를 맞춰보세요!</p>
              </div>
              {!miniGameStarted ? (
                <div style={{ textAlign: "center", padding: "30px 20px", background: "rgba(255,255,255,0.9)", borderRadius: "20px", border: "2px solid #ddd" }}>
                  <div style={{ fontSize: "48px", marginBottom: "12px" }}>🧩</div>
                  <h3>보물 카드 맞추기 놀이</h3>
                  <p style={{ fontSize: "13px", color: "#666", marginBottom: "20px" }}>설명을 읽고 알맞은 성경 구절을 찾아 별 보상을 받아요!</p>
                  <button className="bf-primary-button" onClick={() => { setMiniGameStarted(true); setCardIndex(0); setMatchedCount(0); setGameDone(false); setSelectedOpt(null); }}>게임 시작하기 🚀</button>
                </div>
              ) : gameDone ? (
                <div style={{ textAlign: "center", padding: "30px 20px", background: "linear-gradient(135deg, #fef08a 0%, #fde047 100%)", borderRadius: "20px", border: "2px solid #ca8a04" }}>
                  <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎉</div>
                  <h3>짝맞추기 성공!</h3>
                  <p style={{ fontSize: "14px", color: "#713f12", marginBottom: "20px" }}>모든 보물 카드 짝을 멋지게 맞췄어요! 별 +30개 획득!</p>
                  <button className="bf-primary-button" onClick={() => { addScoreMutation.mutate({ points: 30 }); setMiniGameStarted(false); }} style={{ background: "#ca8a04", borderColor: "#a16207" }}>보상 받고 홈으로 🌟</button>
                </div>
              ) : (
                <div style={{ background: "white", padding: "24px", borderRadius: "20px", border: "2px solid #8b5cf6", boxShadow: "0 8px 20px rgba(139,92,246,0.1)" }}>
                  <span style={{ fontSize: "12px", fontWeight: "bold", color: "#7c3aed" }}>문제 {cardIndex + 1} / {gameCards.length}</span>
                  <h3 style={{ fontSize: "18px", color: "#4c1d95", margin: "8px 0 4px" }}>{currentCard.title}</h3>
                  <p style={{ fontSize: "14px", color: "#374151", background: "#f3e8ff", padding: "12px", borderRadius: "12px", marginBottom: "16px" }}>"{currentCard.hint}"</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSelectedOpt(opt);
                          if (opt === currentCard.verse) {
                            setTimeout(() => {
                              setSelectedOpt(null);
                              if (cardIndex + 1 < gameCards.length) {
                                setCardIndex(c => c + 1);
                              } else {
                                setGameDone(true);
                              }
                            }, 800);
                          }
                        }}
                        style={{
                          padding: "12px 16px",
                          borderRadius: "12px",
                          border: selectedOpt === opt ? (opt === currentCard.verse ? "2px solid #10b981" : "2px solid #ef4444") : "1px solid #d1d5db",
                          background: selectedOpt === opt ? (opt === currentCard.verse ? "#d1fae5" : "#fee2e2") : "#faf5ff",
                          fontWeight: "bold",
                          color: "#4c1d95",
                          cursor: "pointer",
                          textAlign: "left"
                        }}
                      >
                        {opt} {selectedOpt === opt && (opt === currentCard.verse ? " ✅ 맞았어요!" : " ❌ 다시 생각해보세요!")}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })()}

        {activeTab === "more" && <section className="bf-tab-page"><button className="bf-back-button" onClick={() => setActiveTab("home")}><ArrowLeft size={15} /> 홈으로 돌아가기</button><div className="bf-tab-title"><span className="bf-kicker">MORE TOGETHER</span><h1>더 많은 놀이</h1><p>성경 친구와 오늘의 이야기를 더 만들어 봐요.</p></div><section className="bf-orchestrator-card"><div><span className="bf-kicker"><Sparkles size={12} /> GEMINI ORCHESTRATOR</span><h3>오늘의 작은 콘텐츠를 새로 만들어 볼까요?</h3><p>성경 친구가 이야기와 퀴즈를 함께 준비해요.</p></div><button className="bf-secondary-button" onClick={createTodayContent} disabled={orchestrateMutation.isPending}>{orchestrateMutation.isPending ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />} 만들기</button></section>{generatedContent && <motion.section className="bf-generated-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><span className="bf-kicker">오늘 생성된 이야기</span><h3>{generatedContent.storyTitle}</h3><p>{generatedContent.storyHook}</p><div className="bf-lesson"><Lightbulb size={15} /><span><b>마음 보물</b>{generatedContent.storyLesson}</span></div><div className="bf-generated-quiz"><b>퀴즈</b><span>{generatedContent.quizQuestion}</span><small>정답: {generatedContent.quizAnswer}</small></div><p className="bf-encouragement">{generatedContent.encouragement}</p></motion.section>}</section>}

        {activeTab === "records" && (() => {
          const cardCount = treasureQuery.data?.length ?? 0;
          const badge = cardCount >= 5 ? { name: "✨ 말씀 보물 왕중왕", desc: "보물 카드 5장 이상 수집 완료!" } : cardCount >= 3 ? { name: "🌟 반짝이는 제자", desc: "보물 카드 3장 이상 수집!" } : cardCount >= 1 ? { name: "🌱 새싹 탐험가", desc: "첫 번째 보물 카드 획득!" } : { name: "🧭 준비된 탐험가", desc: "스토리와 퀴즈를 시작해 보세요!" };
          const handleShare = async () => {
            const shareText = `✨ [성경 친구] 나는 성경 친구와 함께 보물 카드 ${cardCount}장(${badge.name})을 모았어요! 함께 성경 속 보물을 찾아봐요. 📖`;
            if (navigator.share) {
              try {
                await navigator.share({ title: "성경 친구 보물 카드", text: shareText, url: window.location.href });
                return;
              } catch {}
            }
            try {
              await navigator.clipboard.writeText(shareText);
              alert("성경 친구 수집 기록이 클립보드에 복사되었어요! 친구에게 공유해 보세요.");
            } catch {
              alert(shareText);
            }
          };
          return (
            <section className="bf-tab-page bf-records-page">
              <button className="bf-back-button" onClick={() => setActiveTab("home")}><ArrowLeft size={15} /> 대화로 돌아가기</button>
              <div className="bf-tab-title"><span className="bf-kicker"><BookOpen size={12} /> MY JOURNEY</span><h1>나의 기록 & 보물 카드</h1><p>성경 친구와 함께 모은 말씀 보물과 작은 순간을 모아 봐요.</p></div>
              {user ? (
                <>
                  <div className="bf-records-card">
                    <div className="bf-records-mascot"><img src={FRIEND_MASCOT_URL} alt="" /></div>
                    <div><strong>{user.name ?? "성경 친구"}님의 마음 보물</strong><span>{scoreLabel}</span></div>
                    <button
                      className="bf-secondary-button"
                      onClick={() => {
                        const shareCardText = `🌟 [성경 친구 - 가족 공유 묵상] 오늘 우리 아이와 함께 나눈 말씀 보물과 기도를 전해요! 📖 함께 사랑을 나누어요 ✨`;
                        if (navigator.share) {
                          navigator.share({ title: "가족 묵상 카드", text: shareCardText, url: window.location.href }).catch(() => {});
                        } else {
                          navigator.clipboard.writeText(shareCardText).catch(() => {});
                          alert("가족 공유 묵상 카드 문구가 클립보드에 복사되었어요! 가족 단톡방에 공유해 보세요. 👨‍👩‍👧‍👦");
                        }
                      }}
                      style={{ marginLeft: "auto", padding: "6px 12px", fontSize: "11px", background: "#fef08a", color: "#854d0e", border: "1px solid #ca8a04", borderRadius: "8px", fontWeight: "bold" }}
                    >
                      💌 가족 묵상 공유
                    </button>
                  </div>
                  <div className="bf-records-stats">
                    <div><b>{messages.filter(message => message.role === "user").length}</b><span>나눈 질문</span></div>
                    <div><b>{score}</b><span>모은 별</span></div>
                    <div><b>{cardCount}</b><span>보물 카드</span></div>
                  </div>
                  <div className="bf-badge-banner" style={{ marginTop: "16px", background: "linear-gradient(135deg, #fef08a 0%, #fde047 100%)", padding: "16px", borderRadius: "16px", border: "2px solid #ca8a04", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 4px 12px rgba(202,138,4,0.15)" }}>
                    <div>
                      <span style={{ fontSize: "12px", fontWeight: "bold", color: "#854d0e", display: "block", marginBottom: "2px" }}>🏆 나의 현재 칭호 배지</span>
                      <h4 style={{ fontSize: "16px", fontWeight: "bold", color: "#713f12", margin: 0 }}>{badge.name}</h4>
                      <p style={{ fontSize: "12px", color: "#a16207", margin: "2px 0 0" }}>{badge.desc}</p>
                    </div>
                    <button className="bf-primary-button" onClick={handleShare} style={{ background: "#ca8a04", borderColor: "#a16207", padding: "8px 14px", fontSize: "13px" }}>친구에게 공유 📤</button>
                  </div>
                  <div className="bf-treasure-section" style={{ marginTop: "20px" }}>
                    <div className="bf-daily-draw-card" style={{ background: "linear-gradient(135deg, #ede9fe 0%, #f3e8ff 100%)", borderRadius: "18px", padding: "18px", border: "2px solid #8b5cf6", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 6px 16px rgba(139,92,246,0.15)" }}>
                      <div>
                        <span style={{ fontSize: "12px", fontWeight: "bold", color: "#6d28d9", display: "block", marginBottom: "2px" }}>🎁 오늘의 보물 뽑기</span>
                        <h4 style={{ fontSize: "16px", fontWeight: "bold", color: "#4c1d95", margin: 0 }}>하루 한 번 랜덤 말씀 카드</h4>
                        <p style={{ fontSize: "12px", color: "#5b21b6", margin: "3px 0 0" }}>오늘 나를 향한 하나님의 선물을 확인해 봐요!</p>
                      </div>
                      <button className="bf-primary-button" onClick={() => dailyDrawMutation.mutate()} disabled={dailyDrawMutation.isPending} style={{ background: "#7c3aed", borderColor: "#6d28d9", padding: "10px 16px", fontSize: "13px" }}>
                        {dailyDrawMutation.isPending ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />} 카드 뽑기 ✨
                      </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                      <div>
                        <h3 style={{ margin: 0 }}>🗺️ 수집한 말씀 보물 카드</h3>
                        <p style={{ fontSize: "12px", color: "#666", margin: "2px 0 0" }}>테마별로 카드를 모아보고 성경 친구 목소리로 들어요.</p>
                      </div>
                    </div>
                    <div className="bf-theme-filters" style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
                      {[
                        { key: "all", label: "전체" },
                        { key: "love", label: "❤️ 사랑" },
                        { key: "wisdom", label: "🌟 지혜" },
                        { key: "courage", label: "🛡️ 용기" },
                      ].map(theme => (
                        <button
                          key={theme.key}
                          onClick={() => setTreasureThemeFilter(theme.key as any)}
                          style={{
                            background: treasureThemeFilter === theme.key ? "#7c3aed" : "rgba(255,255,255,0.8)",
                            color: treasureThemeFilter === theme.key ? "#fff" : "#4b5563",
                            border: "1px solid",
                            borderColor: treasureThemeFilter === theme.key ? "#6d28d9" : "rgba(0,0,0,0.1)",
                            padding: "6px 12px",
                            borderRadius: "20px",
                            fontSize: "13px",
                            fontWeight: "bold",
                            cursor: "pointer",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                          }}
                        >
                          {theme.label}
                        </button>
                      ))}
                    </div>
                    <div className="bf-treasure-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px" }}>
                      {(() => {
                        const allCards = treasureQuery.data ?? [];
                        const filtered = allCards.filter(card => {
                          if (treasureThemeFilter === "all") return true;
                          const txt = (card.title + card.content + card.verse).toLowerCase();
                          if (treasureThemeFilter === "love") return txt.includes("사랑") || txt.includes("마음") || card.iconEmoji === "✨";
                          if (treasureThemeFilter === "wisdom") return txt.includes("지혜") || txt.includes("생각") || txt.includes("잠언") || card.iconEmoji === "🗺️";
                          if (treasureThemeFilter === "courage") return txt.includes("용기") || txt.includes("두려워") || txt.includes("믿음");
                          return true;
                        });
                        return filtered.length > 0 ? (
                          filtered.map(card => (
                            <div key={card.id} className="bf-treasure-card" onClick={() => setActiveTreasureCard(card)} style={{ background: "rgba(255,255,255,0.85)", padding: "14px", borderRadius: "14px", border: "1px solid rgba(234, 179, 8, 0.4)", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", cursor: "pointer", transition: "transform 0.15s ease" }} role="button" tabIndex={0}>
                              <span style={{ fontSize: "24px" }}>{card.iconEmoji}</span>
                              <h4 style={{ fontSize: "14px", fontWeight: "bold", margin: "6px 0 4px" }}>{card.title}</h4>
                              <p style={{ fontSize: "12px", color: "#666", marginBottom: "6px" }}>{card.verse}</p>
                              <small style={{ fontSize: "11px", color: "#444", display: "block" }}>{card.content}</small>
                            </div>
                          ))
                        ) : (
                          <p style={{ fontSize: "13px", color: "#777", gridColumn: "1 / -1", textAlign: "center", padding: "20px" }}>해당 테마에 모은 보물 카드가 없어요!</p>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="bf-prayer-section" style={{ marginTop: "24px", background: "rgba(255,255,255,0.9)", padding: "18px", borderRadius: "18px", border: "1px solid rgba(124, 58, 237, 0.3)", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                      <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}><MessageCircleHeart size={18} color="#7c3aed" /> 나만의 기도 노트</h3>
                      <button
                        className="bf-secondary-button"
                        onClick={async () => {
                          if (!("Notification" in window)) {
                            alert("이 브라우저는 알림 기능을 지원하지 않아요.");
                            return;
                          }
                          const perm = await Notification.requestPermission();
                          if (perm === "granted") {
                            alert("아침/저녁 말씀 알림이 켜졌어요! 🔔");
                            new Notification("성경 친구 🔔", { body: "오늘도 하나님과 따뜻한 대화를 나누어 볼까요?" });
                          } else {
                            alert("알림 권한이 거부되었거나 지원되지 않습니다.");
                          }
                        }}
                        style={{ padding: "6px 10px", fontSize: "11px", background: "#f3e8ff", color: "#7c3aed", border: "1px solid #d8b4fe", borderRadius: "8px" }}
                      >
                        🔔 말씀 알림 켜기
                      </button>
                    </div>
                    <p style={{ fontSize: "12px", color: "#666", margin: "0 0 12px" }}>성경 친구와 대화하며 느낀 감동이나 하나님께 드리고 싶은 기도를 적어보세요.</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
                      <input
                        type="text"
                        placeholder="성경 구절 (예: 시편 23:1)"
                        value={newPrayerVerse}
                        onChange={e => setNewPrayerVerse(e.target.value)}
                        style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid #d1d5db", fontSize: "13px", outline: "none" }}
                      />
                      <textarea
                        placeholder="오늘 하나님께 드리고 싶은 마음이나 감사한 일을 적어보세요..."
                        value={newPrayerText}
                        onChange={e => setNewPrayerText(e.target.value)}
                        rows={2}
                        style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid #d1d5db", fontSize: "13px", outline: "none", resize: "none" }}
                      />
                      <button
                        className="bf-primary-button"
                        onClick={() => {
                          if (!newPrayerText.trim()) {
                            alert("기도 내용을 적어주세요!");
                            return;
                          }
                          addPrayerNoteMutation.mutate({ noteText: newPrayerText.trim(), verseRef: newPrayerVerse.trim() || undefined });
                        }}
                        disabled={addPrayerNoteMutation.isPending}
                        style={{ alignSelf: "flex-end", padding: "8px 16px", fontSize: "13px" }}
                      >
                        {addPrayerNoteMutation.isPending ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />} 기도 노트 저장 📝
                      </button>
                    </div>
                    <div className="bf-prayer-list" style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                      {prayerNotesQuery.data && prayerNotesQuery.data.length > 0 ? (
                        prayerNotesQuery.data.map(note => (
                          <div key={note.id} style={{ background: "#fdf4ff", padding: "12px", borderRadius: "12px", border: "1px solid #f3e8ff" }}>
                            {note.verseRef && <small style={{ color: "#7c3aed", fontWeight: "bold", display: "block", marginBottom: "2px" }}>📖 {note.verseRef}</small>}
                            <p style={{ fontSize: "13px", color: "#374151", margin: 0, whiteSpace: "pre-wrap" }}>{note.noteText}</p>
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: "12px", color: "#888", textAlign: "center", padding: "10px" }}>아직 저장된 기도 노트가 없어요.</p>
                      )}
                    </div>
                  </div>
                  <button className="bf-primary-button full" style={{ marginTop: "20px" }} onClick={() => { setMessages(initialMessages); setSelectedStoryId(null); setActiveTab("home"); }}><Sparkles size={15} /> 새 대화 시작하기</button>
                </>
              ) : (
                <div className="bf-records-empty">
                  <div className="bf-records-mascot"><img src={FRIEND_MASCOT_URL} alt="" /></div>
                  <h2>기록을 남겨 볼까요?</h2>
                  <p>로그인하면 질문과 보물 카드, 칭호 배지를 다음에도 이어갈 수 있어요.</p>
                  <button className="bf-primary-button" onClick={() => startLogin()}>기록 저장하기 <ArrowRight size={14} /></button>
                  <button className="bf-secondary-button full" style={{ marginTop: 10 }} onClick={() => { setMessages(initialMessages); setSelectedStoryId(null); setActiveTab("home"); }}>새 대화 시작하기</button>
                </div>
              )}
            </section>
          );
        })()}
      </main>

      {activeTab !== "home" && <div className="bf-safe-note"><ShieldCheck size={16} /><p><b>함께 지켜요</b><br />마음이 아프거나 중요한 고민은 부모님, 선생님과 함께 이야기해요.</p></div>}
      <nav className="bf-bottom-nav" aria-label="주요 메뉴"><button className={activeTab === "home" ? "active" : ""} onClick={() => setActiveTab("home")}><Sparkles size={18} /><span>대화</span></button><button className={activeTab === "stories" ? "active" : ""} onClick={() => setActiveTab("stories")}><BookOpen size={18} /><span>스토리</span></button><button className={`bf-nav-center ${getVoiceMicStateClass({ isListening, isPressed: isMicPressed })}`} onPointerDown={event => { try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* Safari may reject synthetic capture */ } micPointerDownRef.current = true; setIsMicPressed(true); if (event.pointerType === "touch" || event.pointerType === "pen") { event.preventDefault(); beginListening(true); } }} onTouchStart={event => { event.preventDefault(); micPointerDownRef.current = true; setIsMicPressed(true); beginListening(true); }} onPointerUp={() => { micPointerDownRef.current = false; setIsMicPressed(false); }} onPointerCancel={() => { micPointerDownRef.current = false; setIsMicPressed(false); }} onTouchEnd={() => { micPointerDownRef.current = false; setIsMicPressed(false); }} onClick={toggleListening} aria-pressed={isListening} aria-label={getVoiceMicAriaLabel(isListening)} title={getVoiceMicAriaLabel(isListening)}>{isListening ? <Loader2 className="spin" size={22} /> : <Mic size={22} />}<span className="bf-nav-mic-label">{getVoiceMicLabel({ isListening, isPressed: isMicPressed })}</span></button><button className={activeTab === "game" ? "active" : ""} onClick={() => setActiveTab("game")}><Trophy size={18} /><span>퀴즈</span></button><button className={activeTab === "records" ? "active" : ""} onClick={() => setActiveTab("records")}><BookOpen size={18} /><span>기록</span></button></nav>

      <AnimatePresence>{selectedStory && <motion.div className="bf-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeStory}><motion.article className="bf-story-modal" initial={{ opacity: 0, y: 25, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: .98 }} onClick={event => event.stopPropagation()}><button className="bf-modal-close" onClick={closeStory} aria-label="닫기"><X size={17} /></button><div className={`bf-modal-art ${selectedStory.accent}`}><img src={selectedStory.imageUrl} alt="" /><span>✨</span></div><div className="bf-modal-body"><span className="bf-kicker">✦ 성경 이야기</span><h2>{selectedStory.title}</h2><p>{selectedStory.body}</p><div className="bf-lesson"><Lightbulb size={15} /><span><b>오늘의 마음 보물</b>{selectedStory.lesson}<small>{selectedStory.verse}</small></span></div><button className="bf-primary-button full" onClick={tellStory}><Volume2 size={15} /> 이야기 들려줘</button></div></motion.article></motion.div>}</AnimatePresence>
    </div>
  );
}

function ChatPanel({ messages, onSendMessage, isLoading, onSpeak, onSpeakNow }: { messages: Message[]; onSendMessage: (content: string) => void; isLoading: boolean; onSpeak: (request: VoiceRequest) => void; onSpeakNow: (request: VoiceRequest) => void }) {
  const [draft, setDraft] = useState("");
  const submit = () => {
    if (!draft.trim() || isLoading) return;
    onSendMessage(draft);
    setDraft("");
  };
  return <div className="bf-chat-panel"><div className="bf-chat-messages" aria-live="polite">{messages.filter(message => message.role !== "system").map((message, index) => <div className={`bf-chat-message ${message.role === "user" ? "user" : "assistant"}`} key={`${message.role}-${index}`}><span className="bf-chat-avatar">{message.role === "user" ? "나" : <Sparkles size={12} />}</span><p>{message.content}</p>{message.role === "assistant" && <button className="bf-answer-speak" onClick={() => onSpeakNow({ text: message.content, speaker: "CHILD_FRIEND", emotion: "따뜻하고 또렷한 다시 듣기" })} aria-label="이 답변 듣기" title="Gemini 음성으로 다시 듣기"><Volume2 size={15} /></button>}</div>)}{isLoading && <div className="bf-chat-loading"><span /><span /><span /> 성경 친구가 생각하고 있어요…</div>}</div><div className="bf-chat-composer"><textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder="궁금한 것을 글로 물어봐요" aria-label="성경 질문 입력" rows={1} /><button onClick={submit} disabled={!draft.trim() || isLoading} aria-label="질문 보내기"><Send size={16} /></button></div><div className="bf-chat-suggestions"><button onClick={() => onSendMessage("노아의 방주는 어떤 이야기야?")}>노아의 방주</button><button onClick={() => onSendMessage("하나님은 나를 사랑하시나요?")}>하나님의 사랑</button></div></div>;
}

function QuizPanel({ quiz, quizStarted, quizAnswered, quizCorrect, quizLoading, quizError, onStart, onAnswer, onNext, scoreLabel }: { quiz: { question: string; options: string[]; answer: number; explanation: string } | undefined; quizStarted: boolean; quizAnswered: boolean; quizCorrect: boolean; quizLoading: boolean; quizError: boolean; onStart: () => void; onAnswer: (index: number) => void; onNext: () => void; scoreLabel: string }) {
  if (!quizStarted) return <div className="bf-quiz-empty"><div className="bf-treasure">🗺️</div><h2>말씀 보물찾기</h2><p>문제를 풀고 반짝이는 별을 모아봐요.</p><button className="bf-primary-button" onClick={onStart}>첫 모험 시작 <ArrowRight size={14} /></button></div>;
  if (quizLoading) return <div className="bf-quiz-empty"><Loader2 className="spin" size={24} /><h2>문제를 준비하고 있어요</h2><p>잠깐만 기다리면 보물이 나타나요.</p></div>;
  if (quizError || !quiz) return <div className="bf-quiz-empty"><ShieldCheck size={27} /><h2>문제를 불러오지 못했어요</h2><p>잠시 뒤 다시 시도해 주세요.</p><button className="bf-primary-button" onClick={onStart}><RotateCcw size={14} /> 다시 시작</button></div>;
  return <div className="bf-quiz-play"><div className="bf-quiz-status"><span>오늘의 보물 1/1</span><b><Star size={13} fill="currentColor" /> {scoreLabel}</b></div><h2>{quiz.question}</h2><div className="bf-quiz-options">{quiz.options.map((option, index) => <button key={option} className={quizAnswered ? index === quiz.answer ? "correct" : "" : ""} disabled={quizAnswered} onClick={() => onAnswer(index)}><span>{String.fromCharCode(65 + index)}</span>{option}{quizAnswered && index === quiz.answer && <Check size={15} />}</button>)}</div>{quizAnswered && <motion.div className={`bf-feedback ${quizCorrect ? "correct" : ""}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><strong>{quizCorrect ? "정답이야! 정말 멋져요!" : "괜찮아요, 함께 다시 알아봐요."}</strong><p>{quiz.explanation}</p><button className="bf-primary-button" onClick={onNext}><RotateCcw size={14} /> 다시 도전하기</button></motion.div>}</div>;
}
