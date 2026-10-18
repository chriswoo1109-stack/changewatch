import { useState } from "react";
import { Link } from "react-router-dom";
import ChangeCard from "../components/result/ChangeCard";
import { useHistory } from "../hooks/useHistory";
import { useSessionStore } from "../stores/sessionStore";
import type { Change } from "../types";

type Filter = "all" | "applied" | "pending" | "other";

const FILTERS: { value: Filter; label: string; match: (c: Change) => boolean }[] = [
  { value: "all", label: "전체", match: () => true },
  { value: "applied", label: "반영", match: (c) => c.status === "applied" },
  { value: "pending", label: "확인 필요", match: (c) => c.status === "pending" },
  { value: "other", label: "유지·거절", match: (c) => c.status === "ignored" || c.status === "rejected" },
];

// 시안 10번(변경 이력)
export default function HistoryPage() {
  const { sessionId } = useSessionStore();
  const { history, loading, error } = useHistory();
  const [filter, setFilter] = useState<Filter>("all");

  const pendingCount = history.filter((c) => c.status === "pending").length;
  const shown = history.filter(FILTERS.find((f) => f.value === filter)!.match);

  return (
    <div className="space-y-4 p-5">
      <h1 className="text-xl font-bold">기록</h1>
      {!sessionId && <p className="text-slate-500">진행 중인 방문이 없습니다.</p>}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {pendingCount > 0 && (
        <Link to="/confirm" className="block rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">
          ⚠ 확인이 필요한 안내 {pendingCount}건 →
        </Link>
      )}

      {history.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                filter === f.value ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {loading && history.length === 0 && <p className="text-sm text-slate-400">불러오는 중...</p>}
      {sessionId && !loading && !error && history.length === 0 && <p className="text-slate-500">아직 기록이 없습니다.</p>}
      {history.length > 0 && shown.length === 0 && <p className="text-sm text-slate-400">해당하는 기록이 없습니다.</p>}
      {shown.map((c) => (
        <ChangeCard key={c.id} change={c} showTime />
      ))}
    </div>
  );
}
