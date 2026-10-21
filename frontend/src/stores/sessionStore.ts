import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AnalyzeResponse } from "../types";
import type { MyKeywords } from "../utils/filter";

interface SessionState {
  sessionId: string | null; // 새로고침해도 유지 (브라우저 저장소)
  lastResult: AnalyzeResponse | null; // 방금 분석한 결과 (결과 화면용)
  // 내 번호·이름. 기준은 서버 세션(my_number·my_name)이고, 여기 값은
  // 새 방문을 시작할 때 미리 채워 넣고 실시간 자막에서 바로 알림을 띄우는 데 씁니다.
  myKeywords: MyKeywords;
  listenNoticeAgreed: boolean; // 듣기 전 안내(음성 외부 전송)에 동의했는지. 이 기기에서 한 번만 묻습니다
  setSessionId: (id: string | null) => void;
  setLastResult: (r: AnalyzeResponse | null) => void;
  setMyKeywords: (k: MyKeywords) => void;
  agreeListenNotice: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessionId: null,
      lastResult: null,
      myKeywords: { waitNumber: "", name: "" },
      listenNoticeAgreed: false,
      setSessionId: (sessionId) => set({ sessionId, lastResult: null }),
      setLastResult: (lastResult) => set({ lastResult }),
      setMyKeywords: (myKeywords) => set({ myKeywords }),
      agreeListenNotice: () => set({ listenNoticeAgreed: true }),
    }),
    {
      name: "changewatch-session",
      partialize: (s) => ({ sessionId: s.sessionId, myKeywords: s.myKeywords, listenNoticeAgreed: s.listenNoticeAgreed }),
    },
  ),
);
