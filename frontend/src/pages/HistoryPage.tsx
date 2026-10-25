import { useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/common/EmptyState";
import Icon, { type IconName } from "../components/common/Icon";
import PendingBanner from "../components/common/PendingBanner";
import { SkeletonList } from "../components/common/Skeleton";
import { ValueLine } from "../components/result/ChangeCard";
import { useHistory } from "../hooks/useHistory";
import { useSessionStore } from "../stores/sessionStore";
import type { Change } from "../types";
import { CHANGE_TYPE_LABEL, STATUS_LABEL } from "../types";
import { formatTime } from "../utils/format";

type Filter = "all" | "applied" | "pending" | "other";

const FILTERS: { value: Filter; label: string; match: (c: Change) => boolean }[] = [
  { value: "all", label: "전체", match: () => true },
  { value: "applied", label: "반영", match: (c) => c.status === "applied" },
  { value: "pending", label: "확인 필요", match: (c) => c.status === "pending" },
  { value: "other", label: "유지·거절", match: (c) => c.status === "ignored" || c.status === "rejected" },
];

// 시안 10번(변경 이력): 위가 최신인 타임라인
export default function HistoryPage() {
  const { sessionId } = useSessionStore();
  const { history, loading, error } = useHistory();
  const [filter, setFilter] = useState<Filter>("all");

  const pendingCount = history.filter((c) => c.status === "pending").length;
  const shown = history.filter(FILTERS.find((f) => f.value === filter)!.match);

  return (
    <div className="space-y-4 p-5">
      <header>
        <h1 className="text-xl font-bold">기록</h1>
        {history.length > 0 && <p className="text-sm text-slate-500">들은 안내가 시간 순서대로 쌓여요. 위가 최신이에요.</p>}
      </header>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {!sessionId ? (
        <EmptyState icon="history" title="진행 중인 방문이 없어요" description="방문을 시작하면 들은 안내가 여기에 기록돼요." action={{ to: "/", label: "방문 시작하기" }} />
      ) : loading && history.length === 0 ? (
        <SkeletonList />
      ) : !error && history.length === 0 ? (
        <EmptyState icon="history" title="아직 기록이 없어요" description="안내를 들으면 바뀐 내용이 시간 순서대로 쌓여요." action={{ to: "/", label: "안내 듣기" }} />
      ) : (
        <>
          <PendingBanner count={pendingCount} />
          <div className="flex gap-2 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                  filter === f.value ? "bg-slate-800 text-white" : "bg-white text-slate-600 shadow-card"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">해당하는 기록이 없어요.</p>
          ) : (
            <ol>
              {shown.map((c, i) => (
                <TimelineItem key={c.id} change={c} last={i === shown.length - 1} />
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

// 상태별 점 색과 아이콘: 반영(유형별 색) / 확인 필요(노랑) / 유지·거절(회색)
function dotStyle(c: Change): { className: string; icon?: IconName } {
  if (c.status === "pending") return { className: "bg-amber-400 text-white", icon: "alert" };
  if (c.status === "rejected") return { className: "bg-slate-300 text-white", icon: "close" };
  if (c.status === "ignored") return { className: "bg-slate-200" };
  if (c.change_type === "cancel") return { className: "bg-red-500 text-white", icon: "close" };
  if (c.change_type === "new") return { className: "bg-brand-600 text-white", icon: "check" };
  return { className: "bg-blue-600 text-white", icon: "arrowRight" };
}

/** 타임라인 한 칸: 왼쪽 세로줄 + 상태 점, 오른쪽에 시간과 내용 */
function TimelineItem({ change, last }: { change: Change; last: boolean }) {
  const dot = dotStyle(change);
  const muted = change.status === "ignored" || change.status === "rejected";
  return (
    <li className={`relative pl-10 ${last ? "" : "pb-4"}`}>
      {!last && <span className="absolute bottom-0 left-[13px] top-7 w-0.5 bg-slate-200" aria-hidden />}
      <span className={`absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-slate-50 ${dot.className}`}>
        {dot.icon && <Icon name={dot.icon} className="h-3.5 w-3.5" />}
      </span>
      <p className="flex items-center gap-2 text-xs text-slate-500">
        <span className="font-semibold">{formatTime(change.created_at)}</span>
        <span>
          {CHANGE_TYPE_LABEL[change.change_type]} · {STATUS_LABEL[change.status]}
        </span>
      </p>
      <div className={`mt-1.5 rounded-2xl bg-white p-4 shadow-card ${muted ? "opacity-75" : ""} ${change.status === "pending" ? "ring-2 ring-amber-300" : ""}`}>
        <p className="text-sm font-semibold text-slate-500">{change.label}</p>
        <ValueLine change={change} />
        <p className="mt-1 text-sm text-slate-500">“{change.evidence}”</p>
        {change.status === "pending" && (
          <Link to="/confirm" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-amber-700">
            확인하러 가기
            <Icon name="chevronRight" className="h-4 w-4" />
          </Link>
        )}
      </div>
    </li>
  );
}
