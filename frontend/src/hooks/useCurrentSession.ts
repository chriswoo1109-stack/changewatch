import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import { getSession } from "../api/sessions";
import { useSessionStore } from "../stores/sessionStore";
import type { Session } from "../types";

// 마지막으로 불러온 방문 정보. 화면을 옮길 때마다 서버 응답(몇 초)을 기다리지 않도록
// 같은 방문이면 이걸 먼저 보여 주고, 최신 정보는 뒤에서 다시 받아 옵니다.
let lastSession: Session | null = null;

/** 현재 세션 정보를 불러옵니다. 서버에 없는 세션이면 초기화합니다. */
export function useCurrentSession() {
  const { sessionId, setSessionId } = useSessionStore();
  const cached = sessionId && lastSession?.id === sessionId ? lastSession : null;
  const [session, setSession] = useState<Session | null>(cached);
  const [error, setError] = useState<string | null>(null);
  // 처음 불러오는 중인지. 이게 없으면 불러오기 전 잠깐 "방문이 없습니다"가 보였다 사라집니다.
  // 기억해 둔 같은 방문이 있으면 바로 보여 주므로 로딩이 아닙니다.
  const [loading, setLoading] = useState(!!sessionId && !cached);

  const reload = useCallback(async () => {
    if (!sessionId) {
      lastSession = null;
      setSession(null);
      setLoading(false);
      return;
    }
    try {
      const fresh = await getSession(sessionId);
      lastSession = fresh;
      setSession(fresh);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        lastSession = null;
        setSessionId(null);
      } else setError("서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요.");
    } finally {
      setLoading(false);
    }
  }, [sessionId, setSessionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { session, loading, error, reload };
}
