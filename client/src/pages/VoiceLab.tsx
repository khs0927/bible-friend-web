import * as supertonicHelper from "@/lib/supertonicHelper";
import { useEffect, useRef, useState } from "react";
import "./voice-lab.css";

const HF_BASE = "https://huggingface.co/Supertone/supertonic-3/resolve/main";
const ONNX_BASE = `${HF_BASE}/onnx`;
const ORT_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/ort.min.js";
const ORT_WASM_BASE = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/";

// One final candidate only. F4 is the brightest/softest preset among the public female styles
// and works best as the base for a child-friendly Bible Friend voice.
const VOICE_ID = "F4";
const SAMPLE_TEXT = "하나님은 너를 정말 사랑하신단다. 오늘도 네 마음을 알고 계시고, 언제나 네 곁에 함께하셔.";

type RuntimeState = {
  helper: typeof supertonicHelper;
  tts: any;
  backend: "webgpu" | "wasm";
  style: any | null;
};

type DirectedSegment = {
  text: string;
  speed: number;
  pauseMs: number;
  gain: number;
};

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
        if (ort?.InferenceSession) resolve(ort);
        else reject(new Error("ONNX Runtime은 열렸지만 실행 엔진을 찾지 못했어요."));
      };
      const onError = () => {
        cleanup();
        script?.remove();
        reject(new Error("iPhone 호환 ONNX Runtime을 불러오지 못했어요."));
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

function splitForEmotion(text: string) {
  const normalized = text
    .replace(/\s+/g, " ")
    .replace(/([.!?。！？])(?=[^\s])/g, "$1 ")
    .trim();

  const sentences = normalized
    .split(/(?<=[.!?。！？])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);

  return sentences.length ? sentences : [normalized];
}

function isWarmPositive(text: string) {
  return /(사랑|기뻐|좋아|감사|축복|함께|괜찮|소중|기쁜|반가|잘했|멋진|예뻐|귀여|웃)/.test(text);
}

function isComforting(text: string) {
  return /(슬프|힘들|속상|걱정|무서|두려|외로|아프|괜찮|위로|눈물|지쳐)/.test(text);
}

function isGreeting(text: string) {
  return /^(안녕|반가|좋은 아침|좋은 저녁|하이)/.test(text.trim());
}

function directEmotion(text: string): DirectedSegment[] {
  const sentences = splitForEmotion(text);

  return sentences.map((sentence, index) => {
    const isFirst = index === 0;
    const isLast = index === sentences.length - 1;
    const question = /[?？]$/.test(sentence);
    const exclamation = /[!！]$/.test(sentence);
    const positive = isWarmPositive(sentence);
    const comforting = isComforting(sentence);

    let directed = sentence;
    let speed = 0.91;
    let pauseMs = isLast ? 330 : 230;
    let gain = 0.98;

    // Expression tags are part of Supertonic 3 itself. They alter delivery without
    // changing the semantic sentence shown to the child.
    if (isGreeting(sentence) || (positive && exclamation)) {
      directed = `<laugh> ${sentence}`;
      speed = 0.96;
      pauseMs = 190;
      gain = 1.0;
    } else if (comforting) {
      directed = `<breath> ${sentence}`;
      speed = 0.86;
      pauseMs = 320;
      gain = 0.94;
    } else if (positive) {
      directed = `<breath> ${sentence}`;
      speed = 0.89;
      pauseMs = 260;
      gain = 0.98;
    } else if (question) {
      directed = `<breath> ${sentence}`;
      speed = 0.93;
      pauseMs = 240;
    } else if (isFirst) {
      directed = `<breath> ${sentence}`;
      speed = 0.90;
      pauseMs = 250;
    }

    // Finish softly instead of reading every sentence at exactly the same energy.
    if (isLast) {
      speed = Math.min(speed, 0.88);
      gain *= 0.96;
    }

    return { text: directed, speed, pauseMs, gain };
  });
}

function applySoftEnvelope(samples: number[], gain: number, sampleRate: number) {
  const out = new Array<number>(samples.length);
  const fade = Math.min(samples.length >> 1, Math.floor(sampleRate * 0.018));

  for (let i = 0; i < samples.length; i++) {
    let envelope = 1;
    if (fade > 0 && i < fade) envelope = i / fade;
    if (fade > 0 && i >= samples.length - fade) envelope = Math.min(envelope, (samples.length - 1 - i) / fade);
    out[i] = samples[i] * gain * Math.max(0, envelope);
  }

  return out;
}

function joinSegments(parts: Array<{ wav: number[]; pauseMs: number; gain: number }>, sampleRate: number) {
  const joined: number[] = [];

  parts.forEach((part, index) => {
    joined.push(...applySoftEnvelope(part.wav, part.gain, sampleRate));
    if (index < parts.length - 1) {
      const pauseLength = Math.floor(sampleRate * (part.pauseMs / 1000));
      for (let i = 0; i < pauseLength; i++) joined.push(0);
    }
  });

  return joined;
}

export default function VoiceLab() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [status, setStatus] = useState("성경친구 전용 감정 음성을 준비할 수 있어요.");
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [backend, setBackend] = useState<string>("-");
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runtimeRef = useRef<RuntimeState | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function ensureRuntime() {
    if (runtimeRef.current) return runtimeRef.current;

    setIsLoading(true);
    setError(null);
    setStatus("무료 로컬 음성 엔진을 준비하고 있어요…");
    setProgress(2);

    try {
      const ort: any = await loadOrtRuntime();
      ort.env.wasm.wasmPaths = ORT_WASM_BASE;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;

      const helper = supertonicHelper;
      helper.configureOrt(ort);

      const loadOptions = (provider: "webgpu" | "wasm") => ({
        executionProviders: [provider],
        graphOptimizationLevel: "all",
      });
      const onProgress = (_name: string, current: number, total: number) => {
        setProgress(Math.max(5, Math.min(82, Math.round((current / total) * 78))));
      };

      let result: any;
      let selectedBackend: "webgpu" | "wasm" = "wasm";
      const canTryWebGpu = !isIOSLike() && typeof navigator !== "undefined" && "gpu" in navigator;

      if (canTryWebGpu) {
        try {
          result = await helper.loadTextToSpeech(ONNX_BASE, loadOptions("webgpu"), onProgress);
          selectedBackend = "webgpu";
        } catch (webGpuError) {
          console.info("[Voice Lab] WebGPU unavailable; falling back to WASM", webGpuError);
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
        style: null,
      };

      runtimeRef.current = runtime;
      setBackend(selectedBackend);
      setProgress(84);
      setStatus("성경친구 음색을 준비하고 있어요…");
      return runtime;
    } finally {
      setIsLoading(false);
    }
  }

  async function ensureStyle(runtime: RuntimeState) {
    if (runtime.style) return runtime.style;
    runtime.style = await runtime.helper.loadVoiceStyle([`${HF_BASE}/voice_styles/${VOICE_ID}.json`]);
    return runtime.style;
  }

  async function generateSweetHeartVoice() {
    if (!text.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    const startedAt = performance.now();

    try {
      const runtime = await ensureRuntime();
      const style = await ensureStyle(runtime);
      const directed = directEmotion(text);
      const rendered: Array<{ wav: number[]; pauseMs: number; gain: number }> = [];

      setStatus("문장마다 따뜻한 감정을 입히고 있어요…");
      setProgress(86);

      for (let i = 0; i < directed.length; i++) {
        const segment = directed[i];
        const base = 86 + Math.round((i / Math.max(1, directed.length)) * 12);
        const { wav, duration } = await runtime.tts.call(
          segment.text,
          "ko",
          style,
          10,
          segment.speed,
          0,
          (step: number, total: number) => {
            const local = Math.round((step / total) * (12 / Math.max(1, directed.length)));
            setProgress(Math.min(98, base + local));
          },
        );
        const wavLength = Math.floor(runtime.tts.sampleRate * duration[0]);
        rendered.push({
          wav: wav.slice(0, wavLength),
          pauseMs: segment.pauseMs,
          gain: segment.gain,
        });
      }

      const finalWav = joinSegments(rendered, runtime.tts.sampleRate);
      const buffer = runtime.helper.writeWavFile(finalWav, runtime.tts.sampleRate);
      const nextUrl = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));

      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(nextUrl);
      setLastMs(Math.round(performance.now() - startedAt));
      setProgress(100);
      setStatus("완료. 이 한 가지 목소리를 기준으로 판단하면 됩니다.");

      requestAnimationFrame(() => {
        audioRef.current?.play().catch(() => undefined);
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(`생성 실패: ${message}`);
      setStatus("생성에 실패했어요. Production에는 적용하지 않았습니다.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="voice-lab-page">
      <section className="voice-lab-shell">
        <header className="voice-lab-header">
          <div>
            <span className="voice-lab-kicker">BIBLE FRIEND · SWEET HEART VOICE</span>
            <h1>성경친구 감정 음성</h1>
            <p>여러 버전 없이, 아이에게 가장 따뜻하게 들리도록 만든 한 가지 음성만 테스트합니다.</p>
          </div>
          <a href="/" className="voice-lab-home">대화탭으로</a>
        </header>

        <div className="voice-lab-note">
          <strong>완전 무료 · 기기 내 생성</strong>
          <span>F4의 밝고 부드러운 음색에 문장별 호흡, 웃음, 속도, 쉼, 마무리 강도를 자동으로 입힙니다.</span>
        </div>

        <section className="voice-lab-panel">
          <h2>성경친구 Sweet Heart</h2>
          <p style={{ margin: "0 0 14px", lineHeight: 1.65, color: "#756881" }}>
            한 문장을 기계적으로 읽지 않고 문장마다 감정을 다시 연출합니다. 사랑은 더 포근하게, 위로는 더 천천히, 인사는 살짝 웃으며, 마지막 말은 부드럽게 내려놓습니다.
          </p>
          <textarea value={text} onChange={event => setText(event.target.value)} maxLength={500} />
          <div className="voice-lab-actions">
            <button
              type="button"
              className="primary"
              disabled={isLoading || isGenerating || !text.trim()}
              onClick={generateSweetHeartVoice}
            >
              {isLoading ? "모델 준비 중…" : isGenerating ? "감정을 입히는 중…" : "성경친구 음성 듣기"}
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
          <h2>판정 기준</h2>
          <p>이 한 가지 버전이 아이에게 충분히 다정하고 자연스럽게 들릴 때만 실제 대화탭에 적용합니다. 아니면 Supertonic 적용을 중단합니다.</p>
        </section>
      </section>
    </main>
  );
}
