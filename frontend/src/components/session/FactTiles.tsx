import type { Change, Fact } from "../../types";
import { changedFrom, formatTime } from "../../utils/format";
import Icon, { type IconName } from "../common/Icon";

// 항목별 아이콘 (backend/app/domains/hospital.json의 key). 없는 항목은 기본 아이콘.
const ICON: Record<string, IconName> = {
  room: "door",
  wait_number: "ticket",
  exam_time: "flask",
  visit_time: "clock",
  medication: "pill",
  next_visit: "calendarDays",
};

interface Props {
  facts: Fact[];
  recent: Map<string, Change>; // 항목별 최근 반영된 변경 (바뀐 항목 강조용)
  canceled: Change[]; // 취소되어 지금은 없는 항목
}

/** 지금 유효한 정보를 2칸 타일로. 바뀐 항목은 초록 테두리, 취소된 항목은 빨간 취소선. */
export default function FactTiles({ facts, recent, canceled }: Props) {
  if (facts.length === 0 && canceled.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-card">
        아직 정리된 안내가 없어요.
        <br />
        안내를 들으면 여기에 정리돼요.
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3">
      {facts.map((f) => {
        const old = changedFrom(f, recent);
        return (
          <li
            key={f.key}
            className={`relative rounded-2xl p-4 shadow-card ${old ? "bg-brand-50 ring-2 ring-brand-500" : "bg-white"}`}
          >
            {old && (
              <span className="absolute right-3 top-3 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white">
                바뀜
              </span>
            )}
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${old ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600"}`}>
              <Icon name={ICON[f.key] ?? "info"} className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm text-slate-500">{f.label}</p>
            <p className="break-keep text-2xl font-extrabold leading-tight text-slate-900">{f.value}</p>
            <p className="mt-1 text-xs text-slate-400">
              {old ? (
                <>
                  <span className="line-through">{old}</span>에서 바뀜
                </>
              ) : (
                formatTime(f.updated_at)
              )}
            </p>
          </li>
        );
      })}
      {canceled.map((c) => (
        <li key={`cancel-${c.id}`} className="rounded-2xl bg-white p-4 opacity-80 shadow-card">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500">
            <Icon name={ICON[c.key] ?? "info"} className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm text-slate-500">{c.label}</p>
          <p className="text-2xl font-extrabold leading-tight text-slate-300 line-through">{c.old_value}</p>
          <p className="mt-1 text-xs font-semibold text-red-500">취소됨</p>
        </li>
      ))}
    </ul>
  );
}
