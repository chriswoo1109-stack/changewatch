import type { ChangeStatus } from "../../types";
import { STATUS_LABEL } from "../../types";

const colors: Record<ChangeStatus, string> = {
  applied: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  ignored: "bg-slate-100 text-slate-500",
  rejected: "bg-red-100 text-red-600",
};

export default function Badge({ status }: { status: ChangeStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[status]}`}>{STATUS_LABEL[status]}</span>;
}
