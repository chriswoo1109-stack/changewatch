import type { Change, Fact, Todo } from "../types";
import { eunNeun, euroRo, iGa } from "./josa";

export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

/** 한국어로 소리 내어 읽습니다. (speechSynthesis, 별도 키 불필요) */
export function speak(text: string) {
  if (!canSpeak || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ko-KR";
  u.rate = 0.95;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("ko"));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak) window.speechSynthesis.cancel();
}

/** 변경 1건을 읽기 좋은 문장으로 바꿉니다. */
export function describeChange(c: Change) {
  if (c.status === "pending") return `${iGa(c.label)} ${c.new_value}일 수 있어요. 확인이 필요합니다.`;
  if (c.change_type === "cancel") return `${eunNeun(c.old_value ? `${c.label} ${c.old_value}` : c.label)} 취소되었습니다.`;
  if (c.old_value) return `${iGa(c.label)} ${c.old_value}에서 ${euroRo(c.new_value ?? "")} 바뀌었습니다.`;
  return `${eunNeun(c.label)} ${c.new_value}입니다.`;
}

/** 현재 유효한 정보를 한 번에 읽는 문장 */
export function describeFacts(facts: Fact[]) {
  if (facts.length === 0) return "아직 정리된 안내가 없습니다.";
  return facts.map((f) => `${eunNeun(f.label)} ${f.value}입니다.`).join(" ");
}

/** 새로 생긴 할 일을 읽는 문장 */
export function describeTodos(todos: Todo[]) {
  return todos.length ? `할 일이 ${todos.length}건 생겼습니다. ${todos.map((t) => t.text).join(". ")}.` : "";
}
