import type { Change, Fact } from "../types";
import { iGa } from "./josa";

/** "2026-10-18T14:05:00" → "오후 2:05" */
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
}

/** 항목별로 가장 최근에 반영된 변경을 찾습니다. 이력은 최신순입니다. */
export function latestAppliedChanges(history: Change[]) {
  const map = new Map<string, Change>();
  for (const c of history) {
    if (c.status === "applied" && !map.has(c.key)) map.set(c.key, c);
  }
  return map;
}

/** 이 정보가 최근 변경으로 바뀐 값인지 (이전 값 강조용) */
export function changedFrom(f: Fact, recent?: Map<string, Change>) {
  const c = recent?.get(f.key);
  return c && c.old_value && c.change_type !== "cancel" && c.new_value === f.value ? c.old_value : null;
}

/** 취소되어 지금은 없는 항목 */
export function canceledChanges(recent: Map<string, Change>, facts: Fact[]) {
  return [...recent.values()].filter((c) => c.change_type === "cancel" && !facts.some((f) => f.key === c.key));
}

/** 값 길이에 맞춘 글씨 크기. 준비물처럼 값이 긴 글이면 작게 해서 카드 밖으로 넘치지 않게 합니다. */
export function valueSize(value: string | null | undefined, big: string, small: string) {
  return (value ?? "").length > 8 ? small : big;
}

/** 직원에게 보여줄 확인 질문: "진료실이 5번 맞나요?" */
export function staffQuestion(label: string, value: string) {
  return `${iGa(label)} ${value} 맞나요?`;
}

/** 직원 화면(/show) 주소. changeId가 있으면 그 화면에서 바로 승인·거절할 수 있습니다. */
export function showUrl(question: string, sub?: string, changeId?: number) {
  const q = new URLSearchParams({ q: question });
  if (sub) q.set("sub", sub);
  if (changeId) q.set("change", String(changeId));
  return `/show?${q}`;
}
