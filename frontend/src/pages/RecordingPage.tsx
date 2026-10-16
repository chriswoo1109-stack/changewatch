import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { transcribeAudio } from "../api/announcements";
import { useAnalyze } from "../hooks/useAnalyze";
import { useRecorder } from "../hooks/useRecorder";
import { useSessionStore } from "../stores/sessionStore";

// 시안 3번(음성 인식 중)
export default function RecordingPage() {
  const navigate = useNavigate();
  const { sessionId } = useSessionStore();
  const { recording, seconds, error: micError, start, stop } = useRecorder();
  const { analyze, loading, error: analyzeError } = useAnalyze();
  const [status, setStatus] = useState<string | null>(null);
  const [sttError, setSttError] = useState<string | null>(null);

  const finish = async () => {
    const audio = await stop();
    if (!audio || !sessionId) return;
    setStatus("음성을 텍스트로 바꾸는 중...");
    try {
      const { text } = await transcribeAudio(sessionId, audio);
      setStatus(`인식된 내용: ${text}`);
      await analyze(text);
    } catch (e) {
      setStatus(null);
      setSttError(e instanceof Error ? e.message : "음성 인식에 실패했습니다.");
    }
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const error = micError ?? sttError ?? analyzeError;

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6 bg-slate-900 p-6 text-white">
      <button className="self-start text-2xl" onClick={() => navigate("/")}>×</button>
      <p className="text-lg">{recording ? "안내 방송을 듣고 있어요..." : "버튼을 눌러 녹음을 시작하세요"}</p>
      <p className="font-mono text-3xl">{mmss}</p>
      {status && <p className="text-center text-sm text-slate-300">{status}</p>}
      {error && (
        <div className="space-y-2 text-center">
          <p className="text-sm text-red-300">{error}</p>
          <button className="text-sm underline" onClick={() => navigate("/")}>텍스트로 입력하기</button>
        </div>
      )}
      {!recording ? (
        <button className="rounded-full bg-blue-600 px-8 py-4 font-semibold" onClick={start} disabled={loading}>
          녹음 시작
        </button>
      ) : (
        <button className="rounded-full bg-white px-8 py-4 font-semibold text-red-600" onClick={finish}>
          ■ 중지하고 분석하기
        </button>
      )}
    </div>
  );
}
