import { useEffect, useRef, useState } from "react";

const Recognition = typeof window !== "undefined" ? (window.SpeechRecognition ?? window.webkitSpeechRecognition) : undefined;

/** 이 브라우저가 실시간 음성 인식(Web Speech API)을 지원하는지 */
export const speechSupported = !!Recognition;

// 브라우저가 알려주는 오류 종류별 안내
const ERROR_MESSAGE: Record<string, string> = {
  "not-allowed": "마이크 권한이 막혀 있어요. 주소창 왼쪽 자물쇠 아이콘에서 마이크를 '허용'으로 바꿔 주세요.",
  "service-not-allowed":
    "이 브라우저에서는 음성 인식을 쓸 수 없어요. VS Code 내장 브라우저라면 일반 Chrome 창에서 열어 주세요. (아이폰은 설정 > 일반 > 키보드 > 받아쓰기 켜기)",
  network:
    "음성 인식 서버에 연결하지 못했어요. 인터넷 연결을 확인하고, 일반 Chrome 창에서 열어 주세요. (VS Code 내장 브라우저·Edge 일부 버전은 지원하지 않아요)",
  "audio-capture": "마이크를 찾을 수 없어요. 마이크가 연결되어 있는지, 다른 앱이 쓰고 있지 않은지 확인해 주세요.",
  "language-not-supported": "이 브라우저는 한국어 음성 인식을 지원하지 않아요. Chrome에서 열어 주세요.",
};

/**
 * 버튼으로 켜고 끄는 실시간 음성 인식 훅 (Chrome, Android, iPhone Safari).
 * 서버·API 키 없이 브라우저가 바로 글자로 바꿔 줍니다.
 * 확정된 문장은 onFinal로 하나씩 전달하고(인식 후보 여러 개, 첫 번째가 가장 유력), 말하는 중인 문장은 interim으로 보여줍니다.
 */
export function useSpeechRecognition(onFinal: (alternatives: string[]) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [ready, setReady] = useState(false); // 마이크가 실제로 켜져 소리를 받는 중 (이때부터 말해야 앞부분이 안 잘림)
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const wantRef = useRef(false); // 사용자가 "중지"를 누르기 전까지 계속 듣기
  const stopResolveRef = useRef<(() => void) | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(
    () => () => {
      wantRef.current = false;
      recRef.current?.stop();
    },
    [],
  );

  const start = () => {
    if (!Recognition) return;
    setError(null);
    setInterim("");
    const rec = new Recognition();
    rec.lang = "ko-KR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3; // "진료실"이 "진료신"으로 들리는 등 오인식 대비
    rec.onstart = () => setReady(true);
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0].transcript.trim();
        if (result.isFinal) {
          const alts = Array.from({ length: result.length }, (_, k) => result[k].transcript.trim()).filter(Boolean);
          if (alts.length) onFinalRef.current(alts);
        } else live += text + " ";
      }
      setInterim(live.trim());
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return; // 조용한 구간은 무시하고 계속 듣기
      wantRef.current = false;
      setError(ERROR_MESSAGE[e.error] ?? `음성 인식이 중단되었습니다. 다시 시도해 주세요. (${e.error})`);
    };
    rec.onend = () => {
      setReady(false);
      // 브라우저는 잠시 조용하면 스스로 멈추므로, 사용자가 끄기 전까지 다시 켭니다.
      if (wantRef.current) {
        try {
          rec.start();
          return;
        } catch {
          wantRef.current = false;
        }
      }
      setListening(false);
      setInterim("");
      stopResolveRef.current?.();
      stopResolveRef.current = null;
    };
    wantRef.current = true;
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  /** 듣기를 멈춥니다. 마지막 문장까지 onFinal로 전달된 뒤에 끝납니다. */
  const stop = () =>
    new Promise<void>((resolve) => {
      wantRef.current = false;
      if (!recRef.current || !listening) return resolve();
      stopResolveRef.current = resolve;
      recRef.current.stop();
    });

  return { listening, ready, interim, error, start, stop };
}
