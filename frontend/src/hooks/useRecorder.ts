import { useEffect, useRef, useState } from "react";

/** 마이크 녹음 훅. iPhone Safari(mp4)와 Chrome(webm) 모두 지원합니다. */
export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const cleanup = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  };
  useEffect(() => cleanup, []);

  const start = async () => {
    setError(null);
    try {
      // 병원 대기실 소음 대비: 잡음 제거·울림 제거·음량 자동 조절 (지원하지 않는 브라우저는 무시하고 그냥 녹음)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true },
      });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("마이크를 사용할 수 없습니다. 브라우저의 마이크 권한을 확인해 주세요.");
    }
  };

  /** 녹음을 멈추고 음성 파일(Blob)을 돌려줍니다. */
  const stop = () =>
    new Promise<Blob | null>((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder) return resolve(null);
      recorder.onstop = () => {
        cleanup();
        setRecording(false);
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType }));
      };
      recorder.stop();
    });

  return { recording, seconds, error, start, stop };
}
