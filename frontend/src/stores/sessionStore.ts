import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AnalyzeResponse } from "../types";

interface SessionState {
  sessionId: string | null; // 새로고침해도 유지 (브라우저 저장소)
  lastResult: AnalyzeResponse | null; // 방금 분석한 결과 (결과 화면용)
  setSessionId: (id: string | null) => void;
  setLastResult: (r: AnalyzeResponse | null) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessionId: null,
      lastResult: null,
      setSessionId: (sessionId) => set({ sessionId, lastResult: null }),
      setLastResult: (lastResult) => set({ lastResult }),
    }),
    { name: "changewatch-session", partialize: (s) => ({ sessionId: s.sessionId }) },
  ),
);
