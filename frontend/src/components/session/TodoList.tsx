import { useSessionStore } from "../../stores/sessionStore";
import type { Fact } from "../../types";
import { factsToTodos } from "../../utils/format";

/** 현재 유효한 정보로 만든 할 일 체크리스트. 정보가 바뀌면 해당 할 일은 다시 미완료가 됩니다. */
export default function TodoList({ facts }: { facts: Fact[] }) {
  const { checked, toggleChecked } = useSessionStore();
  const todos = factsToTodos(facts);
  if (todos.length === 0) return <p className="text-sm text-slate-400">안내가 정리되면 할 일이 여기에 생겨요.</p>;

  const done = todos.filter((t) => checked[t.id]).length;
  return (
    <div>
      <p className="mb-2 text-xs text-slate-400">
        {done} / {todos.length} 완료
      </p>
      <ul className="space-y-2">
        {todos.map((t) => (
          <li key={t.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 p-3">
              <input
                type="checkbox"
                className="h-5 w-5 accent-blue-600"
                checked={!!checked[t.id]}
                onChange={() => toggleChecked(t.id)}
              />
              <span className={checked[t.id] ? "text-slate-400 line-through" : ""}>{t.text}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
