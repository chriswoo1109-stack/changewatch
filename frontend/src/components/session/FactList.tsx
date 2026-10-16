import type { Fact } from "../../types";

export default function FactList({ facts }: { facts: Fact[] }) {
  if (facts.length === 0) return <p className="text-sm text-slate-400">아직 정리된 안내가 없습니다.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {facts.map((f) => (
        <li key={f.key} className="flex justify-between py-3">
          <span className="text-slate-500">{f.label}</span>
          <span className="font-semibold">{f.value}</span>
        </li>
      ))}
    </ul>
  );
}
