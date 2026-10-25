const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Render 무료 서버는 15분 쓰지 않으면 잠들어서 첫 요청에 30초~1분이 걸립니다 (CLAUDE.md 배포·운영).
// 요청이 이 시간보다 오래 걸리면 화면에 "서버를 깨우는 중" 안내를 띄웁니다.
const SLOW_MS = 4000;
let slowCount = 0;
const slowListeners = new Set<(slow: boolean) => void>();
const changeSlow = (delta: number) => {
  slowCount += delta;
  slowListeners.forEach((f) => f(slowCount > 0));
};

/** 오래 걸리는 요청이 있는지 구독합니다. 반환값은 구독 해제 함수. */
export function onSlowChange(listener: (slow: boolean) => void) {
  slowListeners.add(listener);
  return () => {
    slowListeners.delete(listener);
  };
}

/** 앱을 열 때 서버를 미리 깨워 둡니다. 결과는 기다리지 않고, 실패해도 무시합니다. */
export function wakeServer() {
  fetch(`${BASE_URL}/api/health`).catch(() => {});
}

/** 모든 API 호출이 거치는 공통 함수. 에러 메시지를 한국어 그대로 보여줍니다. */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  let slow = false;
  const timer = setTimeout(() => {
    slow = true;
    changeSlow(1);
  }, SLOW_MS);
  try {
    const res = await fetch(`${BASE_URL}/api${path}`, {
      ...init,
      headers: isForm ? init.headers : { "Content-Type": "application/json", ...init.headers },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = typeof body.detail === "string" ? body.detail : "요청을 처리하지 못했습니다.";
      throw new ApiError(res.status, detail);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
    if (slow) changeSlow(-1);
  }
}
