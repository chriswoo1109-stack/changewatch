import { useCallback, useEffect, useState } from "react";
import { getHistory } from "../api/sessions";
import { useSessionStore } from "../stores/sessionStore";
import type { Change } from "../types";

/** 현재 세션의 변경 이력(최신순)을 불러옵니다. (정리·기록·확인 요청 화면 공용) */
export function useHistory() {
  const { sessionId } = useSessionStore();
  const [history, setHistory] = useState<Change[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!sessionId) return setHistory([]);
    setLoading(true);
    try {
      setHistory(await getHistory(sessionId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "기록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { history, setHistory, loading, error, reload };
}
