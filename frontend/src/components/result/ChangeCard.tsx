import type { Change } from "../../types";
import { CHANGE_TYPE_LABEL } from "../../types";
import Badge from "../common/Badge";
import Card from "../common/Card";

interface Props {
  change: Change;
  onConfirm?: (approve: boolean) => void;
}

/** 변경 1건: 항목, 이전 값 → 새 값, 근거 문장, 처리 상태 */
export default function ChangeCard({ change, onConfirm }: Props) {
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold">
          {change.label} · {CHANGE_TYPE_LABEL[change.change_type]}
        </span>
        <Badge status={change.status} />
      </div>
      <p className="text-lg">
        <span className="text-slate-400">{change.old_value ?? "없음"}</span>
        <span className="mx-2">→</span>
        <span className="font-bold text-blue-600">{change.change_type === "cancel" ? "취소" : change.new_value}</span>
      </p>
      <p className="rounded-lg bg-slate-50 p-2 text-sm text-slate-600">“{change.evidence}”</p>
      <p className="text-xs text-slate-400">{change.reason}</p>
      {change.status === "pending" && onConfirm && (
        <div className="flex gap-2 pt-1">
          <button className="flex-1 rounded-lg border py-2 text-sm" onClick={() => onConfirm(false)}>
            아니에요
          </button>
          <button className="flex-1 rounded-lg bg-blue-600 py-2 text-sm text-white" onClick={() => onConfirm(true)}>
            맞아요, 반영
          </button>
        </div>
      )}
    </Card>
  );
}
