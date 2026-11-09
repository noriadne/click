/**
 * 모임 카테고리 (고정 목록).
 *
 * DB 의 events.category CHECK 제약(supabase/006_event_category.sql)과 값이 같아야 한다.
 * 목록을 바꿀 때는 이 배열과 새 마이그레이션(제약 재정의)을 함께 수정한다.
 */
export const EVENT_CATEGORIES = [
  "자유",
  "전략(초급)",
  "전략(상급)",
  "파티",
  "캠페인",
  "기타",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/**
 * 모임 카드에서 제목 앞에 붙는 카테고리 배지 색.
 * Tailwind 가 클래스를 찾을 수 있도록 클래스 문자열을 조합하지 않고 통째로 적는다.
 * 노란색(amber)은 룰마 왕관 표시에, 남색(indigo)은 버튼에 쓰이므로 피한다.
 */
export const CATEGORY_BADGE_CLASS: Record<EventCategory, string> = {
  자유: "bg-zinc-700/60 text-zinc-200",
  "전략(초급)": "bg-emerald-500/15 text-emerald-300",
  "전략(상급)": "bg-orange-500/15 text-orange-300",
  파티: "bg-fuchsia-500/15 text-fuchsia-300",
  캠페인: "bg-violet-500/15 text-violet-300",
  기타: "bg-sky-500/15 text-sky-300",
};

export function isEventCategory(value: unknown): value is EventCategory {
  return (
    typeof value === "string" &&
    (EVENT_CATEGORIES as readonly string[]).includes(value)
  );
}
