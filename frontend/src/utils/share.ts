import type { Change, Fact, Todo } from "../types";
import { canceledChanges, changedFrom } from "./format";

/** 가족에게 보낼 요약 문자 */
export function buildShareText(title: string, facts: Fact[], recent: Map<string, Change>, todos: Todo[] = []) {
  const lines = [`[체인지워치] ${title}`, "", "지금 유효한 정보"];
  if (facts.length === 0) lines.push("· 아직 정리된 안내가 없어요");
  for (const f of facts) {
    const old = changedFrom(f, recent);
    lines.push(`· ${f.label}: ${f.value}${old ? ` (${old}에서 바뀜)` : ""}`);
  }
  for (const c of canceledChanges(recent, facts)) lines.push(`· ${c.label}: 취소됨`);
  const left = todos.filter((t) => !t.done);
  if (left.length) lines.push("", "남은 할 일", ...left.map((t) => `- ${t.text}`));
  return lines.join("\n");
}

/**
 * Web Share API로 공유합니다. 지원하지 않는 브라우저는 클립보드에 복사합니다.
 * 반환값: "shared" | "copied" | "canceled"
 */
export async function shareText(title: string, text: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "canceled";
    }
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}
