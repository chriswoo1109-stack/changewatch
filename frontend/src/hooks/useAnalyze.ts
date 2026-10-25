import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { analyzeText } from "../api/announcements";
import { useSessionStore } from "../stores/sessionStore";

/** 텍스트를 분석하고 결과 화면으로 이동합니다. (홈 화면 직접 입력, 녹음 화면 공용) */
export function useAnalyze() {
  const navigate = useNavigate();
  const { sessionId, setLastResult } = useSessionStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async (text: string) => {
    if (!sessionId || !text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setLastResult(await analyzeText(sessionId, text));
      navigate("/result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, error };
}
