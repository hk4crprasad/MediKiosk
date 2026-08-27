"use client";

import { useRef, useState } from "react";
import { ApiError, transcribeAudio } from "@/lib/api";

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        stream.getTracks().forEach((track) => track.stop());
        setProcessing(true);
        try {
          const result = await transcribeAudio(encounterId, token, audioBlob, language);
          if (result.raw_text) {
            onTranscript(result.raw_text);
          }
        } catch (caught) {
          setError(caught instanceof ApiError ? caught.message : "Could not transcribe your speech.");
        } finally {
          setProcessing(false);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      setError("Microphone access is unavailable. Please use touch choices.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
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
          ⏹ Stop recording (speaking…)
        </button>
      ) : (
        <button
          className="button-secondary kiosk-audio"
          disabled={processing}
          onClick={startRecording}
          type="button"
        >
          {processing ? "Transcribing speech…" : "🎙️ Speak answer"}
        </button>
      )}
      {error && <p className="audio-error" role="status">{error}</p>}
    </div>
  );
}
