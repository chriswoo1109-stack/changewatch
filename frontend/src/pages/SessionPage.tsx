import Card from "../components/common/Card";
import FactList from "../components/session/FactList";
import { useCurrentSession } from "../hooks/useCurrentSession";

// 시안 5번(오늘의 안내 정리)
export default function SessionPage() {
  const { session, error } = useCurrentSession();
  if (error) return <p className="p-5 text-red-600">{error}</p>;
  if (!session) return <p className="p-5 text-slate-500">진행 중인 방문이 없습니다.</p>;

  return (
    <div className="space-y-4 p-5">
      <h1 className="text-xl font-bold">오늘의 안내 정리</h1>
      <p className="text-sm text-slate-500">{session.title}</p>
      <Card>
        <p className="mb-1 text-sm font-semibold">현재 유효한 정보</p>
        <FactList facts={session.facts} />
      </Card>
      {/* TODO(fe-session): 할 일 체크리스트 */}
    </div>
  );
}
