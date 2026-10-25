import { useEffect, useRef, useState } from "react";

// 웹은 화면이 꺼지거나 다른 앱으로 가면 녹음·음성 인식이 멈춥니다 (백그라운드 녹음 불가, CLAUDE.md 주의사항).
// 그래서 듣는 동안은 화면이 꺼지지 않게 막고, 다른 앱에 다녀오면 얼마나 멈춰 있었는지 알려줍니다.

const wakeLockSupported = typeof navigator !== "undefined" && "wakeLock" in navigator;

/** 듣는 동안 화면이 자동으로 꺼지지 않게 합니다 (Screen Wake Lock API). */
export function useWakeLock(active: boolean) {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!active || !wakeLockSupported) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const s = await navigator.wakeLock.request("screen");
        if (cancelled) return void s.release();
        sentinel = s;
        setLocked(true);
        s.addEventListener("release", () => setLocked(false));
      } catch {
        setLocked(false); // 배터리 절약 모드 등으로 거절될 수 있음
      }
    };
    // 다른 앱에 다녀오면 화면 꺼짐 방지가 자동으로 풀리므로 돌아왔을 때 다시 겁니다.
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      sentinel?.release();
      setLocked(false);
    };
  }, [active]);

  return { supported: wakeLockSupported, locked };
}

/** 듣는 중에 다른 앱으로 갔다 오면, 얼마나 멈춰 있었는지(초)를 돌려줍니다. 3초 미만은 무시. */
export function useAwayNotice(active: boolean) {
  const [awaySeconds, setAwaySeconds] = useState<number | null>(null);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const onChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current !== null) {
        const seconds = Math.round((Date.now() - hiddenAt.current) / 1000);
        hiddenAt.current = null;
        if (seconds >= 3) setAwaySeconds(seconds);
      }
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [active]);

  return { awaySeconds, dismiss: () => setAwaySeconds(null) };
}

/** 125 → "2분 5초", 40 → "40초" */
export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}분${s ? ` ${s}초` : ""}` : `${s}초`;
}
