import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { confirmChange } from "../api/sessions";
import AlertFlash from "../components/common/AlertFlash";
import Button from "../components/common/Button";
import ChangeCard from "../components/result/ChangeCard";
import { useAnalyze } from "../hooks/useAnalyze";
import { useSessionStore } from "../stores/sessionStore";
import type { AnalyzeResponse, Change } from "../types";
import { canSpeak, describeChange, speak } from "../utils/speak";

// 시안 4번(AI 요약 결과) + 12번(확인 요청)
export default function ResultPage() {
  const { lastResult } = useSessionStore();
  if (!lastResult) {
    return (
      <div className="space-y-3 p-5">
        <p className="text-slate-500">분석 결과가 없습니다.</p>
        <Link to="/" className="text-sm text-blue-600 underline">
          홈에서 안내 입력하기
        </Link>
      </div>
    );
  }
  // 다시 분석하면 새 결과로 화면 상태(알림, 펼침)를 처음부터 시작합니다.
  return <ResultView key={lastResult.announcement_id} lastResult={lastResult} />;
}

function ResultView({ lastResult }: { lastResult: AnalyzeResponse }) {
  const navigate = useNavigate();
  const { setLastResult } = useSessionStore();
  const [showIgnored, setShowIgnored] = useState(false);
  // 화면에 들어왔을 때 한 번만 깜빡여 알립니다.
  const [alert, setAlert] = useState(() => alertMessage(lastResult));

  const onConfirm = async (changeId: number, approve: boolean) => {
    const updated = await confirmChange(changeId, approve);
    setLastResult({
      ...lastResult,
      changes: lastResult.changes.map((c) => (c.id === changeId ? updated : c)),
    });
  };

  const pending = lastResult.changes.filter((c) => c.status === "pending");
  const applied = lastResult.changes.filter((c) => c.status === "applied");
  const others = lastResult.changes.filter((c) => c.status === "ignored" || c.status === "rejected");

  return (
    <div className="space-y-4 p-5">
      {alert && <AlertFlash message={alert} onClose={() => setAlert(null)} />}
      <div className="flex items-start justify-between gap-2">
        <Headline applied={applied} pending={pending} total={lastResult.changes.length} />
        {canSpeak && [...pending, ...applied].length > 0 && (
          <button
            className="shrink-0 rounded-full bg-slate-100 px-3 py-2 text-sm"
            onClick={() => speak([...applied, ...pending].map(describeChange).join(" "))}
          >
            🔊 다시 듣기
          </button>
        )}
      </div>
      <p className="whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
        <span className="mb-1 block text-xs text-slate-400">들은 안내</span>“{lastResult.text}”
      </p>
      {applied.length === 0 && pending.length === 0 && <RetryBox text={lastResult.text} />}

      {pending.length > 0 && (
        <Section title="확인이 필요해요">
          {pending.map((c) => (
            <ChangeCard key={c.id} change={c} onConfirm={(ok) => onConfirm(c.id, ok)} />
          ))}
        </Section>
      )}

      {applied.length > 0 && (
        <Section title="반영했어요">
          {applied.map((c) => (
            <ChangeCard key={c.id} change={c} />
          ))}
        </Section>
      )}

      {others.length > 0 && (
        <div className="space-y-2">
          <button className="text-sm text-slate-500 underline" onClick={() => setShowIgnored((v) => !v)}>
            반영하지 않은 안내 {others.length}건 {showIgnored ? "접기" : "보기"}
          </button>
          {showIgnored && (
            <>
              <p className="text-xs text-slate-400">단순히 언급되었거나 기존과 같은 내용이라 현재 정보를 바꾸지 않았어요.</p>
              {others.map((c) => (
                <ChangeCard key={c.id} change={c} />
              ))}
            </>
          )}
        </div>
      )}

      <Button className="w-full" onClick={() => navigate("/session")}>
        오늘의 안내 보기
      </Button>
    </div>
  );
}

/** 음성 인식이 틀렸을 때(예: "진료실" → "진료신") 문장을 고쳐서 다시 분석합니다. */
function RetryBox({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(text);
  const { analyze, loading, error } = useAnalyze();

  if (!open) {
    return (
      <button className="text-sm text-blue-600 underline" onClick={() => setOpen(true)}>
        잘못 알아들었나요? 고쳐서 다시 분석하기
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3">
      <p className="text-sm font-semibold">들은 문장을 고쳐 주세요</p>
      <textarea className="h-20 w-full rounded-lg border bg-white p-3 text-sm" value={draft} onChange={(e) => setDraft(e.target.value)} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button className="w-full" disabled={loading || !draft.trim()} onClick={() => analyze(draft)}>
        {loading ? "분석 중..." : "다시 분석하기"}
      </Button>
    </div>
  );
}

/** 바뀐 정보나 확인할 안내가 있을 때만 알림 문구를 만듭니다. */
function alertMessage(r: AnalyzeResponse | null) {
  if (!r) return null;
  const pending = r.changes.filter((c) => c.status === "pending").length;
  const changed = r.changes.filter((c) => c.status === "applied" && c.change_type !== "new").length;
  if (changed > 0) return `바뀐 정보가 ${changed}건 있어요!`;
  if (pending > 0) return "확인이 필요한 안내가 있어요!";
  return null;
}

function Headline({ applied, pending, total }: { applied: Change[]; pending: Change[]; total: number }) {
  // 실제로 값이 바뀐 것(변경·정정·취소)과 처음 정리된 것(신규)을 나눠서 말해 줍니다.
  const changed = applied.filter((c) => c.change_type !== "new").length;
  const added = applied.length - changed;

  let title = "바뀐 정보는 없어요";
  if (changed > 0) title = `바뀐 정보가 ${changed}건 있어요`;
  else if (added > 0) title = `새 안내 ${added}건을 정리했어요`;
  else if (pending.length > 0) title = "확인이 필요한 안내가 있어요";
  else if (total === 0) title = "추적할 만한 안내를 찾지 못했어요";

  const sub = [changed > 0 && added > 0 && `새 안내 ${added}건`, pending.length > 0 && `확인 필요 ${pending.length}건`]
    .filter(Boolean)
    .join(" · ");

  return (
    <header>
      <p className="text-xs font-semibold text-blue-600">AI 정리 결과</p>
      <h1 className="text-xl font-bold">{title}</h1>
      {sub && <p className="text-sm text-slate-500">{sub}</p>}
      {total > 0 && changed === 0 && added === 0 && pending.length === 0 && (
        <p className="text-sm text-slate-500">기존 정보를 그대로 유지합니다.</p>
      )}
    </header>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-500">{title}</h2>
      {children}
    </section>
  );
}
