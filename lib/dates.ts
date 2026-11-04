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

export { WEEKDAY_LABELS };
