import type { Change } from "../../types";
import { valueSize } from "../../utils/format";
import { iGa } from "../../utils/josa";
import Icon from "../common/Icon";

/**
 * 결과 화면의 주인공 카드: 반영된 변경 1건을 크게 보여줍니다.
 * - 변경·정정: 초록 카드에 "3번 → 5번"
 * - 취소: 빨간 테두리 카드에 취소선
 * - 신규: 흰 카드에 새 값
 */
export default function ChangeHero({ change }: { change: Change }) {
  if (change.change_type === "cancel") {
    return (
      <div className="rounded-3xl bg-white p-5 shadow-card ring-2 ring-red-200">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
          <Icon name="close" className="h-4 w-4" />
          {iGa(change.label)} 취소됐어요
        </p>
        <p className={`mt-2 break-keep font-black text-slate-400 line-through decoration-red-400 decoration-4 ${valueSize(change.old_value, "text-4xl", "text-2xl")}`}>
          {change.old_value ?? change.label}
        </p>
        <p className="mt-3 text-sm text-slate-500">“{change.evidence}”</p>
      </div>
    );
  }

  if (!change.old_value) {
    return (
      <div className="rounded-3xl bg-white p-5 shadow-card">
        <p className="text-sm font-semibold text-brand-600">새로 정리했어요 · {change.label}</p>
        <p className={`mt-1 break-keep font-black text-slate-900 ${valueSize(change.new_value, "text-4xl", "text-2xl")}`}>{change.new_value}</p>
        <p className="mt-3 text-sm text-slate-500">“{change.evidence}”</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-600 to-brand-700 p-5 text-white shadow-lg shadow-brand-600/20">
      {/* 배경 장식 원 */}
      <span className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" aria-hidden />
      <p className="relative text-sm font-semibold text-brand-100">
        {iGa(change.label)} {change.change_type === "correction" ? "정정됐어요" : "바뀌었어요"}
      </p>
      <div className="relative mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-2xl font-bold text-white/60 line-through">{change.old_value}</span>
        <Icon name="arrowRight" className="h-6 w-6 text-white/80" />
        <span className={`break-keep font-black tracking-tight ${valueSize(change.new_value, "text-5xl", "text-2xl")}`}>{change.new_value}</span>
      </div>
      <p className="relative mt-4 rounded-xl bg-white/10 px-3 py-2 text-sm text-white/90">“{change.evidence}”</p>
    </div>
  );
}
