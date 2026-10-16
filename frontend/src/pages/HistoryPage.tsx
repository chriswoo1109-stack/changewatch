import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getHistory } from "../api/sessions";
import ChangeCard from "../components/result/ChangeCard";
import { useSessionStore } from "../stores/sessionStore";
import type { Change } from "../types";

// 시안 10번(변경 이력)
export default function HistoryPage() {
  const { sessionId } = useSessionStore();
  const [history, setHistory] = useState<Change[]>([]);

  useEffect(() => {
    if (sessionId) getHistory(sessionId).then(setHistory);
  }, [sessionId]);

  const pendingCount = history.filter((c) => c.status === "pending").length;

  return (
    <div className="space-y-4 p-5">
      <h1 className="text-xl font-bold">기록</h1>
      {pendingCount > 0 && (
        <Link to="/confirm" className="block rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          확인이 필요한 안내 {pendingCount}건 →
        </Link>
      )}
      {history.length === 0 && <p className="text-slate-500">아직 기록이 없습니다.</p>}
      {history.map((c) => (
        <ChangeCard key={c.id} change={c} />
      ))}
    </div>
  );
}
