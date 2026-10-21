import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import { getSession } from "../api/sessions";
import { useSessionStore } from "../stores/sessionStore";
import type { Session } from "../types";

/** 현재 세션 정보를 불러옵니다. 서버에 없는 세션이면 초기화합니다. */
export function useCurrentSession() {
  const { sessionId, setSessionId } = useSessionStore();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 처음 불러오는 중인지. 이게 없으면 불러오기 전 잠깐 "방문이 없습니다"가 보였다 사라집니다.
  const [loading, setLoading] = useState(!!sessionId);

  const reload = useCallback(async () => {
    if (!sessionId) {
      setSession(null);
      setLoading(false);
      return;
    }
    try {
      setSession(await getSession(sessionId));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setSessionId(null);
      else setError("서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요.");
    } finally {
      setLoading(false);
    }
  }, [sessionId, setSessionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { session, loading, error, reload };
}
