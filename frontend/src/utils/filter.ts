// 안내문 필터: 소음·잡담 대신 "안내처럼 보이는 문장"만 분석에 보냅니다.
// - 숫자(번호·시간)가 있거나 취소 안내면 안내(notice)
// - "처방전은 약국에 제출하세요"처럼 할 일 안내도 안내(notice) → 서버가 할 일(todos)로 뽑습니다
//   단, "보건 진료실도 이동하세요"처럼 추적 항목(진료실 등)인데 값(숫자)이 없는 문장은
//   분석해도 엉뚱한 값이 저장될 뿐이라 뺍니다.
// - 내 정보 키워드(대기번호·이름)가 있으면 내 안내(mine) → 알림 대상
// - 나머지는 소음(noise) → 분석하지 않음

export type SentenceKind = "mine" | "notice" | "noise";

export interface MyKeywords {
  waitNumber: string;
  name: string;
}

// 값(숫자)이 없어도 의미가 있는 안내: "오늘 검사는 취소되었습니다"
const NO_VALUE_WORDS = ["취소"];

// 할 일 안내 끝맺음. backend/app/services/llm_extractor.py의 TODO_RE와 맞춥니다.
const TODO_ENDING = /(하세요|해 주세요|해주세요|하십시오)[.!?]?$/;

// 추적 항목 키워드 (backend/app/domains/hospital.json의 keywords와 맞춥니다)
const TRACK_WORDS = ["진료실", "순번", "대기번호", "대기 번호", "검사", "진료 시간", "예약", "복용", "약은", "준비물", "지참"];

// 음성 인식이 자주 틀리는 안내 단어 보정. 실제 시연 중 나온 오인식을 모아 둔 목록입니다.
// ("진료실"은 발음이 [질료실]이라 "증류시리", "직묘실", "진료신도" 등으로 자주 들립니다)
const MISHEARD = "(?:진료|증류|직묘|진뇨|질료|질려|진려|진류|질류|진주)\\s?"; // 띄어쓰기 허용
const misheard = (tail: string) => new RegExp(MISHEARD + tail, "g");
const FIXES: [RegExp, string][] = [
  [misheard("시리"), "진료실이"],
  [misheard("시른"), "진료실은"],
  [misheard("시로"), "진료실로"],
  [misheard("신도"), "진료실로"],
  [misheard("실"), "진료실"], // "진료 신청"을 건드리지 않도록 "신"은 "신도"만 보정
  [/(\d+번)\s?질러\s?([오가])세요/g, "$1 진료실로 $2세요"], // "2번 질러 오세요"
];

// 번호를 한글 소리로 받아쓴 경우: "일본 진료실" → "1번 진료실", "선분 진료실" → "3번 진료실"
// "이번 주"처럼 정상 문장을 바꾸지 않도록, 뒤에 진료실·환자·창구 같은 말이 올 때만 바꿉니다.
const NUM_WORD: Record<string, string> = {
  일: "1", 이: "2", 삼: "3", 선: "3", 섬: "3", 사: "4", 오: "5", 육: "6", 륙: "6", 칠: "7", 팔: "8", 구: "9", 십: "10",
};
const NUM_WORD_RE =
  /(^|\s)(일|이|삼|선|섬|사|오|육|륙|칠|팔|구|십)\s?(?:번|본|변|(?<=[선삼]\s?)분)(?=\s?(?:진료실|진찰실|환자|창구|호실|으로))/g;

/** 오인식된 안내 단어를 바로잡습니다. 새로 발견한 오인식은 FIXES에 추가하세요. */
export function fixMishearing(text: string) {
  const fixed = FIXES.reduce((t, [re, to]) => t.replace(re, to), text);
  return fixed.replace(NUM_WORD_RE, (_, pre: string, num: string) => `${pre}${NUM_WORD[num]}번`);
}

/**
 * 음성 인식 후보 중 안내로 가장 그럴듯한 것을 고릅니다.
 * 내 키워드 → 추적 항목 단어 → 안내 표현 순으로 우선하고, 없으면 첫 번째(가장 유력한) 후보.
 */
export function pickAlternative(alternatives: string[], my: MyKeywords) {
  alternatives = alternatives.map(fixMishearing);
  return (
    alternatives.find((a) => hasMyKeyword(a, my)) ??
    alternatives.find((a) => TRACK_WORDS.some((w) => a.includes(w))) ??
    alternatives.find((a) => classifySentence(a, my) !== "noise") ??
    alternatives[0]
  );
}

/** 문장 단위로 나눕니다. (마침표·물음표·줄바꿈 기준) */
export function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 내 키워드가 들어 있는지 확인합니다. 대기번호 15는 "150"과 구분합니다. */
export function hasMyKeyword(sentence: string, my: MyKeywords) {
  const num = my.waitNumber.replace(/\D/g, "");
  const name = my.name.trim();
  if (num && new RegExp(`(?<!\\d)${num}(?!\\d)`).test(sentence)) return true;
  if (name && sentence.replace(/\s/g, "").includes(name.replace(/\s/g, ""))) return true;
  return false;
}

export function classifySentence(sentence: string, my: MyKeywords): SentenceKind {
  if (hasMyKeyword(sentence, my)) return "mine";
  if (/\d/.test(sentence) || NO_VALUE_WORDS.some((w) => sentence.includes(w))) return "notice";
  if (TODO_ENDING.test(sentence.trim()) && !TRACK_WORDS.some((w) => sentence.includes(w))) return "notice";
  return "noise";
}

/** 문장이 끝났는지 ("~다", "~요"로 끝나면 끝). 음성 인식이 말을 중간에 끊어 넘겨줄 때 이어 붙이는 데 씁니다. */
export function isCompleteSentence(sentence: string) {
  return /(다|요|죠|까)[.!?]?$/.test(sentence.trim());
}

/** 텍스트에서 안내 문장만 남깁니다. 결과가 비면 분석할 안내가 없는 것입니다. */
export function filterAnnouncement(text: string, my: MyKeywords) {
  const sentences = splitSentences(text).map((s) => ({ text: s, kind: classifySentence(s, my) }));
  const kept = sentences.filter((s) => s.kind !== "noise");
  return { sentences, kept: kept.map((s) => s.text).join("\n"), hasMine: kept.some((s) => s.kind === "mine") };
}
