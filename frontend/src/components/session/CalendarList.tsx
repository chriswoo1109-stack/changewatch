import type { Fact } from "../../types";
import Card from "../common/Card";
import Icon from "../common/Icon";
import {
  CALENDAR_KEYS,
  detectPlatform,
  downloadIcs,
  formatParsed,
  googleCalendarUrl,
  parseKoreanDateTime,
} from "../../utils/calendar";

/** 날짜·시간이 있는 정보를 캘린더에 추가합니다. 아이폰은 .ics, 안드로이드는 구글 캘린더, PC는 둘 다 보여줍니다. */
export default function CalendarList({ facts, title }: { facts: Fact[]; title: string }) {
  const platform = detectPlatform();
  const items = facts
    .filter((f) => CALENDAR_KEYS.includes(f.key))
    .map((f) => ({ fact: f, parsed: parseKoreanDateTime(f.value) }))
    .filter((i) => i.parsed !== null);

  if (items.length === 0) return null;

  return (
    <Card>
      <p className="mb-2 text-sm font-semibold">일정에 추가</p>
      <ul className="space-y-2">
      {items.map(({ fact, parsed }) => {
        const name = `${title} · ${fact.label}`;
        const desc = `${fact.label}: ${fact.value} (체인지워치에서 추가)`;
        return (
          <li key={fact.key} className="space-y-2 rounded-xl bg-slate-50 p-3">
            <p className="text-sm">
              <span className="font-semibold">{fact.label}</span>
              <span className="ml-2 text-slate-500">{formatParsed(parsed!)}</span>
            </p>
            <span className="flex gap-1.5">
              {platform !== "android" && (
                <button
                  className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white"
                  onClick={() => downloadIcs(name, parsed!, desc)}
                >
                  <Icon name="calendar" className="h-4 w-4" />
                  {platform === "ios" ? "캘린더에 추가" : ".ics 받기"}
                </button>
              )}
              {platform !== "ios" && (
                <a
                  className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white"
                  href={googleCalendarUrl(name, parsed!, desc)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="calendar" className="h-4 w-4" />
                  {platform === "android" ? "캘린더에 추가" : "구글 캘린더"}
                </a>
              )}
            </span>
          </li>
        );
      })}
      </ul>
    </Card>
  );
}
