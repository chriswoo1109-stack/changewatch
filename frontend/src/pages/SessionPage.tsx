import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "../components/common/Card";
import CalendarList from "../components/session/CalendarList";
import FactList from "../components/session/FactList";
import TodoList from "../components/session/TodoList";
import { useCurrentSession } from "../hooks/useCurrentSession";
import { useHistory } from "../hooks/useHistory";
import { canceledChanges, latestAppliedChanges, showUrl, staffQuestion } from "../utils/format";
import { buildShareText, shareText } from "../utils/share";
import { canSpeak, describeFacts, speak } from "../utils/speak";

// 시안 5번(오늘의 안내 정리)
export default function SessionPage() {
  const navigate = useNavigate();
  const { session, error } = useCurrentSession();
  const { history } = useHistory();
  const [toast, setToast] = useState<string | null>(null);
  if (error) return <p className="p-5 text-red-600">{error}</p>;
  if (!session) return <NoSession />;

  const recent = latestAppliedChanges(history);
  const pendingCount = history.filter((c) => c.status === "pending").length;
  const canceled = canceledChanges(recent, session.facts);

  const share = async () => {
    try {
      const r = await shareText(session.title, buildShareText(session.title, session.facts, recent));
      if (r === "copied") setToast("복사했어요. 메신저에 붙여넣어 보내세요.");
    } catch {
      setToast("공유하지 못했어요.");
    }
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="space-y-4 p-5">
      <header>
        <h1 className="text-xl font-bold">오늘의 안내 정리</h1>
        <p className="text-sm text-slate-500">{session.title}</p>
      </header>

      {pendingCount > 0 && (
        <Link to="/confirm" className="block rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">
          ⚠ 확인이 필요한 안내 {pendingCount}건이 있어요 →
        </Link>
      )}

      <Card>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-semibold">지금 유효한 정보</p>
          <div className="flex gap-1.5">
            {canSpeak && (
              <button className="rounded-full bg-slate-100 px-3 py-1.5 text-xs" onClick={() => speak(describeFacts(session.facts))}>
                🔊 읽어주기
              </button>
            )}
            <button className="rounded-full bg-slate-100 px-3 py-1.5 text-xs" onClick={share}>
              📤 가족에게 공유
            </button>
          </div>
        </div>
        <FactList facts={session.facts} recent={recent} />
        {canceled.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
            {canceled.map((c) => (
              <li key={c.id} className="flex justify-between text-sm">
                <span className="text-slate-400">{c.label}</span>
                <span>
                  <span className="mr-2 text-slate-400 line-through">{c.old_value}</span>
                  <span className="font-semibold text-red-600">취소됨</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <p className="mb-2 text-sm font-semibold">해야 할 일</p>
        <TodoList facts={session.facts} />
      </Card>

      <CalendarList facts={session.facts} title={session.title} />

      {session.facts.length > 0 && (
        <Card>
          <p className="mb-2 text-sm font-semibold">🙋 직원에게 확인하기</p>
          <p className="mb-2 text-xs text-slate-400">누르면 큰 글씨로 보여드려요. 화면을 직원에게 보여주세요.</p>
          <div className="flex flex-wrap gap-2">
            {session.facts.map((f) => (
              <button
                key={f.key}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-sm"
                onClick={() => navigate(showUrl(staffQuestion(f.label, f.value)))}
              >
                {staffQuestion(f.label, f.value)}
              </button>
            ))}
          </div>
        </Card>
      )}

      <Link to="/" className="block rounded-xl border border-blue-600 py-3 text-center font-semibold text-blue-600">
        새 안내 듣기
      </Link>

      {toast && (
        <p className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-slate-800 px-4 py-2 text-sm text-white">{toast}</p>
      )}
    </div>
  );
}

function NoSession() {
  return (
    <div className="space-y-3 p-5">
      <h1 className="text-xl font-bold">오늘의 안내 정리</h1>
      <p className="text-slate-500">진행 중인 방문이 없습니다.</p>
      <Link to="/" className="inline-block text-sm text-blue-600 underline">
        홈에서 방문 시작하기
      </Link>
    </div>
  );
}
