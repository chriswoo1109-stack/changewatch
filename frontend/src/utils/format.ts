import type { Change, Fact } from "../types";
import { iGa } from "./josa";

/** "2026-10-18T14:05:00" → "오후 2:05" */
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
}

export interface Todo {
  id: string; // "항목:값" — 값이 바뀌면 새 할 일로 취급
  text: string;
}

// 항목별 할 일 문구. 도메인 템플릿(backend/app/domains/hospital.json)의 key와 맞춥니다.
const TODO_TEXT: Record<string, (v: string) => string> = {
  room: (v) => `${v} 진료실 앞에서 기다리기`,
  wait_number: (v) => `내 대기 순번(${v}) 호출 듣기`,
  exam_time: (v) => `${v}까지 검사실로 이동하기`,
  visit_time: (v) => `진료 시간(${v})에 맞춰 도착하기`,
  medication: (v) => `약 복용 방법 지키기: ${v}`,
  next_visit: (v) => `다음 예약(${v}) 일정에 저장하기`,
};

/** 현재 유효한 정보로 할 일 목록을 만듭니다. */
export function factsToTodos(facts: Fact[]): Todo[] {
  return facts.map((f) => ({
    id: `${f.key}:${f.value}`,
    text: TODO_TEXT[f.key]?.(f.value) ?? `${f.label}: ${f.value} 확인하기`,
  }));
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
