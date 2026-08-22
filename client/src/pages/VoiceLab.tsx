import * as supertonicHelper from "@/lib/supertonicHelper";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useRef, useState } from "react";
import "./voice-lab.css";

const HF_BASE = "https://huggingface.co/Supertone/supertonic-3/resolve/main";
const ONNX_BASE = `${HF_BASE}/onnx`;
const ORT_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/ort.min.js";
const ORT_WASM_BASE = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/";

const VOICES = [
  { id: "F1", label: "F1", note: "맑고 밝음" },
  { id: "F2", label: "F2", note: "포근하고 차분함" },
  { id: "F3", label: "F3", note: "친근하고 자연스러움" },
  { id: "F4", label: "F4", note: "밝고 부드러움" },
  { id: "F5", label: "F5", note: "또렷하고 산뜻함" },
] as const;

type VoiceId = (typeof VOICES)[number]["id"];
type EmotionId = "sweet" | "comfort" | "joy" | "story" | "prayer";

type RuntimeState = {
  helper: any;
  tts: any;
  backend: "webgpu" | "wasm";
  styles: Map<string, any>;
};

const EMOTIONS: Array<{
  id: EmotionId;
  label: string;
  description: string;
  speed: number;
}> = [
  { id: "sweet", label: "달달하게", description: "미소가 느껴지는 부드러운 기본 톤", speed: 0.95 },
  { id: "comfort", label: "포근한 위로", description: "조금 천천히, 안심시키듯", speed: 0.91 },
  { id: "joy", label: "기쁜 마음", description: "조금 더 밝고 경쾌하게", speed: 1.02 },
  { id: "story", label: "이야기 친구", description: "호기심 있게, 너무 과장하지 않게", speed: 0.98 },
  { id: "prayer", label: "차분한 기도", description: "호흡을 두고 차분하게", speed: 0.89 },
];

const SAMPLE_TEXT = "하나님은 너를 정말 사랑하신단다. 오늘도 네 마음을 알고 계시고, 언제나 네 곁에 함께하셔.";

let ortRuntimePromise: Promise<any> | null = null;

function isIOSLike() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function loadOrtRuntime() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("브라우저에서만 로컬 음성 엔진을 사용할 수 있어요."));
  }

  const currentOrt = (window as any).ort;
  if (currentOrt?.InferenceSession) return Promise.resolve(currentOrt);

  if (!ortRuntimePromise) {
    ortRuntimePromise = new Promise((resolve, reject) => {
      const selector = 'script[data-voice-lab-ort="true"]';
      let script = document.querySelector<HTMLScriptElement>(selector);

      const cleanup = () => {
        script?.removeEventListener("load", onLoad);
        script?.removeEventListener("error", onError);
      };
      const onLoad = () => {
        cleanup();
        const ort = (window as any).ort;
        if (ort?.InferenceSession) {
          resolve(ort);
        } else {
          reject(new Error("ONNX Runtime 스크립트는 열렸지만 실행 엔진을 찾지 못했어요."));
        }
      };
      const onError = () => {
        cleanup();
        script?.remove();
        reject(new Error("iPhone 호환 ONNX Runtime 스크립트를 불러오지 못했어요."));
      };

      if (!script) {
        script = document.createElement("script");
        script.src = ORT_SCRIPT_URL;
        script.async = true;
        script.dataset.voiceLabOrt = "true";
        document.head.appendChild(script);
      }

      if ((window as any).ort?.InferenceSession) {
        onLoad();
        return;
      }

      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
    });
  }

  return ortRuntimePromise.catch(error => {
    ortRuntimePromise = null;
    throw error;
  });
}

function decorateText(text: string, emotion: EmotionId, sweetness: number) {
  const clean = text.trim();
  if (!clean) return clean;

  const softPause = sweetness >= 65 ? " <breath> " : " ";

  if (emotion === "joy") {
    return sweetness >= 55 ? `<laugh> ${clean}` : clean;
  }
  if (emotion === "comfort") {
    return sweetness >= 35 ? `<breath> ${clean}` : clean;
  }
  if (emotion === "prayer") {
    return `<breath> ${clean}`;
  }
  if (emotion === "story") {
    return clean.replace(/([.!?])\s+/g, `$1${softPause}`);
  }
  return sweetness >= 45 ? `<breath> ${clean}` : clean;
}

function resolvedSpeed(emotion: EmotionId, sweetness: number) {
  const base = EMOTIONS.find(item => item.id === emotion)?.speed ?? 0.95;
  const sweetAdjustment = ((sweetness - 50) / 50) * -0.035;
  return Math.max(0.84, Math.min(1.06, base + sweetAdjustment));
}

export default function VoiceLab() {
  const [voiceId, setVoiceId] = useState<VoiceId>("F1");
  const [emotion, setEmotion] = useState<EmotionId>("sweet");
  const [sweetness, setSweetness] = useState(68);
  const [text, setText] = useState(SAMPLE_TEXT);
  const [status, setStatus] = useState("아직 모델을 불러오지 않았어요.");
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [backend, setBackend] = useState<string>("-");
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runtimeRef = useRef<RuntimeState | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsMutation = trpc.tts.synthesize.useMutation();

  const speed = useMemo(() => resolvedSpeed(emotion, sweetness), [emotion, sweetness]);
  const decoratedPreview = useMemo(() => decorateText(text, emotion, sweetness), [text, emotion, sweetness]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function ensureRuntime() {
    if (runtimeRef.current) return runtimeRef.current;
    setIsLoading(true);
    setError(null);
    setStatus("iPhone 호환 로컬 음성 런타임을 준비하고 있어요…");
    setProgress(2);

    try {
      const ort: any = await loadOrtRuntime();
      ort.env.wasm.wasmPaths = ORT_WASM_BASE;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;

      const helper: any = supertonicHelper;
      helper.configureOrt(ort);
      setProgress(4);
      setStatus("Supertonic 음성 모델을 불러오는 중이에요. 처음 한 번은 시간이 걸릴 수 있어요…");

      const loadOptions = (provider: "webgpu" | "wasm") => ({
        executionProviders: [provider],
        graphOptimizationLevel: "all",
      });
      const onProgress = (_name: string, current: number, total: number) => {
        setProgress(Math.max(4, Math.min(88, Math.round((current / total) * 84))));
      };

      let result: any;
      let selectedBackend: "webgpu" | "wasm" = "wasm";
      const canTryWebGpu = !isIOSLike() && typeof navigator !== "undefined" && "gpu" in navigator;

      if (canTryWebGpu) {
        try {
          result = await helper.loadTextToSpeech(ONNX_BASE, loadOptions("webgpu"), onProgress);
          selectedBackend = "webgpu";
        } catch (webGpuError) {
          console.info("[Voice Lab] WebGPU unavailable; using conservative WASM", webGpuError);
        }
      }

      if (!result) {
        result = await helper.loadTextToSpeech(ONNX_BASE, loadOptions("wasm"), onProgress);
        selectedBackend = "wasm";
      }

      const runtime: RuntimeState = {
        helper,
        tts: result.textToSpeech,
        backend: selectedBackend,
        styles: new Map(),
      };
      runtimeRef.current = runtime;
      setBackend(selectedBackend);
      setProgress(92);
      setStatus("모델 준비 완료. 첫 생성은 음성 스타일을 추가로 불러와요.");
      return runtime;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(`로컬 음성 엔진을 불러오지 못했어요: ${message}`);
      setStatus("로컬 엔진 준비 실패");
      throw cause;
    } finally {
      setIsLoading(false);
    }
  }

  async function ensureStyle(runtime: RuntimeState, id: VoiceId) {
    const cached = runtime.styles.get(id);
    if (cached) return cached;
    setStatus(`${id} 음색을 불러오는 중…`);
    const style = await runtime.helper.loadVoiceStyle([`${HF_BASE}/voice_styles/${id}.json`]);
    runtime.styles.set(id, style);
    return style;
  }

  async function generateLocal() {
    if (!text.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    const startedAt = performance.now();

    try {
      const runtime = await ensureRuntime();
      const style = await ensureStyle(runtime, voiceId);
      setProgress(94);
      setStatus(`${EMOTIONS.find(item => item.id === emotion)?.label} 톤으로 만드는 중…`);
      const { wav, duration } = await runtime.tts.call(
        decorateText(text, emotion, sweetness),
        "ko",
        style,
        8,
        speed,
        0.18,
        (step: number, total: number) => setProgress(94 + Math.round((step / total) * 5)),
      );
      const wavLength = Math.floor(runtime.tts.sampleRate * duration[0]);
      const trimmed = wav.slice(0, wavLength);
      const buffer = runtime.helper.writeWavFile(trimmed, runtime.tts.sampleRate);
      const nextUrl = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));

      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(nextUrl);
      setLastMs(Math.round(performance.now() - startedAt));
      setProgress(100);
      setStatus("완료. 실제 iPhone에서 끊김과 감정 느낌을 확인해 주세요.");
      requestAnimationFrame(() => {
        audioRef.current?.play().catch(() => undefined);
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(`생성 실패: ${message}`);
      setStatus("생성에 실패했어요. 이 경우 production에는 적용하지 않습니다.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function playLedaReference() {
    if (!text.trim()) return;
    setError(null);
    setStatus("현재 Gemini Leda 기준 음성을 한 번 생성하고 있어요…");
    try {
      const result: any = await ttsMutation.mutateAsync({
        text: text.trim(),
        speaker: "CHILD_FRIEND",
        emotion: "따뜻하고 친근하며 달콤한 격려",
        style: "아이에게 살짝 미소 지으며 부드럽고 또렷하게 읽어 줘.",
        speed: 0.95,
      });
      if (!result?.success || !result?.audioBase64) throw new Error(result?.error ?? "Leda audio unavailable");
      const binary = atob(result.audioBase64);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const nextUrl = URL.createObjectURL(new Blob([bytes], { type: result.mimeType ?? "audio/wav" }));
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(nextUrl);
      setStatus(`Leda 기준 재생 준비 완료 (${result.model ?? "Gemini"}).`);
      requestAnimationFrame(() => audioRef.current?.play().catch(() => undefined));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(`Leda 기준 음성을 준비하지 못했어요: ${message}`);
    }
  }

  return (
    <main className="voice-lab-page">
      <section className="voice-lab-shell">
        <header className="voice-lab-header">
          <div>
            <span className="voice-lab-kicker">BIBLE FRIEND · LOCAL VOICE LAB</span>
            <h1>성경친구 달달한 음성 실험실</h1>
            <p>Production은 건드리지 않고, iPhone에서 통과한 음색만 본 앱에 적용합니다.</p>
          </div>
          <a href="/" className="voice-lab-home">대화탭으로</a>
        </header>

        <div className="voice-lab-note">
          <strong>무료 운영 원칙</strong>
          <span>Supertonic 생성은 브라우저 안에서 실행됩니다. 서버 TTS 호출은 Leda 비교 버튼을 눌렀을 때만 발생합니다.</span>
        </div>

        <section className="voice-lab-panel">
          <h2>1. 음색 선택</h2>
          <div className="voice-lab-voice-grid">
            {VOICES.map(voice => (
              <button
                key={voice.id}
                type="button"
                className={voiceId === voice.id ? "is-active" : ""}
                onClick={() => setVoiceId(voice.id)}
              >
                <strong>{voice.label}</strong>
                <span>{voice.note}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="voice-lab-panel">
          <h2>2. 아이에게 어울리는 감정</h2>
          <div className="voice-lab-emotions">
            {EMOTIONS.map(item => (
              <button
                key={item.id}
                type="button"
                className={emotion === item.id ? "is-active" : ""}
                onClick={() => setEmotion(item.id)}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>

          <label className="voice-lab-slider">
            <span><strong>달달함</strong><b>{sweetness}%</b></span>
            <input
              type="range"
              min="0"
              max="100"
              value={sweetness}
              onChange={event => setSweetness(Number(event.target.value))}
            />
            <small>속도 {speed.toFixed(2)}× · 의미는 바꾸지 않고 호흡/표현 태그만 조절</small>
          </label>
        </section>

        <section className="voice-lab-panel">
          <h2>3. 같은 문장으로 비교</h2>
          <textarea value={text} onChange={event => setText(event.target.value)} maxLength={500} />
          <details className="voice-lab-debug">
            <summary>실제로 엔진에 전달되는 표현 보기</summary>
            <code>{decoratedPreview}</code>
          </details>
          <div className="voice-lab-actions">
            <button type="button" className="primary" disabled={isLoading || isGenerating || !text.trim()} onClick={generateLocal}>
              {isLoading ? "모델 준비 중…" : isGenerating ? "음성 만드는 중…" : "무료 로컬 음성 듣기"}
            </button>
            <button type="button" disabled={ttsMutation.isPending || !text.trim()} onClick={playLedaReference}>
              {ttsMutation.isPending ? "Leda 준비 중…" : "현재 Leda와 비교"}
            </button>
          </div>
        </section>

        <section className="voice-lab-status" aria-live="polite">
          <div className="voice-lab-progress"><span style={{ width: `${progress}%` }} /></div>
          <div className="voice-lab-status-row">
            <span>{status}</span>
            <span>backend {backend}{lastMs ? ` · ${lastMs}ms` : ""}</span>
          </div>
          {error ? <p className="voice-lab-error">{error}</p> : null}
          {audioUrl ? <audio ref={audioRef} src={audioUrl} controls playsInline preload="metadata" /> : null}
        </section>

        <section className="voice-lab-gate">
          <h2>적용 기준</h2>
          <p>한국어 발음, 달달한 감정, 첫 생성 속도, 연속 생성 안정성, iPhone Safari 메모리 안정성 중 하나라도 부족하면 본 대화탭에는 적용하지 않습니다.</p>
        </section>
      </section>
    </main>
  );
}
