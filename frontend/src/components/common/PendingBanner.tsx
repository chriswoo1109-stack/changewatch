import { Link } from "react-router-dom";
import Icon from "./Icon";

/** "확인이 필요한 안내 N건" → 확인 요청 화면으로 가는 노란 띠 (홈·정리·기록 공용) */
export default function PendingBanner({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Link to="/confirm" className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">
      <Icon name="alert" className="h-5 w-5" />
      <span className="flex-1">확인이 필요한 안내 {count}건이 있어요</span>
      <Icon name="chevronRight" className="h-4 w-4" />
    </Link>
  );
}
