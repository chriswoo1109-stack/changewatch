import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createSession } from "../api/sessions";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import Icon from "../components/common/Icon";
import PendingBanner from "../components/common/PendingBanner";
import { useAnalyze } from "../hooks/useAnalyze";
import { useCurrentSession } from "../hooks/useCurrentSession";
import { useHistory } from "../hooks/useHistory";
import { useSessionStore } from "../stores/sessionStore";

// 시연용 예시 문장 (README 시연 순서와 같음). 누르면 입력칸에 채워집니다.
const EXAMPLES = [
  "진료실은 3번입니다.",
  "5번 진료실은 지금 혼잡합니다.",
  "진료실이 5번으로 변경되었습니다.",
  "아마 진료실이 7번일 거예요.",
  "처방전은 약국에 제출하세요.",
];

// 시안 2번(메인) + 6번(장소 선택)
export default function HomePage() {
  const navigate = useNavigate();
  const { setSessionId, myKeywords, setMyKeywords } = useSessionStore();
  const { session, error: sessionError } = useCurrentSession();
  const { history } = useHistory();
  const { analyze, loading, error } = useAnalyze();
  const [title, setTitle] = useState("오늘 병원 방문");
  const [myNumber, setMyNumber] = useState(myKeywords.waitNumber);
  const [text, setText] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState(false);

  // 병원에서 받은 예약 문자 등을 복사해 두었다가 그대로 가져옵니다.
  const pasteFromClipboard = async () => {
    setPasteError(null);
    try {
      const copied = await navigator.clipboard.readText();
      if (copied.trim()) setText(copied.trim());
      else setPasteError("복사한 내용이 없어요. 문자를 길게 눌러 복사한 뒤 다시 눌러 주세요.");
    } catch {
      setPasteError("붙여넣기 권한이 없어요. 입력칸을 길게 눌러 직접 붙여넣어 주세요.");
    }
  };

  const start = async () => {
    setStarting(true);
    setStartError(null);
    try {
      // 내 번호·이름을 함께 보내면 서버가 분석할 때 내 차례(my_turn)를 알려줍니다.
      const s = await createSession(title.trim() || "오늘 병원 방문", "hospital", {
        my_number: myNumber.trim() || null,
        my_name: myKeywords.name.trim() || null,
      });
      setMyKeywords({ ...myKeywords, waitNumber: myNumber.trim() });
      setSessionId(s.id);
    } catch {
      setStartError("방문을 시작하지 못했습니다. 백엔드가 실행 중인지 확인하세요.");
    } finally {
      setStarting(false);
    }
  };

  const endVisit = () => {
    if (window.confirm("방문을 종료할까요? 지금까지 정리한 안내는 이 화면에서 더 이상 보이지 않아요.")) setSessionId(null);
  };

  const pendingCount = history.filter((c) => c.status === "pending").length;

  return (
    <div className="space-y-5 p-5">
      <header>
        <h1 className="text-2xl font-bold">
          체인지<span className="text-brand-600">워치</span>
        </h1>
        <p className="text-sm text-slate-500">들은 안내를 정리하고, 바뀐 정보만 알려드려요.</p>
      </header>

      {sessionError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{sessionError}</p>}

      {!session ? (
        <Card className="space-y-3">
          <p className="font-semibold">어디에서 들으시나요?</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-brand-600 p-3 font-semibold text-brand-600">
              <Icon name="hospital" className="h-5 w-5" />
              병원
            </span>
            <span className="rounded-lg border p-3 text-center text-slate-300">은행 (준비 중)</span>
          </div>
          <input
            className="w-full rounded-lg border p-3"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="방문 이름 (예: 수원 OO병원)"
          />
          <input
            className="w-full rounded-lg border p-3"
            inputMode="numeric"
            value={myNumber}
            onChange={(e) => setMyNumber(e.target.value)}
            placeholder="내 대기번호 (선택, 예: 37) — 불리면 알려드려요"
          />
          {startError && <p className="text-sm text-red-600">{startError}</p>}
          <Button className="w-full" onClick={start} loading={starting}>
            {starting ? "시작하는 중..." : "새 방문 시작하기"}
          </Button>
        </Card>
      ) : (
        <>
          <Card className="space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-400">현재 방문</p>
                <p className="font-semibold">{session.title}</p>
                {(session.my_number || session.my_name) && (
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <Icon name="bell" className="h-3.5 w-3.5 text-brand-600" />
                    {[session.my_number && `${session.my_number}번`, session.my_name].filter(Boolean).join(" · ")} 불리면 알림
                  </p>
                )}
              </div>
              <button className="text-xs text-slate-400 underline" onClick={endVisit}>
                방문 종료
              </button>
            </div>
            {session.facts.length > 0 && (
              <Link to="/session" className="flex flex-wrap gap-1.5 pt-1">
                {session.facts.map((f) => (
                  <span key={f.key} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-700">
                    {f.label} <b>{f.value}</b>
                  </span>
                ))}
              </Link>
            )}
          </Card>
          <PendingBanner count={pendingCount} />

          <button
            onClick={() => navigate("/record")}
            className="mx-auto flex h-36 w-36 flex-col items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-200 active:scale-95"
          >
            <Icon name="mic" className="h-12 w-12" />
            <span className="mt-1 font-semibold">듣기 시작하기</span>
          </button>

          <Card className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="whitespace-nowrap text-sm font-semibold">{session.facts.length === 0 ? "기준 정보 등록" : "안내를 직접 입력하기"}</p>
                {session.facts.length === 0 && (
                  <p className="text-xs text-slate-400">예약 문자나 안내문을 먼저 넣어 두면, 이후 바뀐 점만 알려드려요.</p>
                )}
              </div>
              {"clipboard" in navigator && (
                <button className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold" onClick={pasteFromClipboard}>
                  <Icon name="paste" className="h-4 w-4" />
                  문자 가져오기
                </button>
              )}
            </div>
            <textarea
              className="h-24 w-full rounded-lg border p-3 text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                session.facts.length === 0
                  ? "예: [OO병원] 10월 20일 오후 2시 3번 진료실 진료 예약되었습니다."
                  : "예: 진료실이 5번으로 변경되었습니다."
              }
            />
            <button
              className="flex items-center gap-1 text-sm text-slate-500"
              onClick={() => setShowExamples((v) => !v)}
              aria-expanded={showExamples}
            >
              예시 문장 {showExamples ? "접기" : "보기"}
              <Icon name="chevronDown" className={`h-4 w-4 transition ${showExamples ? "rotate-180" : ""}`} />
            </button>
            {showExamples && (
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                  onClick={() => setText(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
            )}
            {pasteError && <p className="text-sm text-amber-700">{pasteError}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button className="w-full" loading={loading} disabled={!text.trim()} onClick={() => analyze(text)}>
              {loading ? "바뀐 정보를 찾는 중..." : "분석하기"}
            </Button>
          </Card>
        </>
      )}
    </div>
  );
}
