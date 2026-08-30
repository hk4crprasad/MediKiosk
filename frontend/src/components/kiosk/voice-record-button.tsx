"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, transcribeAudio } from "@/lib/api";
import {
  displayAudioFormat,
  isSupportedAudioUpload,
  selectBrowserAudioFormat,
} from "@/lib/audio-recording";

type VoiceRecordButtonProps = {
  encounterId: string;
  token: string;
  language?: string;
  onTranscript: (transcript: string) => void;
};

export function VoiceRecordButton({ encounterId, token, language = "en", onTranscript }: VoiceRecordButtonProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [recordingFormat, setRecordingFormat] = useState("");
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedDurationSeconds, setRecordedDurationSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [transcriptReady, setTranscriptReady] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioUrlRef = useRef<string | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const text = (english: string, hindi: string) => (language === "hi" ? hindi : english);

  useEffect(() => () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.onstop = null;
      mediaRecorder.onerror = null;
      mediaRecorder.stop();
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  useEffect(() => {
    if (!recording || recordingStartedAtRef.current === null) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - recordingStartedAtRef.current!) / 1_000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  function clearRecordedAudio() {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setRecordedAudioUrl(null);
    setRecordedDurationSeconds(0);
    setTranscriptReady(false);
  }

  async function startRecording() {
    setError("");
    clearRecordedAudio();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(text("Voice recording is not supported on this browser. Please use touch choices.", "इस ब्राउज़र में आवाज़ रिकॉर्ड नहीं की जा सकती। कृपया टच विकल्प चुनें।"));
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
        },
      });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      const selectedFormat = selectBrowserAudioFormat();
      const mediaRecorder = selectedFormat
        ? new MediaRecorder(stream, { mimeType: selectedFormat.mimeType })
        : new MediaRecorder(stream);
      const actualMimeType = mediaRecorder.mimeType || selectedFormat?.mimeType || "";

      if (!isSupportedAudioUpload(actualMimeType)) {
        throw new Error("unsupported_audio_format");
      }

      mediaRecorderRef.current = mediaRecorder;
      setRecordingFormat(displayAudioFormat(actualMimeType));
      recordingStartedAtRef.current = Date.now();
      setElapsedSeconds(0);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        const recordedForMs = recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : 0;
        recordingStartedAtRef.current = null;
        stream?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setRecordingFormat("");

        if (audioBlob.size === 0) {
          setError(text("No audio was captured. Please try again or use touch choices.", "कोई ऑडियो रिकॉर्ड नहीं हुआ। कृपया फिर कोशिश करें या टच विकल्प चुनें।"));
          return;
        }

        const audioUrl = URL.createObjectURL(audioBlob);
        audioUrlRef.current = audioUrl;
        setRecordedAudioUrl(audioUrl);
        setRecordedDurationSeconds(Math.max(1, Math.round(recordedForMs / 1_000)));
      };

      mediaRecorder.onerror = () => {
        mediaRecorder.onstop = null;
        stream?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        recordingStartedAtRef.current = null;
        setRecording(false);
        setRecordingFormat("");
        setError(text("Recording stopped unexpectedly. Please try again or use touch choices.", "रिकॉर्डिंग अचानक रुक गई। कृपया फिर कोशिश करें या टच विकल्प चुनें।"));
      };

      mediaRecorder.start(250);
      setRecording(true);
    } catch (caught) {
      stream?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      setRecordingFormat("");
      setError(
        caught instanceof Error && caught.message === "unsupported_audio_format"
          ? text("This browser cannot create a supported audio recording. Please use touch choices.", "यह ब्राउज़र समर्थित ऑडियो रिकॉर्डिंग नहीं बना सकता। कृपया टच विकल्प चुनें।")
          : text("Microphone access is unavailable. Please allow microphone access or use touch choices.", "माइक्रोफ़ोन की अनुमति उपलब्ध नहीं है। अनुमति दें या टच विकल्प चुनें।"),
      );
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  async function verifyWording() {
    if (!recordedAudioUrl || processing) return;
    setError("");
    setProcessing(true);
    setTranscriptReady(false);
    try {
      const response = await fetch(recordedAudioUrl);
      const audioBlob = await response.blob();
      const result = await transcribeAudio(encounterId, token, audioBlob, language);
      if (!result.raw_text?.trim()) {
        setError(text("We could not find spoken words in that recording. Please try again or use touch choices.", "उस रिकॉर्डिंग में बोले गए शब्द नहीं मिले। कृपया फिर से कोशिश करें या टच विकल्प चुनें।"));
        return;
      }
      onTranscript(result.raw_text.trim());
      setTranscriptReady(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : text("Could not check your spoken words. Please try again or use touch choices.", "आपके बोले गए शब्द जांचे नहीं जा सके। कृपया फिर से कोशिश करें या टच विकल्प चुनें।"));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="audio-assist">
      {recording ? (
        <div className="voice-recording-card" role="status" aria-live="polite">
          <div className="voice-recording-status">
            <span className="voice-live-dot" aria-hidden="true" />
            <strong>{text("Recording your words", "आपके शब्द रिकॉर्ड हो रहे हैं")}</strong>
            <time>{`${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`}</time>
          </div>
          <div className="recording-visualizer" aria-label={text("Audio level visualisation", "ऑडियो स्तर दृश्य") } role="img">
            {[18, 31, 22, 40, 28, 48, 24, 36, 19, 43, 30, 52, 26, 38, 21, 33].map((height, index) => (
              <span key={index} style={{ height: `${height}px`, animationDelay: `${index * -0.12}s` }} />
            ))}
          </div>
          <p>{text("Speak naturally. When you finish, tap Stop.", "सामान्य रूप से बोलें। पूरा होने पर रोकें दबाएँ।")}</p>
          <button className="button-primary kiosk-audio voice-stop-button" onClick={stopRecording} type="button">
            ⏹ {text("Stop recording", "रिकॉर्डिंग रोकें")}{recordingFormat ? ` · ${recordingFormat}` : ""}
          </button>
        </div>
      ) : recordedAudioUrl ? (
        <div className="voice-review-card" role="status" aria-live="polite">
          <div className="voice-review-title"><span aria-hidden="true">✓</span><div><strong>{text("Recording ready", "रिकॉर्डिंग तैयार है")}</strong><p>{text(`${recordedDurationSeconds} second private recording`, `${recordedDurationSeconds} सेकंड की निजी रिकॉर्डिंग`)}</p></div></div>
          <audio aria-label={text("Playback your recording", "अपनी रिकॉर्डिंग सुनें")} className="voice-playback" controls preload="metadata" src={recordedAudioUrl} />
          <p className="voice-review-note">{text("Listen if you wish, then ask AI to check the spoken wording. This never replaces the touch choice.", "चाहें तो सुनें, फिर AI से बोले गए शब्द जांचने को कहें। यह टच विकल्प की जगह नहीं लेता।")}</p>
          <div className="voice-review-actions">
            <button className="button-primary kiosk-audio" disabled={processing} onClick={() => void verifyWording()} type="button">
              {processing ? text("AI is checking wording…", "AI शब्दों की जांच कर रहा है…") : text("✨ Check spoken wording", "✨ बोले गए शब्द जांचें")}
            </button>
            <button className="button-secondary kiosk-audio" disabled={processing} onClick={startRecording} type="button">
              ↻ {text("Record again", "फिर से रिकॉर्ड करें")}
            </button>
          </div>
          {transcriptReady && <p className="voice-transcript-success">✓ {text("AI-checked wording was added to the note below. Please review or edit it, then choose the closest touch answer.", "AI-जांचे गए शब्द नीचे नोट में जोड़ दिए गए हैं। कृपया जांचें या बदलें, फिर सबसे सही टच उत्तर चुनें।")}</p>}
        </div>
      ) : (
        <button className="button-secondary kiosk-audio" disabled={processing} onClick={startRecording} type="button">
          🎙️ {text("Record a spoken note", "बोला गया नोट रिकॉर्ड करें")}
        </button>
      )}
      {error && <p className="audio-error" role="status">{error}</p>}
    </div>
  );
}
