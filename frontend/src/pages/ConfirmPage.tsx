import { Link } from "react-router-dom";
import { confirmChange } from "../api/sessions";
import ChangeCard from "../components/result/ChangeCard";
import { useHistory } from "../hooks/useHistory";

// 시안 12번: 아직 확인하지 않은 변경만 모아 보기
export default function ConfirmPage() {
  const { history, setHistory, loading, error } = useHistory();
  const pending = history.filter((c) => c.status === "pending");

  const onConfirm = async (id: number, approve: boolean) => {
    const updated = await confirmChange(id, approve);
    setHistory((list) => list.map((c) => (c.id === id ? updated : c)));
  };

  return (
    <div className="space-y-4 p-5">
      <header>
        <h1 className="text-xl font-bold">확인이 필요한 안내</h1>
        <p className="text-sm text-slate-500">확실하지 않은 안내는 자동으로 반영하지 않아요. 직접 확인해 주세요.</p>
      </header>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      {loading && history.length === 0 && <p className="text-sm text-slate-400">불러오는 중...</p>}
      {!loading && !error && pending.length === 0 && (
        <div className="space-y-2">
          <p className="text-slate-500">확인할 안내가 없습니다.</p>
          <Link to="/session" className="text-sm text-blue-600 underline">
            오늘의 안내 보기
          </Link>
        </div>
      )}
      {pending.map((c) => (
        <ChangeCard key={c.id} change={c} showTime onConfirm={(ok) => onConfirm(c.id, ok)} />
      ))}
    </div>
  );
}
