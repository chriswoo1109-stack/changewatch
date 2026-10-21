// 안내문 필터: 소음·잡담 대신 "안내처럼 보이는 문장"만 분석에 보냅니다.
// - 숫자(번호·시간)가 있거나 취소 안내면 안내(notice)
// - 준비물·복용 방법처럼 값이 글인 항목은 숫자가 없어도 안내(notice): "신분증 챙겨 오세요"
// - "처방전은 약국에 제출하세요"처럼 할 일 안내도 안내(notice) → 서버가 할 일(todos)로 뽑습니다
//   단, "보건 진료실도 이동하세요"처럼 값이 숫자인 항목(진료실 등)인데 숫자가 없는 문장은
//   분석해도 엉뚱한 값이 저장될 뿐이라 뺍니다.
// - 내 번호("37번 환자분", "삼십칠 번")나 이름이 불리면 내 안내(mine) → 알림 대상 (hasMyKeyword)
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
// - 값이 숫자인 항목: 진료실·대기 순번·검사 시간·진료 시간·다음 예약
const NUMBER_ITEM_WORDS = ["진료실", "순번", "대기번호", "대기 번호", "검사", "진료 시간", "진료시간", "예약"];
// - 값이 글인 항목: 준비물(supplies)·복용 방법(medication)
const TEXT_ITEM_WORDS = ["준비물", "챙겨", "가져오세요", "지참", "복용", "드세요", "약은"];
const TRACK_WORDS = [...NUMBER_ITEM_WORDS, ...TEXT_ITEM_WORDS];

// 음성 인식이 자주 틀리는 안내 단어 보정. 실제 시연 중 나온 오인식을 모아 둔 목록입니다.
// ("진료실"은 발음이 [질료실]이라 "증류시리", "직묘실", "진료신도" 등으로 자주 들립니다)
const MISHEARD = "(?:진료|증료|증류|직묘|진뇨|질료|질려|진려|진류|질류|진주)\\s?"; // 띄어쓰기 허용
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
// 내 번호 판단은 backend/app/services/my_turn.py와 같은 규칙입니다. 한쪽을 바꾸면 다른 쪽도 맞춥니다.
// - "번"이 붙은 번호만 부른 것으로 봅니다 → "오후 2시 37분", "체온 37.5도"는 알림 없음
// - 번호 바로 뒤에 장소·값이 오면 부른 게 아닙니다 → "37번 진료실로 가세요", "진료실이 37번으로"
// - 음성 인식이 "삼십칠 번"처럼 한글로 적어도 알아봅니다
const NOT_A_CALL = String.raw`(?!\s*(?:진료실|진찰실|검사실|창구|호실|층)|으로|로(?![가-힣]))`;

const SINO_DIGITS: Record<string, number> = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };

// 한자어 숫자를 정수로 바꿉니다 ("삼십칠" → 37). "삼칠"처럼 자릿수 없이 이어지면 숫자가 아님(null).
function sinoToInt(word: string): number | null {
  let total = 0;
  let current = 0;
  for (const ch of word) {
    if (ch in SINO_DIGITS) {
      if (current) return null;
      current = SINO_DIGITS[ch];
    } else if (ch === "십") {
      total += (current || 1) * 10;
      current = 0;
    } else if (ch === "백") {
      total += (current || 1) * 100;
      current = 0;
    }
  }
  return total + current;
}

// "삼십칠 번" → "37번". 한 글자를 붙여 쓴 "이번", "일번"은 일반 단어일 가능성이 커서 그대로 둡니다.
function koreanCallNumbers(sentence: string) {
  return sentence.replace(/(?<![가-힣])([일이삼사오육칠팔구십백]+)(\s*)번/g, (whole, word: string, space: string) => {
    if (word.length === 1 && !space) return whole;
    const n = sinoToInt(word);
    return n === null ? whole : `${n}번`;
  });
}

export function hasMyKeyword(sentence: string, my: MyKeywords) {
  const num = my.waitNumber.replace(/\D/g, "").replace(/^0+/, "");
  const name = my.name.trim();
  if (num && new RegExp(String.raw`(?<!\d)0*${num}\s*번${NOT_A_CALL}`).test(koreanCallNumbers(sentence))) return true;
  if (name && sentence.replace(/\s/g, "").includes(name.replace(/\s/g, ""))) return true;
  return false;
}

export function classifySentence(sentence: string, my: MyKeywords): SentenceKind {
  if (hasMyKeyword(sentence, my)) return "mine";
  if (/\d/.test(sentence) || NO_VALUE_WORDS.some((w) => sentence.includes(w))) return "notice";
  if (TEXT_ITEM_WORDS.some((w) => sentence.includes(w))) return "notice";
  if (TODO_ENDING.test(sentence.trim()) && !NUMBER_ITEM_WORDS.some((w) => sentence.includes(w))) return "notice";
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
