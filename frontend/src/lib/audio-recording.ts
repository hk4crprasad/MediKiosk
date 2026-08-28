export type BrowserAudioFormat = {
  mimeType: string;
  extension: "webm" | "ogg" | "m4a";
  label: string;
};

const BROWSER_AUDIO_FORMATS: BrowserAudioFormat[] = [
  { mimeType: "audio/webm;codecs=opus", extension: "webm", label: "WebM / Opus" },
  { mimeType: "audio/ogg;codecs=opus", extension: "ogg", label: "Ogg / Opus" },
  { mimeType: "audio/mp4;codecs=mp4a.40.2", extension: "m4a", label: "M4A / AAC" },
  { mimeType: "audio/webm", extension: "webm", label: "WebM" },
  { mimeType: "audio/ogg", extension: "ogg", label: "Ogg" },
  { mimeType: "audio/mp4", extension: "m4a", label: "M4A" },
];

const UPLOAD_EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
};

export function normaliseAudioMimeType(mimeType: string): string {
  return mimeType.split(";", 1)[0].trim().toLowerCase();
}

export function isSupportedAudioUpload(mimeType: string): boolean {
  return normaliseAudioMimeType(mimeType) in UPLOAD_EXTENSIONS;
}

export function audioFilename(mimeType: string): string {
  const extension = UPLOAD_EXTENSIONS[normaliseAudioMimeType(mimeType)];
  if (!extension) {
    throw new Error("The browser produced an unsupported audio format.");
  }
  return `recording.${extension}`;
}

export function selectBrowserAudioFormat(): BrowserAudioFormat | null {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return null;
  }
  return BROWSER_AUDIO_FORMATS.find((format) => MediaRecorder.isTypeSupported(format.mimeType)) ?? null;
}

export function displayAudioFormat(mimeType: string): string {
  const exactMimeType = mimeType.trim().toLowerCase();
  const normalised = normaliseAudioMimeType(mimeType);
  return BROWSER_AUDIO_FORMATS.find((format) => format.mimeType === exactMimeType)?.label
    ?? BROWSER_AUDIO_FORMATS.find((format) => format.mimeType === normalised)?.label
    ?? normalised.replace("audio/", "").toUpperCase();
}
