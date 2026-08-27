"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, getNextQuestionAudio } from "@/lib/api";

type QuestionAudioButtonProps = { encounterId: string; questionKey: string; token: string };

export function QuestionAudioButton({ encounterId, questionKey, token }: QuestionAudioButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  async function play() {
    setLoading(true); setError("");
    try {
      const blob = await getNextQuestionAudio(encounterId, token, questionKey);
      const url = URL.createObjectURL(blob);
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
      await audio.play();
    } catch (caught) {
      const msg = caught instanceof ApiError ? (caught.message || "Audio is not available. Please use the text and touch choices.") : "We could not play the question audio.";
      setError(msg);
    } finally { setLoading(false); }
  }

  return <div className="audio-assist"><button className="button-secondary kiosk-audio" disabled={loading} onClick={play} type="button">{loading ? "Preparing audio…" : "◖ Play question aloud"}</button>{error && <p className="audio-error" role="status">{error}</p>}</div>;
}
