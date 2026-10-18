import { useEffect, useState } from "react";
import { updateTodo } from "../../api/sessions";
import type { Todo } from "../../types";

/** 서버가 안내에서 뽑아 확인한 할 일 목록. 체크하면 서버에 저장합니다. (PATCH /todos/{id}) */
export default function TodoList({ todos }: { todos: Todo[] }) {
  const [items, setItems] = useState(todos);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setItems(todos), [todos]);

  if (items.length === 0) {
    return <p className="text-sm text-slate-400">"처방전은 약국에 제출하세요" 같은 안내를 들으면 할 일이 여기에 생겨요.</p>;
  }

  const toggle = async (todo: Todo) => {
    setError(null);
    // 바로 체크 표시하고, 저장에 실패하면 되돌립니다.
    setItems((list) => list.map((t) => (t.id === todo.id ? { ...t, done: !todo.done } : t)));
    try {
      const saved = await updateTodo(todo.id, !todo.done);
      setItems((list) => list.map((t) => (t.id === saved.id ? saved : t)));
    } catch (e) {
      setItems((list) => list.map((t) => (t.id === todo.id ? todo : t)));
      setError(e instanceof Error ? e.message : "저장하지 못했습니다.");
    }
  };

  const done = items.filter((t) => t.done).length;
  return (
    <div>
      <p className="mb-2 text-xs text-slate-400">
        {done} / {items.length} 완료
      </p>
      <ul className="space-y-2">
        {items.map((t) => (
          <li key={t.id}>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600" checked={t.done} onChange={() => toggle(t)} />
              <span className={t.done ? "text-slate-400 line-through" : ""}>
                {t.text}
                <span className="mt-0.5 block text-xs text-slate-400">“{t.evidence}”</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
