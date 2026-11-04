const SEOUL = "Asia/Seoul";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function todayInSeoul(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getUtcDay(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function startOfWeekMonday(isoDate: string): string {
  const day = getUtcDay(isoDate);
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(isoDate, offset);
}

export function startOfMonth(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

export function addMonths(isoDate: string, months: number): string {
  const [year, month] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1 + months, 1));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export function nextWeekSunday(fromIso: string): string {
  const day = getUtcDay(fromIso);
  const daysUntilThisSunday = (7 - day) % 7;
  return addDays(fromIso, daysUntilThisSunday + 7);
}

export function getSelectableRange(fromIso = todayInSeoul()) {
  return {
    min: fromIso,
    max: nextWeekSunday(fromIso),
  };
}

export function isSelectableDate(
  isoDate: string,
  range = getSelectableRange(),
): boolean {
  return isoDate >= range.min && isoDate <= range.max;
}

export function weekdayLabel(isoDate: string) {
  return WEEKDAY_LABELS[getUtcDay(isoDate)];
}

export function formatKoreanDate(isoDate: string) {
  const [, month, day] = isoDate.split("-");
  return `${Number(month)}월 ${Number(day)}일 (${weekdayLabel(isoDate)})`;
}

export function formatMonthTitle(isoDate: string) {
  const [year, month] = isoDate.split("-");
  return `${year}년 ${Number(month)}월`;
}

export function daysInWeek(weekStartMonday: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartMonday, i));
}

export function daysInMonthGrid(monthStart: string) {
  const gridStart = startOfWeekMonday(monthStart);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function isSameMonth(a: string, b: string) {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** min ~ max(양끝 포함) 날짜 목록 */
export function listDates(min: string, max: string): string[] {
  const dates: string[] = [];
  for (let cur = min; cur <= max; cur = addDays(cur, 1)) dates.push(cur);
  return dates;
}

/** 날짜(YYYY-MM-DD) + 시간(HH:mm) → 서울 시간대(+09:00) ISO 문자열 */
export function toSeoulIso(date: string, time: string): string {
  return `${date}T${time}:00+09:00`;
}

/** timestamptz ISO → 서울 기준 { date: YYYY-MM-DD, time: HH:mm } */
export function splitSeoulDateTime(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/** timestamptz ISO → "오전/오후 H:mm" (서울 기준) */
export function formatSeoulTime(iso: string): string {
  const { time } = splitSeoulDateTime(iso);
  const [h, m] = time.split(":").map(Number);
  const period = h < 12 ? "오전" : "오후";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${displayHour}:${String(m).padStart(2, "0")}`;
}

/** 30분 단위 시간 옵션 */
export const TIME_OPTIONS: { value: string; label: string }[] = Array.from(
  { length: 48 },
  (_, i) => {
    const h = Math.floor(i / 2);
    const m = i % 2 === 0 ? 0 : 30;
    const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return { value, label: formatSeoulTime(`2000-01-01T${value}:00+09:00`) };
  },
);

export { WEEKDAY_LABELS };
