import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSession } from "../api/sessions";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import { useAnalyze } from "../hooks/useAnalyze";
import { useCurrentSession } from "../hooks/useCurrentSession";
import { useSessionStore } from "../stores/sessionStore";

// 시안 2번(메인) + 6번(장소 선택)
export default function HomePage() {
  const navigate = useNavigate();
  const { setSessionId } = useSessionStore();
  const { session, error: sessionError } = useCurrentSession();
  const { analyze, loading, error } = useAnalyze();
  const [title, setTitle] = useState("오늘 병원 방문");
  const [text, setText] = useState("");

  const start = async () => {
    const s = await createSession(title.trim() || "오늘 병원 방문", "hospital");
    setSessionId(s.id);
  };

  return (
    <div className="space-y-5 p-5">
      <header>
        <h1 className="text-2xl font-bold">체인지워치</h1>
        <p className="text-sm text-slate-500">들은 안내를 정리하고, 바뀐 정보만 알려드려요.</p>
      </header>

      {sessionError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{sessionError}</p>}

      {!session ? (
        <Card className="space-y-3">
          <p className="font-semibold">어디에서 들으시나요?</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="rounded-lg border-2 border-blue-600 p-3 text-center font-semibold text-blue-600">병원</span>
            <span className="rounded-lg border p-3 text-center text-slate-300">은행 (준비 중)</span>
          </div>
          <input
            className="w-full rounded-lg border p-3"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="방문 이름 (예: 수원 OO병원)"
          />
          <Button className="w-full" onClick={start}>
            새 방문 시작하기
          </Button>
        </Card>
      ) : (
        <>
          <Card>
            <p className="text-xs text-slate-400">현재 방문</p>
            <p className="font-semibold">{session.title}</p>
            <button className="mt-1 text-xs text-slate-400 underline" onClick={() => setSessionId(null)}>
              방문 종료하고 새로 시작
            </button>
          </Card>

          <button
            onClick={() => navigate("/record")}
            className="mx-auto flex h-36 w-36 flex-col items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200 active:scale-95"
          >
            <span className="text-4xl">🎙</span>
            <span className="mt-1 font-semibold">듣기 시작하기</span>
          </button>

          <Card className="space-y-2">
            <p className="text-sm font-semibold">안내를 직접 입력하기</p>
            <textarea
              className="h-24 w-full rounded-lg border p-3 text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="예: 진료실이 5번으로 변경되었습니다."
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button className="w-full" disabled={loading || !text.trim()} onClick={() => analyze(text)}>
              {loading ? "분석 중..." : "분석하기"}
            </Button>
          </Card>
        </>
      )}
    </div>
  );
}
