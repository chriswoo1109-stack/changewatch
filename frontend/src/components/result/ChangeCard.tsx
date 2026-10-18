import { useState } from "react";
import { Link } from "react-router-dom";
import type { Change } from "../../types";
import { CHANGE_TYPE_LABEL } from "../../types";
import { formatTime, showUrl, staffQuestion } from "../../utils/format";
import { euroRo } from "../../utils/josa";
import Badge from "../common/Badge";
import Card from "../common/Card";

interface Props {
  change: Change;
  onConfirm?: (approve: boolean) => Promise<void>;
  showTime?: boolean;
}

// 사용자에게는 추가 / 수정 / 취소 세 가지로 크게 구분해 보여줍니다. (단순 언급·불확실은 표시 안 함)
const KIND: Partial<Record<Change["change_type"], { label: string; className: string }>> = {
  new: { label: "추가", className: "bg-green-600" },
  change: { label: "수정", className: "bg-blue-600" },
  correction: { label: "수정", className: "bg-blue-600" },
  cancel: { label: "취소", className: "bg-red-600" },
};

/** 변경 1건: 항목, 이전 값 → 새 값, 근거 문장, 처리 상태 */
export default function ChangeCard({ change, onConfirm, showTime = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 반영되지 않은 안내(단순 언급, 거절 등)는 흐리게 보여줍니다.
  const muted = change.status === "ignored" || change.status === "rejected";

  const confirm = async (approve: boolean) => {
    if (!onConfirm) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(approve);
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={`space-y-2 ${change.status === "pending" ? "border-amber-300 bg-amber-50/40" : ""} ${muted ? "opacity-70" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-semibold">
          {KIND[change.change_type] && change.status !== "ignored" && (
            <span className={`rounded px-1.5 py-0.5 text-xs text-white ${KIND[change.change_type]!.className}`}>
              {KIND[change.change_type]!.label}
            </span>
          )}
          {change.label} <span className="font-normal text-slate-400">· {CHANGE_TYPE_LABEL[change.change_type]}</span>
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {showTime && <span className="text-xs text-slate-400">{formatTime(change.created_at)}</span>}
          <Badge status={change.status} />
        </div>
      </div>

      <ValueLine change={change} />

      <p className="rounded-lg bg-slate-50 p-2 text-sm text-slate-600">“{change.evidence}”</p>
      <p className="text-xs text-slate-400">{change.reason}</p>

      {change.status === "pending" && onConfirm && (
        <div className="space-y-2 pt-1">
          <p className="text-sm font-semibold text-amber-700">확실하지 않은 안내예요. 이 내용으로 바꿀까요?</p>
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-lg border border-slate-300 bg-white py-2.5 text-sm disabled:opacity-40"
              disabled={busy}
              onClick={() => confirm(false)}
            >
              아니에요
            </button>
            <button
              className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300"
              disabled={busy}
              onClick={() => confirm(true)}
            >
              {busy ? "처리 중..." : "맞아요, 반영"}
            </button>
          </div>
          {change.new_value && (
            <Link
              to={showUrl(
                staffQuestion(change.label, change.new_value),
                change.old_value ? `아까는 ${euroRo(change.old_value)} 들었어요` : undefined,
                change.id,
              )}
              className="block rounded-lg bg-slate-800 py-2.5 text-center text-sm font-semibold text-white"
            >
              🙋 직원에게 물어보기 (큰 글씨 화면)
            </Link>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </Card>
  );
}

/** 유형별 값 표시: 신규는 새 값만, 취소는 이전 값에 취소선, 나머지는 이전 → 새 값 */
function ValueLine({ change }: { change: Change }) {
  if (change.change_type === "cancel") {
    return (
      <p className="text-lg">
        {change.old_value && <span className="text-slate-400 line-through">{change.old_value}</span>}
        <span className="ml-2 font-bold text-red-600">취소</span>
      </p>
    );
  }
  const muted = change.status === "ignored" || change.status === "rejected";
  if (!change.old_value) {
    return <p className={`text-lg font-bold ${muted ? "text-slate-400" : "text-blue-600"}`}>{change.new_value ?? "-"}</p>;
  }
  return (
    <p className="text-lg">
      <span className={muted ? "font-bold text-slate-700" : "text-slate-400 line-through"}>{change.old_value}</span>
      <span className="mx-2 text-slate-400">{muted ? "유지 ·" : "→"}</span>
      <span className={muted ? "text-slate-400" : "font-bold text-blue-600"}>
        {muted ? `${change.new_value} ${change.status === "rejected" ? "거절" : "언급"}` : change.new_value}
      </span>
    </p>
  );
}
