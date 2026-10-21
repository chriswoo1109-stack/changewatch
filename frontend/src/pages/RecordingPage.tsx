import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { transcribeAudio } from "../api/announcements";
import AlertFlash from "../components/common/AlertFlash";
import Icon from "../components/common/Icon";
import ListenNotice from "../components/common/ListenNotice";
import ListeningOrb from "../components/common/ListeningOrb";
import { useAnalyze } from "../hooks/useAnalyze";
import { useCurrentSession } from "../hooks/useCurrentSession";
import { useRecorder } from "../hooks/useRecorder";
import { speechSupported, useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useSessionStore } from "../stores/sessionStore";
import { classifySentence, filterAnnouncement, isCompleteSentence, pickAlternative, type SentenceKind } from "../utils/filter";
import { speak, unlockSpeech } from "../utils/speak";

interface Line {
  text: string;
  kind: SentenceKind;
}

// 시안 3번(음성 인식 중)
// - 실시간 자막 지원 브라우저: Web Speech API로 바로 글자 표시 → 안내 문장만 분석
// - 미지원 브라우저: 녹음 후 서버 음성 인식(OpenAI) → 안내 문장만 분석
export default function RecordingPage() {
  const { sessionId } = useSessionStore();
  // 실시간 자막이 이 기기에서 실패하면 녹음 후 서버 인식 방식으로 바꿀 수 있습니다.
  const [useUpload, setUseUpload] = useState(!speechSupported);
  if (!sessionId) {
    return (
      <div className="space-y-3 p-5">
        <p className="text-slate-500">먼저 홈에서 방문을 시작해 주세요.</p>
        <Link to="/" className="text-sm text-brand-600 underline">
          홈으로
        </Link>
      </div>
    );
  }
  return useUpload ? <RecordAndUpload sessionId={sessionId} /> : <LiveCaption onFallback={() => setUseUpload(true)} />;
}

/** 내 번호·이름: 서버 세션 값이 기준, 아직 못 불러왔으면 이 기기에 저장된 값 */
function useMyKeywords() {
  const { myKeywords } = useSessionStore();
  const { session } = useCurrentSession();
  return session ? { waitNumber: session.my_number ?? "", name: session.my_name ?? "" } : myKeywords;
}

function LiveCaption({ onFallback }: { onFallback: () => void }) {
  const myKeywords = useMyKeywords();
  const { analyze, loading, error: analyzeError } = useAnalyze();
  const [lines, setLines] = useState<Line[]>([]);
  const linesRef = useRef<Line[]>([]);
  const [alert, setAlert] = useState<string | null>(null);
  const [emptyError, setEmptyError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { listening, ready, interim, error: micError, start, stop } = useSpeechRecognition((alternatives) => {
    let text = pickAlternative(alternatives, myKeywords);
    let prev = linesRef.current;
    // 브라우저가 말을 중간에 끊어 넘겨주면("진료실이" / "5번으로 변경되었습니다") 앞 조각과 이어 붙입니다.
    const last = prev[prev.length - 1];
    if (last && !isCompleteSentence(last.text)) {
      text = `${last.text} ${text}`;
      prev = prev.slice(0, -1);
    }
    const line = { text, kind: classifySentence(text, myKeywords) };
    linesRef.current = [...prev, line];
    setLines(linesRef.current);
    if (line.kind === "mine" && last?.kind !== "mine") {
      setAlert(`내 차례예요! “${text}”`);
      speak("내 차례입니다"); // 화면을 안 보고 있어도 알 수 있게 소리로도
    }
  });

  // 중괄호 필수: 최신 Chrome의 scrollIntoView는 Promise를 돌려줘서, 그대로 반환하면 React가 정리 함수로 착각해 화면이 멈춥니다.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, interim]);

  const begin = () => {
    linesRef.current = [];
    setLines([]);
    setEmptyError(null);
    start();
  };

  const finish = async () => {
    await stop();
    const kept = linesRef.current.filter((l) => l.kind !== "noise").map((l) => l.text);
    if (kept.length === 0) return setEmptyError("안내로 보이는 문장을 듣지 못했어요. 다시 들어 보거나 직접 입력해 주세요.");
    await analyze(kept.join("\n"));
  };

  const noiseCount = lines.filter((l) => l.kind === "noise").length;

  return (
    <Shell
      busy={loading}
      error={micError ?? emptyError ?? analyzeError}
      recording={listening}
      onStart={begin}
      onStop={finish}
      onFallback={micError ? onFallback : undefined}
      title={listening ? "듣고 있어요. 안내 문장만 골라서 분석해요" : loading ? "바뀐 정보를 찾는 중..." : "버튼을 눌러 듣기를 시작하세요"}
    >
      {/* 실시간 큰 자막 */}
      <div className="w-full flex-1 space-y-3 overflow-y-auto py-2" aria-live="polite">
        {lines.map((l, i) => (
          <p
            key={i}
            className={
              l.kind === "mine"
                ? "rounded-xl bg-amber-400 p-2 text-3xl font-bold leading-snug text-slate-900"
                : l.kind === "notice"
                  ? "text-3xl font-bold leading-snug"
                  : "text-lg leading-snug text-slate-500"
            }
          >
            {l.text}
            {l.kind === "noise" && <span className="ml-2 text-xs">(분석 제외)</span>}
          </p>
        ))}
        {interim && <p className="text-3xl leading-snug text-slate-400">{interim}</p>}
        {listening && !interim && lines.length === 0 && (
          <div className="flex justify-center py-10">
            <ListeningOrb state={ready ? "listening" : "idle"} />
          </div>
        )}
        {listening && !interim && (
          <p className={`text-center text-xl font-semibold ${ready ? "text-green-400" : "text-slate-500"}`}>
            {ready ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-400" />
                지금 말씀하세요
              </span>
            ) : (
              "마이크 준비 중... 잠시만요"
            )}
          </p>
        )}
        <div ref={bottomRef} />
      </div>
      {noiseCount > 0 && <p className="text-xs text-slate-500">번호·시간이 없는 말 {noiseCount}개는 분석에서 뺐어요</p>}
      {alert && <AlertFlash message={alert} onClose={() => setAlert(null)} />}
    </Shell>
  );
}

function RecordAndUpload({ sessionId }: { sessionId: string }) {
  const myKeywords = useMyKeywords();
  const { recording, seconds, error: micError, start, stop } = useRecorder();
  const { analyze, loading, error: analyzeError } = useAnalyze();
  const [status, setStatus] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);

  const begin = () => {
    setStatus(null);
    setSttError(null);
    start();
  };

  const finish = async () => {
    const audio = await stop();
    if (!audio) return;
    setTranscribing(true);
    setStatus("음성을 텍스트로 바꾸는 중...");
    try {
      const { text } = await transcribeAudio(sessionId, audio);
      const { kept } = filterAnnouncement(text, myKeywords); // 내 차례 알림은 분석 결과(my_turn)로 받습니다
      if (!kept) {
        setStatus(`인식된 내용: “${text}”`);
        setSttError("안내로 보이는 문장이 없었어요. 다시 들어 보거나 직접 입력해 주세요.");
        return;
      }
      setStatus(`인식된 내용: “${text}”\n바뀐 정보를 찾는 중...`);
      await analyze(kept);
    } catch (e) {
      setStatus(null);
      setSttError(e instanceof Error ? e.message : "음성 인식에 실패했습니다.");
    } finally {
      setTranscribing(false);
    }
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <Shell
      busy={transcribing || loading}
      error={micError ?? sttError ?? analyzeError}
      recording={recording}
      onStart={begin}
      onStop={finish}
      title={recording ? "안내 방송을 듣고 있어요..." : transcribing || loading ? "분석하고 있어요" : "버튼을 눌러 녹음을 시작하세요"}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <ListeningOrb state={recording ? "listening" : transcribing || loading ? "busy" : "idle"} />
        <p className="font-mono text-3xl">{mmss}</p>
        {status && <p className="whitespace-pre-line text-center text-sm text-slate-300">{status}</p>}
      </div>
    </Shell>
  );
}

interface ShellProps {
  title: string;
  recording: boolean;
  busy: boolean;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  onFallback?: () => void; // 실시간 자막 실패 시 녹음 방식으로 전환
  children: ReactNode;
}

/** 녹음 화면 공통 틀: 닫기, 안내 문구, 에러, 시작/중지 버튼 */
function Shell({ title, recording, busy, error, onStart, onStop, onFallback, children }: ShellProps) {
  const navigate = useNavigate();
  const { listenNoticeAgreed, agreeListenNotice } = useSessionStore();
  const [showNotice, setShowNotice] = useState(false);

  // 버튼을 누른 그 순간에 소리를 열어야 아이폰이 막지 않습니다.
  const startListening = () => {
    unlockSpeech();
    onStart();
  };
  const handleStart = () => (listenNoticeAgreed ? startListening() : setShowNotice(true));
  const agreeAndStart = () => {
    agreeListenNotice();
    setShowNotice(false);
    startListening();
  };
  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col items-center gap-4 bg-slate-900 p-5 text-white">
      <div className="flex w-full items-center justify-between">
        <button onClick={() => navigate("/")} aria-label="닫기" disabled={busy}>
          <Icon name="close" className="h-7 w-7" />
        </button>
        {recording && (
          <span className="flex animate-pulse items-center gap-1.5 text-sm text-red-400">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            듣는 중
          </span>
        )}
      </div>
      <p className="text-center text-slate-300">{title}</p>
      {children}
      {error && (
        <div className="space-y-1 text-center">
          <p className="text-sm text-red-300">{error}</p>
          <div className="flex justify-center gap-4">
            {onFallback && (
              <button className="text-sm underline" onClick={onFallback}>
                녹음 방식으로 시도
              </button>
            )}
            <button className="text-sm underline" onClick={() => navigate("/")}>
              텍스트로 입력하기
            </button>
          </div>
        </div>
      )}
      {!recording ? (
        <button className="mb-2 flex items-center gap-2 rounded-full bg-brand-600 px-8 py-4 text-lg font-semibold disabled:bg-slate-600" onClick={handleStart} disabled={busy}>
          <Icon name={busy ? "spinner" : "mic"} className="h-5 w-5" />
          {busy ? "처리 중..." : "듣기 시작"}
        </button>
      ) : (
        <button className="mb-2 flex items-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-semibold text-red-600" onClick={onStop}>
          <Icon name="stop" className="h-5 w-5" />
          중지하고 분석하기
        </button>
      )}
      {showNotice && <ListenNotice onAgree={agreeAndStart} onCancel={() => setShowNotice(false)} />}
    </div>
  );
}
