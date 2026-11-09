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

export function isEventCategory(value: unknown): value is EventCategory {
  return (
    typeof value === "string" &&
    (EVENT_CATEGORIES as readonly string[]).includes(value)
  );
}
