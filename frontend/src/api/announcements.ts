import type { AnalyzeResponse } from "../types";
import { request } from "./client";

export const analyzeText = (sessionId: string, text: string) =>
  request<AnalyzeResponse>(`/sessions/${sessionId}/announcements`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });

export const transcribeAudio = (sessionId: string, audio: Blob) => {
  const form = new FormData();
  const ext = audio.type.includes("mp4") ? "mp4" : "webm";
  form.append("file", audio, `recording.${ext}`);
  return request<{ text: string }>(`/sessions/${sessionId}/transcribe`, { method: "POST", body: form });
};
