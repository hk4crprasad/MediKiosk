"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, getNextQuestionAudio, KioskLanguage } from "@/lib/api";

type QuestionAudioButtonProps = { encounterId: string; questionKey: string; token: string; language: KioskLanguage };

export function QuestionAudioButton({ encounterId, questionKey, token, language }: QuestionAudioButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const text = (english: string, hindi: string) => (language === "hi" ? hindi : english);

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
      const msg = caught instanceof ApiError ? (caught.message || text("Audio is not available. Please use the text and touch choices.", "ऑडियो उपलब्ध नहीं है। कृपया लिखे हुए और टच विकल्पों का उपयोग करें।")) : text("We could not play the question audio.", "प्रश्न का ऑडियो नहीं चल सका।");
      setError(msg);
    } finally { setLoading(false); }
  }

  return <div className="audio-assist"><button className="button-secondary kiosk-audio" disabled={loading} onClick={play} type="button">{loading ? text("Preparing audio…", "ऑडियो तैयार हो रहा है…") : text("◖ Play question aloud", "◖ प्रश्न सुनें")}</button>{error && <p className="audio-error" role="status">{error}</p>}</div>;
}
