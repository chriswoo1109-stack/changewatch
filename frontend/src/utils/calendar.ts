// 캘린더 추가: 아이폰은 .ics 파일, 안드로이드는 구글 캘린더 링크

// 날짜·시간이 들어갈 수 있는 항목 (backend/app/domains/hospital.json의 key)
export const CALENDAR_KEYS = ["exam_time", "visit_time", "next_visit"];

export interface ParsedTime {
  start: Date;
  allDay: boolean;
}

/**
 * "오후 2시", "11월 3일 오전 10시 30분", "내일", "2주 뒤" 같은 값을 날짜로 바꿉니다.
 * 날짜가 없으면 오늘, 시간이 없으면 종일 일정으로 봅니다. 날짜도 시간도 없으면 null.
 */
export function parseKoreanDateTime(value: string, now = new Date()): ParsedTime | null {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let hasDate = false;

  const md = value.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  const rel = value.match(/(\d+)\s*(일|주|개월)\s*(뒤|후)/);
  if (md) {
    date.setMonth(Number(md[1]) - 1, Number(md[2]));
    if (date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) date.setFullYear(date.getFullYear() + 1);
    hasDate = true;
  } else if (rel) {
    const n = Number(rel[1]);
    if (rel[2] === "일") date.setDate(date.getDate() + n);
    if (rel[2] === "주") date.setDate(date.getDate() + n * 7);
    if (rel[2] === "개월") date.setMonth(date.getMonth() + n);
    hasDate = true;
  } else if (value.includes("모레")) {
    date.setDate(date.getDate() + 2);
    hasDate = true;
  } else if (value.includes("내일")) {
    date.setDate(date.getDate() + 1);
    hasDate = true;
  } else {
    const d = value.match(/(?<!\d)(\d{1,2})\s*일(?!\s*(뒤|후))/);
    if (d) {
      date.setDate(Number(d[1]));
      if (date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) date.setMonth(date.getMonth() + 1);
      hasDate = true;
    }
  }

  const t = value.match(/(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분|\s*(반))?/);
  if (!t) return hasDate ? { start: date, allDay: true } : null;

  let hour = Number(t[2]);
  if (t[1] === "오후" && hour < 12) hour += 12;
  // 오전/오후 없이 1~6시라고 하면 병원 진료 시간상 오후로 봅니다.
  if (!t[1] && hour >= 1 && hour <= 6) hour += 12;
  const minute = t[4] ? 30 : Number(t[3] ?? 0);
  date.setHours(hour, minute, 0, 0);
  return { start: date, allDay: false };
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const ymdhms = (d: Date) => `${ymd(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

function endOf(p: ParsedTime) {
  const end = new Date(p.start);
  if (p.allDay) end.setDate(end.getDate() + 1);
  else end.setMinutes(end.getMinutes() + 30);
  return end;
}

const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

/** .ics 파일을 내려받게 합니다. 아이폰 Safari에서 열면 "캘린더에 추가"가 뜹니다. */
export function downloadIcs(title: string, p: ParsedTime, description = "") {
  const end = endOf(p);
  const dt = p.allDay
    ? [`DTSTART;VALUE=DATE:${ymd(p.start)}`, `DTEND;VALUE=DATE:${ymd(end)}`]
    : [`DTSTART:${ymdhms(p.start)}`, `DTEND:${ymdhms(end)}`];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ChangeWatch//KO",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@changewatch`,
    `DTSTAMP:${stamp}`,
    ...dt,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "changewatch.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 구글 캘린더 일정 추가 링크 */
export function googleCalendarUrl(title: string, p: ParsedTime, description = "") {
  const end = endOf(p);
  const dates = p.allDay ? `${ymd(p.start)}/${ymd(end)}` : `${ymdhms(p.start)}/${ymdhms(end)}`;
  const q = new URLSearchParams({ action: "TEMPLATE", text: title, dates, details: description, ctz: "Asia/Seoul" });
  return `https://calendar.google.com/calendar/render?${q}`;
}

export function detectPlatform(): "ios" | "android" | "other" {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

export function formatParsed(p: ParsedTime) {
  const opts: Intl.DateTimeFormatOptions = p.allDay
    ? { month: "long", day: "numeric", weekday: "short" }
    : { month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" };
  return p.start.toLocaleString("ko-KR", opts);
}
