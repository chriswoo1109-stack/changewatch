import type { Change, Fact } from "../../types";
import { changedFrom, formatTime } from "../../utils/format";

interface Props {
  facts: Fact[];
  recent?: Map<string, Change>; // 항목별 최근 반영된 변경 (이전 값 표시용)
}

export default function FactList({ facts, recent }: Props) {
  if (facts.length === 0) return <p className="text-sm text-slate-400">아직 정리된 안내가 없습니다.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {facts.map((f) => {
        const old = changedFrom(f, recent);
        return (
          <li key={f.key} className="flex items-center justify-between gap-3 py-3">
            <span className="text-slate-500">{f.label}</span>
            <span className="text-right">
              <span className="block text-lg font-bold">
                {old && <span className="mr-2 text-sm font-normal text-slate-400 line-through">{old}</span>}
                {f.value}
              </span>
              <span className={`text-xs ${old ? "font-semibold text-brand-600" : "text-slate-400"}`}>
                {old ? "바뀐 정보 · " : ""}
                {formatTime(f.updated_at)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
