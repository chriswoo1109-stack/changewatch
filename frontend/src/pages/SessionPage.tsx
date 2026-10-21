import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "../components/common/Card";
import EmptyState from "../components/common/EmptyState";
import Skeleton from "../components/common/Skeleton";
import Icon from "../components/common/Icon";
import PendingBanner from "../components/common/PendingBanner";
import CalendarList from "../components/session/CalendarList";
import FactTiles from "../components/session/FactTiles";
import TodoList from "../components/session/TodoList";
import { useCurrentSession } from "../hooks/useCurrentSession";
import { useHistory } from "../hooks/useHistory";
import { canceledChanges, latestAppliedChanges, showUrl, staffQuestion } from "../utils/format";
import { buildShareText, shareText } from "../utils/share";
import { canSpeak, describeFacts, speak } from "../utils/speak";

// 시안 5번(오늘의 안내 정리)
export default function SessionPage() {
  const navigate = useNavigate();
  const { session, loading, error } = useCurrentSession();
  const { history } = useHistory();
  const [toast, setToast] = useState<string | null>(null);
  if (error) return <p className="p-5 text-red-600">{error}</p>;
  if (loading) {
    return (
      <div className="space-y-4 p-5">
        <h1 className="text-xl font-bold">오늘의 안내 정리</h1>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
        <Skeleton className="h-28" />
      </div>
    );
  }
  if (!session) return <NoSession />;

  const recent = latestAppliedChanges(history);
  const pendingCount = history.filter((c) => c.status === "pending").length;
  const canceled = canceledChanges(recent, session.facts);

  const share = async () => {
    try {
      const r = await shareText(session.title, buildShareText(session.title, session.facts, recent, session.todos));
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

      <PendingBanner count={pendingCount} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">지금 유효한 정보</h2>
          <div className="flex gap-1.5">
            {canSpeak && (
              <button
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-card"
                onClick={() => speak(describeFacts(session.facts))}
                aria-label="읽어주기"
                title="읽어주기"
              >
                <Icon name="volume" className="h-4 w-4" />
              </button>
            )}
            <button
              className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm text-slate-600 shadow-card"
              onClick={share}
            >
              <Icon name="share" className="h-4 w-4" />
              가족에게 공유
            </button>
          </div>
        </div>
        <FactTiles facts={session.facts} recent={recent} canceled={canceled} />
      </section>

      <Card>
        <p className="mb-2 text-sm font-semibold">해야 할 일</p>
        <TodoList todos={session.todos} />
      </Card>

      <CalendarList facts={session.facts} title={session.title} />

      {session.facts.length > 0 && (
        <Card>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Icon name="ask" className="h-4 w-4 text-brand-600" />
            직원에게 확인하기
          </p>
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

      <Link to="/" className="block rounded-xl border border-brand-600 py-3 text-center font-semibold text-brand-600">
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
    <div className="space-y-4 p-5">
      <h1 className="text-xl font-bold">오늘의 안내 정리</h1>
      <EmptyState icon="list" title="진행 중인 방문이 없어요" description="방문을 시작하면 들은 안내가 여기에 정리돼요." action={{ to: "/", label: "방문 시작하기" }} />
    </div>
  );
}
