export type MediaRecorderSupport = {
  isTypeSupported?: (mimeType: string) => boolean;
};

const RECORDING_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"] as const;

export function pickRecordingMimeType(mediaRecorder?: MediaRecorderSupport) {
  const supported = mediaRecorder ?? (typeof MediaRecorder === "undefined" ? undefined : MediaRecorder);
  if (!supported?.isTypeSupported) return "";
  return RECORDING_TYPES.find(type => supported.isTypeSupported?.(type)) ?? "";
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("audio_data_url_failed"));
    reader.onerror = () => reject(reader.error ?? new Error("audio_file_read_failed"));
    reader.readAsDataURL(blob);
  });
}
