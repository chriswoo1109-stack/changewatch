import { useNavigate } from "react-router-dom";
import { confirmChange } from "../api/sessions";
import Button from "../components/common/Button";
import ChangeCard from "../components/result/ChangeCard";
import { useSessionStore } from "../stores/sessionStore";

// 시안 4번(AI 요약 결과) + 12번(확인 요청)
export default function ResultPage() {
  const navigate = useNavigate();
  const { lastResult, setLastResult } = useSessionStore();

  if (!lastResult) {
    return <p className="p-5 text-slate-500">분석 결과가 없습니다. 홈에서 안내를 입력해 주세요.</p>;
  }

  const onConfirm = async (changeId: number, approve: boolean) => {
    const updated = await confirmChange(changeId, approve);
    setLastResult({
      ...lastResult,
      changes: lastResult.changes.map((c) => (c.id === changeId ? updated : c)),
    });
  };

  return (
    <div className="space-y-4 p-5">
      <h1 className="text-xl font-bold">AI가 내용을 정리했어요</h1>
      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">“{lastResult.text}”</p>
      {lastResult.changes.length === 0 ? (
        <p className="text-slate-500">추적할 만한 안내를 찾지 못했어요.</p>
      ) : (
        lastResult.changes.map((c) => <ChangeCard key={c.id} change={c} onConfirm={(ok) => onConfirm(c.id, ok)} />)
      )}
      <Button className="w-full" onClick={() => navigate("/session")}>
        확인했어요
      </Button>
    </div>
  );
}
