import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { confirmChange } from "../api/sessions";
import AlertFlash from "../components/common/AlertFlash";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";
import ChangeCard from "../components/result/ChangeCard";
import ChangeHero from "../components/result/ChangeHero";
import Icon from "../components/common/Icon";
import { useAnalyze } from "../hooks/useAnalyze";
import { useCurrentSession } from "../hooks/useCurrentSession";
import { useSessionStore } from "../stores/sessionStore";
import type { AnalyzeResponse, Change, Todo } from "../types";
import { canSpeak, describeChange, describeTodos, speak } from "../utils/speak";

// 시안 4번(AI 요약 결과) + 12번(확인 요청)
export default function ResultPage() {
  const { lastResult } = useSessionStore();
  if (!lastResult) {
    return (
      <div className="p-5">
        <EmptyState icon="mic" title="아직 분석한 안내가 없어요" description="안내를 듣거나 직접 입력하면 바뀐 정보를 정리해 드려요." action={{ to: "/", label: "안내 입력하기" }} />
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
  const myTurn = lastResult.my_turn;
  const todos = lastResult.todos ?? [];

  // 내 차례는 화면을 안 보고 있어도 알 수 있게 소리로도 알립니다.
  useEffect(() => {
    if (myTurn) speak(`내 차례입니다. ${myTurn.evidence}`);
  }, [myTurn]);

  // 아래 "지금 유효한 정보" 요약용. 확인 요청을 처리하면 다시 불러옵니다.
  const { session, reload } = useCurrentSession();

  const onConfirm = async (changeId: number, approve: boolean) => {
    const updated = await confirmChange(changeId, approve);
    setLastResult({
      ...lastResult,
      changes: lastResult.changes.map((c) => (c.id === changeId ? updated : c)),
    });
    reload();
  };

  const pending = lastResult.changes.filter((c) => c.status === "pending");
  const applied = lastResult.changes.filter((c) => c.status === "applied");
  const others = lastResult.changes.filter((c) => c.status === "ignored" || c.status === "rejected");

  return (
    <div className="space-y-4 p-5">
      {alert && <AlertFlash message={alert} onClose={() => setAlert(null)} />}
      <div className="flex items-start justify-between gap-2">
        <Headline applied={applied} pending={pending} todos={todos} total={lastResult.changes.length} />
        {canSpeak && (applied.length > 0 || pending.length > 0 || todos.length > 0) && (
          <button
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 shadow-card"
            onClick={() => speak([...[...applied, ...pending].map(describeChange), describeTodos(todos)].join(" "))}
            aria-label="다시 듣기"
            title="다시 듣기"
          >
            <Icon name="volume" className="h-5 w-5" />
          </button>
        )}
      </div>
      {myTurn && (
        <div className="rounded-3xl bg-amber-400 p-5 text-slate-900 shadow-lg shadow-amber-400/30" role="status">
          <p className="flex items-center gap-2 text-2xl font-black">
            <Icon name="bell" className="h-7 w-7" />
            내 차례예요! ({myTurn.matched})
          </p>
          <p className="mt-2 rounded-xl bg-white/40 px-3 py-2 text-sm">“{myTurn.evidence}”</p>
        </div>
      )}

      {applied.map((c) => (
        <ChangeHero key={c.id} change={c} />
      ))}

      <p className="whitespace-pre-line rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-card">
        <span className="mb-1 block text-xs font-semibold text-slate-400">들은 안내</span>“{lastResult.text}”
      </p>
      {applied.length === 0 && pending.length === 0 && todos.length === 0 && !myTurn && <RetryBox text={lastResult.text} />}

      {pending.length > 0 && (
        <Section title="확인이 필요해요">
          {pending.map((c) => (
            <ChangeCard key={c.id} change={c} onConfirm={(ok) => onConfirm(c.id, ok)} />
          ))}
        </Section>
      )}

      {todos.length > 0 && (
        <Section title="할 일이 생겼어요">
          <ul className="space-y-2">
            {todos.map((t) => (
              <li key={t.id} className="rounded-2xl bg-white p-4 shadow-card">
                <p className="flex items-start gap-2 font-semibold">
                  <Icon name="square" className="mt-0.5 h-5 w-5 text-slate-400" />
                  {t.text}
                </p>
                <p className="mt-1 text-xs text-slate-400">“{t.evidence}”</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400">오늘의 안내 화면에서 체크할 수 있어요.</p>
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

      {session && session.facts.length > 0 && (
        <Link to="/session" className="block rounded-2xl bg-white p-4 shadow-card">
          <p className="flex items-center justify-between text-sm font-semibold text-slate-500">
            지금 유효한 정보
            <Icon name="chevronRight" className="h-4 w-4" />
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {session.facts.map((f) => (
              <span key={f.key} className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700">
                {f.label} <b>{f.value}</b>
              </span>
            ))}
          </div>
        </Link>
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
      <button className="text-sm text-brand-600 underline" onClick={() => setOpen(true)}>
        잘못 알아들었나요? 고쳐서 다시 분석하기
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border border-brand-200 bg-brand-50/50 p-3">
      <p className="text-sm font-semibold">들은 문장을 고쳐 주세요</p>
      <textarea className="h-20 w-full rounded-lg border bg-white p-3 text-sm" value={draft} onChange={(e) => setDraft(e.target.value)} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button className="w-full" loading={loading} disabled={!draft.trim()} onClick={() => analyze(draft)}>
        {loading ? "분석 중..." : "다시 분석하기"}
      </Button>
    </div>
  );
}

/** 바뀐 정보나 확인할 안내가 있을 때만 알림 문구를 만듭니다. */
function alertMessage(r: AnalyzeResponse | null) {
  if (!r) return null;
  if (r.my_turn) return `내 차례예요! (${r.my_turn.matched})`;
  const pending = r.changes.filter((c) => c.status === "pending").length;
  const changed = r.changes.filter((c) => c.status === "applied" && c.change_type !== "new").length;
  if (changed > 0) return `바뀐 정보가 ${changed}건 있어요!`;
  if (pending > 0) return "확인이 필요한 안내가 있어요!";
  return null;
}

function Headline({ applied, pending, todos, total }: { applied: Change[]; pending: Change[]; todos: Todo[]; total: number }) {
  // 실제로 값이 바뀐 것(변경·정정·취소)과 처음 정리된 것(신규)을 나눠서 말해 줍니다.
  const changed = applied.filter((c) => c.change_type !== "new").length;
  const added = applied.length - changed;

  let title = "바뀐 정보는 없어요";
  if (changed > 0) title = `바뀐 정보가 ${changed}건 있어요`;
  else if (added > 0) title = `새 안내 ${added}건을 정리했어요`;
  else if (pending.length > 0) title = "확인이 필요한 안내가 있어요";
  else if (todos.length > 0) title = `할 일 ${todos.length}건이 생겼어요`;
  else if (total === 0) title = "추적할 만한 안내를 찾지 못했어요";

  const sub = [
    changed > 0 && added > 0 && `새 안내 ${added}건`,
    pending.length > 0 && `확인 필요 ${pending.length}건`,
    todos.length > 0 && (changed > 0 || added > 0 || pending.length > 0) && `할 일 ${todos.length}건`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <header>
      <p className="text-xs font-semibold text-brand-600">AI 정리 결과</p>
      <h1 className="text-xl font-bold">{title}</h1>
      {sub && <p className="text-sm text-slate-500">{sub}</p>}
      {total > 0 && changed === 0 && added === 0 && pending.length === 0 && todos.length === 0 && (
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
