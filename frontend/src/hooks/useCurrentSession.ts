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

  const reload = useCallback(async () => {
    if (!sessionId) return setSession(null);
    try {
      setSession(await getSession(sessionId));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setSessionId(null);
      else setError("서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요.");
    }
  }, [sessionId, setSessionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { session, error, reload };
}
