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

// 안내 앞뒤에 붙는 인사말. "안녕하세요"처럼 "~하세요"로 끝나도 할 일이 아니므로 떼고 판단합니다.
const GREETINGS = [
  "안녕하세요", "안녕하십니까", "안녕히 가세요", "안녕히 계세요", "어서 오세요",
  "수고하세요", "수고하십시오", "수고 많으세요", "고생하세요", "고생 많으세요",
  "감사합니다", "고맙습니다", "반갑습니다", "좋은 하루 되세요", "좋은 하루 보내세요",
].map((g) => g.replace(/ /g, "\\s?")); // "안녕히가세요"처럼 붙여 써도 인식
const GREETING = `(?:${GREETINGS.join("|")})`;
const CALLER = "(?:(?:여러분|환자분들?|보호자분들?|고객님)\\s*,?\\s*)?"; // "환자분들, 안녕하세요"
const LEADING_GREETING = new RegExp(`^(?:${CALLER}${GREETING}[.!?~,\\s]*)+`);
const TRAILING_GREETING = new RegExp(`(?:[.!?~,\\s]*${GREETING})+[.!?~\\s]*$`);

/** 문장 앞뒤 인사말을 뗍니다. "안녕하세요 처방전은 약국에 제출하세요" → "처방전은 약국에 제출하세요", "안녕하세요" → "" */
export function stripGreeting(sentence: string) {
  return sentence.trim().replace(LEADING_GREETING, "").replace(TRAILING_GREETING, "").trim();
}

// 음성 인식이 자주 틀리는 안내 단어 보정. 실제 시연 중 나온 오인식을 모아 둔 목록입니다.
// ("진료실"은 발음이 [질료실]이라 "증류시리", "직묘실", "진료신도" 등으로 자주 들립니다)
const MISHEARD = "(?:진료|증료|증류|직묘|진뇨|질료|질려|진려|진류|질류|진주)\\s?"; // 띄어쓰기 허용
const misheard = (tail: string) => new RegExp(MISHEARD + tail, "g");
// "약국에 ○○" 보정에 쓰는 동사. "내"만 쓰면 "내일"에도 걸리므로 끝맺음까지 정함
const SUBMIT = "제출|가져|내(?:세요|주세요|시면|십시오)";
const FIXES: [RegExp, string][] = [
  [misheard("시리"), "진료실이"],
  [misheard("시른"), "진료실은"],
  [misheard("시로"), "진료실로"],
  [misheard("신도"), "진료실로"],
  [misheard("실"), "진료실"], // "진료 신청"을 건드리지 않도록 "신"은 "신도"만 보정
  [/(\d+번)\s?질러\s?([오가])세요/g, "$1 진료실로 $2세요"], // "2번 질러 오세요"
  [/(?:투구|수구)\s?하세요/g, "수고하세요"], // "수고하세요"가 "투구하세요"로 들림 → 인사말로 바로잡아 할 일에서 뺌
  // "처방전은"이 "저강조는", "저방전은"으로 들림 (조사도 "처방전"에 맞게 은/을로)
  [/(?:저방전|저강조|처방존|처망전|처방\s전)(?:은|는)/g, "처방전은"],
  [/(?:저방전|저강조|처방존|처망전|처방\s전)(?:을|를)/g, "처방전을"],
  [/(?:저방전|저강조|처방존|처망전|처방\s전)/g, "처방전"],
  // "약국에 제출"이 "약국의/약국이/약속의 제출"로 들림
  // - "내"는 "내일"에 걸리지 않게 "내세요·내주세요·내시면·내십시오"만
  // - "약속이"는 실제로 자주 쓰는 말이라 "약속"은 "의·애·에"일 때만 바꿈
  [new RegExp(`약(?:국\\s?(?:의|이|애|에)|속\\s?(?:의|애|에))\\s?(${SUBMIT})`, "g"), "약국에 $1"],
  // "처방전은"이 "저는"으로 줄어 들림. "저는"은 흔한 말이라 바로 뒤가 "약국에 제출/내세요"일 때만 바꿈
  [new RegExp(`(^|\\s)저는\\s?(?=약국에 (?:${SUBMIT}))`, "g"), "$1처방전은 "],
  // "취소되었습니다"가 "취서되었습니다"로 들림. 고치지 않으면 숫자 없는 취소 안내는 소음으로 빠지고,
  // AI(gpt-4o-mini)도 "오후 2시 검사가 취서됐습니다"를 취소로 알아듣지 못함 (실측 3/3 놓침)
  [/취서(?=\s?(?:되|됐|돼|됨|합니다|하겠습니다))/g, "취소"],
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
  // 인사말을 뗀 나머지로 판단 ("안녕하세요"만 있으면 남는 게 없어 소음)
  const core = stripGreeting(sentence);
  if (!core) return "noise";
  if (/\d/.test(core) || NO_VALUE_WORDS.some((w) => core.includes(w))) return "notice";
  if (TEXT_ITEM_WORDS.some((w) => core.includes(w))) return "notice";
  if (TODO_ENDING.test(core) && !NUMBER_ITEM_WORDS.some((w) => core.includes(w))) return "notice";
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
  // 분석에는 인사말을 뗀 문장을 보냅니다 (할 일이 "안녕하세요 처방전은…"으로 저장되지 않게)
  const keptText = kept.map((s) => stripGreeting(s.text) || s.text).join("\n");
  return { sentences, kept: keptText, hasMine: kept.some((s) => s.kind === "mine") };
}
