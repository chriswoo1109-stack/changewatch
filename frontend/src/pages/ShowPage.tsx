import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { confirmChange } from "../api/sessions";
import Icon from "../components/common/Icon";
import { useSessionStore } from "../stores/sessionStore";
import { canSpeak, speak } from "../utils/speak";

// 직원에게 보여주기: 확인 질문을 화면 가득 큰 글씨로 띄웁니다.
// 주소 예: /show?q=진료실이 7번 맞나요?&sub=아까는 5번이라고 들었어요&change=12
export default function ShowPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { lastResult, setLastResult } = useSessionStore();
  const question = params.get("q") ?? "";
  const sub = params.get("sub");
  const changeId = Number(params.get("change")) || null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 주소로 바로 열었으면(앱 안 이전 화면 없음) 뒤로 가기 대신 정리 화면으로
  const close = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate("/session", { replace: true }));

  const answer = async (approve: boolean) => {
    if (!changeId) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await confirmChange(changeId, approve);
      // 결과 화면에 같은 변경이 있으면 함께 갱신 (돌아갔을 때 다시 확인 버튼이 뜨지 않게)
      if (lastResult?.changes.some((c) => c.id === changeId)) {
        setLastResult({ ...lastResult, changes: lastResult.changes.map((c) => (c.id === changeId ? updated : c)) });
      }
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리하지 못했습니다.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white p-6">
      <div className="flex justify-between">
        <button className="text-slate-400" onClick={close} aria-label="닫기">
          <Icon name="close" className="h-8 w-8" />
        </button>
        {canSpeak && (
          <button className="flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-sm" onClick={() => speak(question)}>
            <Icon name="volume" className="h-4 w-4" />
            소리로 읽기
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-base text-slate-400">직원분께 여쭤봅니다</p>
        <p className="break-keep text-5xl font-extrabold leading-tight">{question}</p>
        {sub && <p className="break-keep text-2xl text-slate-500">{sub}</p>}
      </div>

      {changeId ? (
        <div className="space-y-2">
          <p className="text-center text-sm text-slate-400">직원의 답을 듣고 눌러 주세요</p>
          <div className="flex gap-3">
            <button
              className="flex-1 rounded-2xl border-2 border-slate-300 py-5 text-xl font-bold disabled:opacity-40"
              disabled={busy}
              onClick={() => answer(false)}
            >
              아니래요
            </button>
            <button
              className="flex-1 rounded-2xl bg-brand-600 py-5 text-xl font-bold text-white disabled:bg-slate-300"
              disabled={busy}
              onClick={() => answer(true)}
            >
              맞대요
            </button>
          </div>
          {error && <p className="text-center text-sm text-red-600">{error}</p>}
        </div>
      ) : (
        <button className="rounded-2xl bg-slate-100 py-4 text-lg font-semibold" onClick={close}>
          확인했어요
        </button>
      )}
    </div>
  );
}
