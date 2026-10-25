import { useEffect, useReducer } from "react";

/** 안드로이드 Chrome이 "설치할 수 있어요" 하고 보내는 이벤트 (TypeScript 기본 타입에 없음) */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// 이 이벤트는 앱이 뜨자마자 한 번만 오기 때문에, 화면이 열리기 전(모듈을 불러올 때) 미리 받아 둡니다.
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // 브라우저 기본 설치 띠 대신 설정 화면 버튼으로 설치
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

/** 홈 화면에 추가된 앱으로 실행 중인지 */
export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true // 아이폰 Safari
  );
}

/** 앱 설치(홈 화면에 추가) 상태와 설치 함수 */
export function useInstall() {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.add(rerender);
    return () => {
      listeners.delete(rerender);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null; // 한 번 쓴 이벤트는 다시 못 씀
    rerender();
  };

  return { canInstall: deferred !== null, installed: isStandalone(), install };
}
