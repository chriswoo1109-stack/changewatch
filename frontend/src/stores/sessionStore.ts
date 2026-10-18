import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AnalyzeResponse } from "../types";
import type { MyKeywords } from "../utils/filter";

interface SessionState {
  sessionId: string | null; // 새로고침해도 유지 (브라우저 저장소)
  lastResult: AnalyzeResponse | null; // 방금 분석한 결과 (결과 화면용)
  checked: Record<string, boolean>; // 할 일 체크 여부 (키: "항목:값", 값이 바뀌면 자동으로 다시 미완료)
  myKeywords: MyKeywords; // 내 정보 키워드 (방문이 바뀌어도 유지)
  setSessionId: (id: string | null) => void;
  setLastResult: (r: AnalyzeResponse | null) => void;
  toggleChecked: (todoId: string) => void;
  setMyKeywords: (k: MyKeywords) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessionId: null,
      lastResult: null,
      checked: {},
      myKeywords: { waitNumber: "", name: "" },
      setSessionId: (sessionId) => set({ sessionId, lastResult: null, checked: {} }),
      setLastResult: (lastResult) => set({ lastResult }),
      toggleChecked: (todoId) => set((s) => ({ checked: { ...s.checked, [todoId]: !s.checked[todoId] } })),
      setMyKeywords: (myKeywords) => set({ myKeywords }),
    }),
    {
      name: "changewatch-session",
      partialize: (s) => ({ sessionId: s.sessionId, checked: s.checked, myKeywords: s.myKeywords }),
    },
  ),
);
