// 한국어 조사(이/가, 은/는, 으로/로)를 앞 글자 받침에 맞춰 붙입니다.

// 숫자로 끝나면 읽는 소리 기준 받침: 0 영, 1 일, 3 삼, 6 육, 7 칠, 8 팔 → 받침 있음 / 2 이, 4 사, 5 오, 9 구 → 없음
const DIGIT_JONG: Record<string, number> = { "0": 21, "1": 8, "2": 0, "3": 16, "4": 0, "5": 0, "6": 1, "7": 8, "8": 8, "9": 0 };

/** 마지막 글자의 받침 번호 (0이면 받침 없음, 8이면 ㄹ) */
function jong(word: string) {
  const ch = word.trim().slice(-1);
  if (ch in DIGIT_JONG) return DIGIT_JONG[ch];
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return 0;
  return code % 28;
}

export const iGa = (w: string) => `${w}${jong(w) ? "이" : "가"}`;
export const eunNeun = (w: string) => `${w}${jong(w) ? "은" : "는"}`;
export const euroRo = (w: string) => {
  const j = jong(w);
  return `${w}${j && j !== 8 ? "으로" : "로"}`;
};
