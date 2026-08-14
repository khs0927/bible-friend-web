import React from "react";

type Message = { role: "system" | "user" | "assistant"; content: string };
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { getScoreLabel } from "@/lib/scoreStatus";
import { VoiceStatusBadge } from "@/components/VoiceStatusBadge";
import { getVoiceStateFromPlaybackError, getVoiceStateFromPlaybackStarted, type VoiceStatus } from "@/lib/voiceStatus";
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
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AudioPlaybackQueue, type TTSMutation, type VoiceRequest } from "@/lib/audioPlaybackQueue";

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
  const orchestrateMutation = trpc.ai.orchestrate.useMutation();
  const addScoreMutation = trpc.game.addScore.useMutation({
    onSuccess: () => scoreQuery.refetch(),
  });
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("ready");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "stories" | "game">("home");
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizCorrect, setQuizCorrect] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<{ storyTitle: string; storyHook: string; storyLesson: string; quizQuestion: string; quizAnswer: string; encouragement: string } | null>(null);
  const recognitionRef = useRef<any>(null);
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
      setIsListening(true);
    };
    recognition.onend = () => {
      setIsListening(false);
      skipNextVoiceClickRef.current = false;
    };
    recognition.onerror = () => {
      setIsListening(false);
      skipNextVoiceClickRef.current = false;
    };
    recognition.onresult = (event: any) => {
      const text = event.results[0]?.[0]?.transcript?.trim();
      if (text) handleSend(text);
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
      const result = await askMutation.mutateAsync({ question, storyId: selectedStoryContext });
      setMessages(current => [...current, { role: "assistant", content: result.answer }]);
      speakText({ text: result.answer, speaker: "CHILD_FRIEND", emotion: "따뜻한 격려", context: selectedStory?.title });
    } catch {
      const fallback = "잠깐 연결이 쉬어 가고 있어요. 그래도 하나님은 우리 곁에 계셔요. 조금 뒤에 다시 물어봐 줄래?";
      setMessages(current => [...current, { role: "assistant", content: fallback }]);
      speakText({ text: fallback, speaker: "CHILD_FRIEND", emotion: "안심시키는 따뜻함" });
    }
  };

  const beginListening = (fromPointer = false) => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      speakText({ text: "이 브라우저에서는 음성 인식을 사용할 수 없어요. 아래 글 입력창에 질문을 적어도 괜찮아요.", speaker: "CHILD_FRIEND", emotion: "친절한 안내" });
      return;
    }
    if (isListening || skipNextVoiceClickRef.current) return;
    audioQueueRef.current?.prime();
    skipNextVoiceClickRef.current = fromPointer;
    try {
      recognition.start();
    } catch {
      skipNextVoiceClickRef.current = false;
    }
  };

  const toggleListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      beginListening(false);
      return;
    }
    if (skipNextVoiceClickRef.current) {
      skipNextVoiceClickRef.current = false;
      return;
    }
    if (isListening) recognition.stop();
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
      speakText({ text: "정답이야! 정말 멋지게 생각했어!", speaker: "CHILD_FRIEND", emotion: "기쁘고 신나는 축하" });
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
      <header className="bf-topbar">
        <a href="#top" className="bf-brand" aria-label="성경 친구 홈">
          <span className="bf-brand-mark"><Sparkles size={18} /></span>
          <span><strong>성경 친구</strong><small>작은 마음에 닿는 하나님 이야기</small></span>
        </a>
        <div className="bf-header-actions">
          <span className="bf-voice-ready"><i />Gemini 한국어 음성 준비됨</span>
          {user ? <span className="bf-user-chip">{user.name ?? "친구"}</span> : <button className="bf-login-button" onClick={() => startLogin()}>기록 저장하기</button>}
        </div>
      </header>

      <main id="top" className="bf-main">
        {activeTab === "home" && (
          <>
            <motion.section className="bf-hero" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }}>
              <div className="bf-hero-copy">
                <span className="bf-kicker"><Zap size={12} /> 오늘의 작은 모험</span>
                <h1>궁금한 마음 그대로,<br /><em>하나님께 물어봐요.</em></h1>
                <p>성경 친구가 어려운 이야기도 따뜻하고 쉬운 말로 들려줄게요.</p>
                <div className="bf-hero-pills"><span><Heart size={13} fill="currentColor" /> 사랑으로</span><span><Sparkles size={13} /> 재미있게</span></div>
              </div>
              <div className="bf-hero-art" aria-hidden="true"><span>✦</span><span>✧</span><div className="bf-character-placeholder">친구</div></div>
            </motion.section>

            <section className="bf-section bf-chat-section">
              <div className="bf-section-heading"><span className="bf-section-icon violet"><MessageCircleHeart size={18} /></span><div><small>VOICE CHAT</small><h2>성경 친구와 이야기해요</h2></div><button className={`bf-round-icon ${voiceEnabled ? "is-on" : ""}`} onClick={() => setVoiceEnabled(value => !value)} aria-label="답변 음성 켜기/끄기">{voiceEnabled ? <Volume2 size={16} /> : <Pause size={16} />}</button></div>
              <HomeVoiceStatus enabled={voiceEnabled} status={voiceStatus} error={voiceError} />
              <div className="bf-chat-surface">
                <ChatPanel messages={messages} onSendMessage={handleSend} isLoading={askMutation.isPending} onSpeak={speakText} onSpeakNow={speakNow} />
                <div className="bf-voice-row"><button className={`bf-mic-button ${isListening ? "listening" : ""}`} onPointerDown={event => { if (event.pointerType === "touch" || event.pointerType === "pen") { event.preventDefault(); beginListening(true); } }} onClick={toggleListening} aria-label={isListening ? "음성 인식 중지" : "마이크로 질문하기"}>{isListening ? <Loader2 className="spin" size={19} /> : <Mic size={19} />}</button><span>{isListening ? "듣고 있어요… 천천히 말해 주세요" : "마이크를 누르고 말해 보세요"}</span><button className="bf-text-send" onClick={() => document.querySelector<HTMLTextAreaElement>(".bf-chat-panel textarea")?.focus()} aria-label="글 입력으로 질문하기"><Send size={16} /></button></div>
              </div>
            </section>

            <section className="bf-section">
              <div className="bf-section-heading"><span className="bf-section-icon coral"><BookOpen size={17} /></span><div><small>PICK A STORY</small><h2>오늘은 어떤 이야기를 만날까요?</h2></div><button className="bf-more-link" onClick={() => setActiveTab("stories")}>모두 보기 <ArrowRight size={13} /></button></div>
              <div className="bf-story-scroller">
                {storiesQuery.isLoading && <div className="bf-inline-state"><Loader2 className="spin" size={16} /> 이야기를 준비하고 있어요…</div>}
                {storiesQuery.isError && <div className="bf-inline-state error"><ShieldCheck size={16} /> 이야기를 잠시 불러오지 못했어요. 새로고침 후 다시 만나 주세요.</div>}
                {!storiesQuery.isLoading && !storiesQuery.isError && stories.length === 0 && <div className="bf-inline-state">아직 준비된 이야기가 없어요.</div>}
                {!storiesQuery.isLoading && !storiesQuery.isError && stories.map((story, index) => <motion.button key={story.id} className={`bf-story-card ${story.accent}`} onClick={() => openStory(story.id)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .07 }}><div className="bf-story-art"><img src={story.imageUrl} alt="" onError={event => { event.currentTarget.style.display = "none"; }} /><span>{story.title === "노아의 방주" ? "🌈" : story.title === "다윗과 골리앗" ? "🪨" : story.title === "예수님의 사랑" ? "❤️" : story.title === "천지창조" ? "🌍" : "⭐"}</span></div><div className="bf-story-copy"><strong>{story.title}</strong><span>{story.subtitle}</span><small>이야기 열기 <ArrowRight size={11} /></small></div></motion.button>)}
              </div>
            </section>

            <section className="bf-game-banner">
              <span className="bf-game-spark">✦</span><span className="bf-game-spark second">✧</span>
              <div className="bf-game-topline"><span><Trophy size={13} /> PLAY & LEARN</span><b>{scoreLabel}</b></div>
              <h2>말씀 보물찾기</h2><p>성경 속 보물을 찾고 별을 모아봐요!</p>
              <div className="bf-treasure">🗺️</div><p className="bf-game-note">오늘의 질문을 풀면 <strong>반짝이는 별</strong>을 얻어요.</p>
              <button className="bf-primary-button" onClick={startQuiz}>모험 시작 <ArrowRight size={14} /></button>
            </section>

            <section className="bf-orchestrator-card"><div><span className="bf-kicker"><Sparkles size={12} /> GEMINI ORCHESTRATOR</span><h3>오늘의 작은 콘텐츠를 새로 만들어 볼까요?</h3><p>성경 친구가 이야기와 퀴즈를 함께 준비해요.</p></div><button className="bf-secondary-button" onClick={createTodayContent} disabled={orchestrateMutation.isPending}>{orchestrateMutation.isPending ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />} 만들기</button></section>
            {generatedContent && <motion.section className="bf-generated-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><span className="bf-kicker">오늘 생성된 이야기</span><h3>{generatedContent.storyTitle}</h3><p>{generatedContent.storyHook}</p><div className="bf-lesson"><Lightbulb size={15} /><span><b>마음 보물</b>{generatedContent.storyLesson}</span></div><div className="bf-generated-quiz"><b>퀴즈</b><span>{generatedContent.quizQuestion}</span><small>정답: {generatedContent.quizAnswer}</small></div><p className="bf-encouragement">{generatedContent.encouragement}</p></motion.section>}
          </>
        )}

        {activeTab === "stories" && <section className="bf-tab-page"><button className="bf-back-button" onClick={() => setActiveTab("home")}><ArrowLeft size={15} /> 홈으로 돌아가기</button><div className="bf-tab-title"><span className="bf-kicker">STORY GARDEN</span><h1>성경 이야기 정원</h1><p>마음에 닿는 이야기를 골라 천천히 만나 보세요.</p></div><div className="bf-story-grid">{stories.map(story => <button key={story.id} className={`bf-story-card ${story.accent}`} onClick={() => openStory(story.id)}><div className="bf-story-art"><img src={story.imageUrl} alt="" /><span>✨</span></div><div className="bf-story-copy"><strong>{story.title}</strong><span>{story.subtitle}</span><small>이야기 열기 <ArrowRight size={11} /></small></div></button>)}</div></section>}

        {activeTab === "game" && <section className="bf-tab-page"><button className="bf-back-button" onClick={() => setActiveTab("home")}><ArrowLeft size={15} /> 홈으로 돌아가기</button><div className="bf-tab-title"><span className="bf-kicker">PLAY & LEARN</span><h1>말씀 보물찾기</h1><p>한 문제씩 풀며 말씀 속 보물을 찾아요.</p></div><QuizPanel quiz={quiz} quizStarted={quizStarted} quizAnswered={quizAnswered} quizCorrect={quizCorrect} quizLoading={quizQuery.isLoading} quizError={quizQuery.isError} onStart={startQuiz} onAnswer={answerQuiz} onNext={nextQuiz} scoreLabel={scoreLabel} /> </section>}
      </main>

      <div className="bf-safe-note"><ShieldCheck size={16} /><p><b>함께 지켜요</b><br />마음이 아프거나 중요한 고민은 부모님, 선생님과 함께 이야기해요.</p></div>
      <nav className="bf-bottom-nav" aria-label="주요 메뉴"><button className={activeTab === "home" ? "active" : ""} onClick={() => setActiveTab("home")}><Sparkles size={17} /><span>홈</span></button><button className={activeTab === "stories" ? "active" : ""} onClick={() => setActiveTab("stories")}><BookOpen size={17} /><span>이야기</span></button><button className="bf-nav-center" onClick={toggleListening} aria-label="음성 대화"><Mic size={20} /></button><button className={activeTab === "game" ? "active" : ""} onClick={() => setActiveTab("game")}><Trophy size={17} /><span>놀이터</span></button><button onClick={() => user ? setMessages(initialMessages) : startLogin()}><Heart size={17} /><span>{user ? "새 대화" : "기록"}</span></button></nav>

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
