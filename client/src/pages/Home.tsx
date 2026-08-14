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
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("ready");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isMicPressed, setIsMicPressed] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"home" | "stories" | "game" | "more" | "records">("home");
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
                <div className={`bf-voice-row ${isListening ? "is-listening" : ""} ${isMicPressed ? "is-pressed" : ""}`}><button className={`bf-mic-button ${isListening ? "listening" : ""} ${isMicPressed ? "pressed" : ""}`} onPointerDown={event => { try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* Safari may reject synthetic capture */ } micPointerDownRef.current = true; setIsMicPressed(true); if (event.pointerType === "touch" || event.pointerType === "pen") { event.preventDefault(); beginListening(true); } }} onTouchStart={event => { event.preventDefault(); micPointerDownRef.current = true; setIsMicPressed(true); beginListening(true); }} onPointerUp={() => { micPointerDownRef.current = false; setIsMicPressed(false); }} onPointerCancel={() => { micPointerDownRef.current = false; setIsMicPressed(false); }} onTouchEnd={() => { micPointerDownRef.current = false; setIsMicPressed(false); }} onClick={toggleListening} aria-pressed={isListening} aria-label={isListening ? "음성 인식 중지" : "마이크로 질문하기"}>{isListening ? <Loader2 className="spin" size={27} /> : <Mic size={27} />}<span className="bf-mic-pulse-label">{isListening ? "듣는 중" : "말하기"}</span></button><div className={`bf-mic-hint ${isListening ? "is-listening" : ""}`}><strong>{isListening ? "지금 듣고 있어요" : "마이크를 누르고 말해 보세요"}</strong><small>{micError ?? (isListening ? "천천히 말해 주세요" : "한 번 누르면 바로 시작해요")}</small></div><button className="bf-text-send" onClick={() => document.querySelector<HTMLTextAreaElement>(".bf-chat-panel textarea")?.focus()} aria-label="글 입력으로 질문하기"><Send size={17} /></button></div>
              </div>
            </section>
          </section>
        )}

        {activeTab === "stories" && <section className="bf-tab-page"><button className="bf-back-button" onClick={() => setActiveTab("home")}><ArrowLeft size={15} /> 홈으로 돌아가기</button><div className="bf-tab-title"><span className="bf-kicker">STORY GARDEN</span><h1>성경 이야기 정원</h1><p>마음에 닿는 이야기를 골라 천천히 만나 보세요.</p></div><div className="bf-story-grid">{stories.map(story => <button key={story.id} className={`bf-story-card ${story.accent}`} onClick={() => openStory(story.id)}><div className="bf-story-art"><img src={story.imageUrl} alt="" /><span>✨</span></div><div className="bf-story-copy"><strong>{story.title}</strong><span>{story.subtitle}</span><small>이야기 열기 <ArrowRight size={11} /></small></div></button>)}</div></section>}

        {activeTab === "game" && <section className="bf-tab-page"><button className="bf-back-button" onClick={() => setActiveTab("home")}><ArrowLeft size={15} /> 홈으로 돌아가기</button><div className="bf-tab-title"><span className="bf-kicker">PLAY & LEARN</span><h1>말씀 보물찾기</h1><p>한 문제씩 풀며 말씀 속 보물을 찾아요.</p></div><QuizPanel quiz={quiz} quizStarted={quizStarted} quizAnswered={quizAnswered} quizCorrect={quizCorrect} quizLoading={quizQuery.isLoading} quizError={quizQuery.isError} onStart={startQuiz} onAnswer={answerQuiz} onNext={nextQuiz} scoreLabel={scoreLabel} /> </section>}

        {activeTab === "more" && <section className="bf-tab-page"><button className="bf-back-button" onClick={() => setActiveTab("home")}><ArrowLeft size={15} /> 홈으로 돌아가기</button><div className="bf-tab-title"><span className="bf-kicker">MORE TOGETHER</span><h1>더 많은 놀이</h1><p>성경 친구와 오늘의 이야기를 더 만들어 봐요.</p></div><section className="bf-orchestrator-card"><div><span className="bf-kicker"><Sparkles size={12} /> GEMINI ORCHESTRATOR</span><h3>오늘의 작은 콘텐츠를 새로 만들어 볼까요?</h3><p>성경 친구가 이야기와 퀴즈를 함께 준비해요.</p></div><button className="bf-secondary-button" onClick={createTodayContent} disabled={orchestrateMutation.isPending}>{orchestrateMutation.isPending ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />} 만들기</button></section>{generatedContent && <motion.section className="bf-generated-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><span className="bf-kicker">오늘 생성된 이야기</span><h3>{generatedContent.storyTitle}</h3><p>{generatedContent.storyHook}</p><div className="bf-lesson"><Lightbulb size={15} /><span><b>마음 보물</b>{generatedContent.storyLesson}</span></div><div className="bf-generated-quiz"><b>퀴즈</b><span>{generatedContent.quizQuestion}</span><small>정답: {generatedContent.quizAnswer}</small></div><p className="bf-encouragement">{generatedContent.encouragement}</p></motion.section>}</section>}

        {activeTab === "records" && <section className="bf-tab-page bf-records-page"><button className="bf-back-button" onClick={() => setActiveTab("home")}><ArrowLeft size={15} /> 대화로 돌아가기</button><div className="bf-tab-title"><span className="bf-kicker"><BookOpen size={12} /> MY JOURNEY</span><h1>나의 기록</h1><p>성경 친구와 함께 만든 작은 순간을 모아 봐요.</p></div>{user ? <><div className="bf-records-card"><div className="bf-records-mascot"><img src={FRIEND_MASCOT_URL} alt="" /></div><div><strong>{user.name ?? "성경 친구"}님의 마음 보물</strong><span>{scoreLabel}</span></div></div><div className="bf-records-stats"><div><b>{messages.filter(message => message.role === "user").length}</b><span>나눈 질문</span></div><div><b>{messages.filter(message => message.role === "assistant").length}</b><span>친구의 답변</span></div><div><b>{score}</b><span>모은 별</span></div></div><button className="bf-primary-button full" onClick={() => { setMessages(initialMessages); setSelectedStoryId(null); setActiveTab("home"); }}><Sparkles size={15} /> 새 대화 시작하기</button></> : <div className="bf-records-empty"><div className="bf-records-mascot"><img src={FRIEND_MASCOT_URL} alt="" /></div><h2>기록을 남겨 볼까요?</h2><p>로그인하면 질문과 별을 다음에도 이어갈 수 있어요.</p><button className="bf-primary-button" onClick={() => startLogin()}>기록 저장하기 <ArrowRight size={14} /></button><button className="bf-secondary-button full" style={{ marginTop: 10 }} onClick={() => { setMessages(initialMessages); setSelectedStoryId(null); setActiveTab("home"); }}>새 대화 시작하기</button></div>}</section>}
      </main>

      {activeTab !== "home" && <div className="bf-safe-note"><ShieldCheck size={16} /><p><b>함께 지켜요</b><br />마음이 아프거나 중요한 고민은 부모님, 선생님과 함께 이야기해요.</p></div>}
      <nav className="bf-bottom-nav" aria-label="주요 메뉴"><button className={activeTab === "home" ? "active" : ""} onClick={() => setActiveTab("home")}><Sparkles size={18} /><span>대화</span></button><button className={activeTab === "stories" ? "active" : ""} onClick={() => setActiveTab("stories")}><BookOpen size={18} /><span>스토리</span></button><button className="bf-nav-center" onClick={toggleListening} aria-label="음성 대화 시작"><Mic size={21} /></button><button className={activeTab === "game" ? "active" : ""} onClick={() => setActiveTab("game")}><Trophy size={18} /><span>퀴즈</span></button><button className={activeTab === "records" ? "active" : ""} onClick={() => setActiveTab("records")}><BookOpen size={18} /><span>기록</span></button></nav>

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
