import type { AnalyzeResponse, ListenResponse } from "../types";
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

/** 대기 모드: 음성 조각 1개 보내기. prevText는 직전 응답의 text */
export const listenChunk = (sessionId: string, audio: Blob, prevText?: string) => {
  const form = new FormData();
  const ext = audio.type.includes("mp4") ? "mp4" : "webm";
  form.append("file", audio, `chunk.${ext}`);
  if (prevText) form.append("prev_text", prevText);
  return request<ListenResponse>(`/sessions/${sessionId}/listen`, { method: "POST", body: form });
};
