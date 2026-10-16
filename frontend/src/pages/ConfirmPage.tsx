import { useEffect, useState } from "react";
import { confirmChange, getHistory } from "../api/sessions";
import ChangeCard from "../components/result/ChangeCard";
import { useSessionStore } from "../stores/sessionStore";
import type { Change } from "../types";

// 시안 12번: 아직 확인하지 않은 변경만 모아 보기
export default function ConfirmPage() {
  const { sessionId } = useSessionStore();
  const [pending, setPending] = useState<Change[]>([]);

  useEffect(() => {
    if (sessionId) getHistory(sessionId).then((all) => setPending(all.filter((c) => c.status === "pending")));
  }, [sessionId]);

  const onConfirm = async (id: number, approve: boolean) => {
    await confirmChange(id, approve);
    setPending((list) => list.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-4 p-5">
      <h1 className="text-xl font-bold">확인이 필요한 안내</h1>
      {pending.length === 0 && <p className="text-slate-500">확인할 안내가 없습니다.</p>}
      {pending.map((c) => (
        <ChangeCard key={c.id} change={c} onConfirm={(ok) => onConfirm(c.id, ok)} />
      ))}
    </div>
  );
}
