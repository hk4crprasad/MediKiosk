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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const text = (english: string, hindi: string) => (language === "hi" ? hindi : english);

  useEffect(() => () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.onstop = null;
      mediaRecorder.onerror = null;
      mediaRecorder.stop();
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function startRecording() {
    setError("");
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

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        stream?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setRecordingFormat("");

        if (audioBlob.size === 0) {
          setError(text("No audio was captured. Please try again or use touch choices.", "कोई ऑडियो रिकॉर्ड नहीं हुआ। कृपया फिर कोशिश करें या टच विकल्प चुनें।"));
          return;
        }

        setProcessing(true);
        try {
          const result = await transcribeAudio(encounterId, token, audioBlob, language);
          if (result.raw_text) {
            onTranscript(result.raw_text);
          }
        } catch (caught) {
          setError(caught instanceof ApiError ? caught.message : text("Could not transcribe your speech.", "आपकी आवाज़ को लिखा नहीं जा सका।"));
        } finally {
          setProcessing(false);
        }
      };

      mediaRecorder.onerror = () => {
        mediaRecorder.onstop = null;
        stream?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
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

  return (
    <div className="audio-assist" style={{ display: "inline-block" }}>
      {recording ? (
        <button
          className="button-primary kiosk-audio"
          onClick={stopRecording}
          type="button"
          style={{ background: "#ef4444", borderColor: "#dc2626", animation: "pulse 1.5s infinite" }}
        >
          {text("⏹ Stop recording", "⏹ रिकॉर्डिंग रोकें")} ({text("speaking", "बोल रहे हैं")}{recordingFormat ? ` · ${recordingFormat}` : ""}…)
        </button>
      ) : (
        <button
          className="button-secondary kiosk-audio"
          disabled={processing}
          onClick={startRecording}
          type="button"
        >
          {processing ? text("Transcribing speech…", "आवाज़ लिखी जा रही है…") : text("🎙️ Speak answer", "🎙️ जवाब बोलें")}
        </button>
      )}
      {error && <p className="audio-error" role="status">{error}</p>}
    </div>
  );
}
