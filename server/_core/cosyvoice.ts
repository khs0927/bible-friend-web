import axios from "axios";

export type CosyVoiceRequest = {
  text: string;
  instruct_text?: string;
  mode?: "sft" | "zero_shot" | "cross_lingual" | "instruct";
  prompt_text?: string;
  prompt_wav?: string;
  spk_id?: string;
};

/**
 * CosyVoice FastAPI 서버와 통신하여 텍스트를 음성 오디오 버퍼(ArrayBuffer)로 변환합니다.
 * 외부 COSYVOICE_API_URL 환경 변수가 설정되어 있지 않은 경우 안전한 폴백 에러를 반환합니다.
 */
export async function synthesizeWithCosyVoice(req: CosyVoiceRequest): Promise<ArrayBuffer> {
  const baseUrl = process.env.COSYVOICE_API_URL;
  if (!baseUrl) {
    throw new Error("COSYVOICE_API_URL is not configured. Please provide the CosyVoice server endpoint.");
  }

  try {
    const response = await axios.post(
      `${baseUrl.replace(/\/$/, "")}/tts`,
      {
        text: req.text,
        mode: req.mode || "instruct",
        instruct_text: req.instruct_text || "따뜻하고 친근한 어린이 목소리로 부드럽게 말해줘",
        spk_id: req.spk_id || "default",
      },
      {
        responseType: "arraybuffer",
        timeout: 15000,
      }
    );
    return response.data;
  } catch (error) {
    console.error("[CosyVoice] TTS synthesis failed:", error);
    throw new Error("CosyVoice 음성 변환 중 오류가 발생했습니다.");
  }
}
