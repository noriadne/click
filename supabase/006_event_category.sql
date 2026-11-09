-- =====================================================================
-- 006: 모임 카테고리 추가
--
-- events.category 를 필수 컬럼으로 추가한다.
-- 허용 값(고정): 자유 / 전략(초급) / 전략(상급) / 파티 / 캠페인 / 기타
--   → lib/categories.ts 의 EVENT_CATEGORIES 와 같은 값이어야 한다.
--
-- 참고: events.game_id 는 000 에서 이미 NULL 허용이므로 변경 없음.
--       (보드게임 선택은 앱에서 선택 항목으로만 바뀐다.)
--
-- 기존 모임은 '자유'로 채운다. (재실행해도 안전: 이미 값이 있으면 건드리지 않음)
-- 카테고리 목록을 바꿀 때는 이 파일을 고치지 말고, 새 번호 파일에서
-- events_category_check 를 drop 후 다시 만든다.
--
-- 선행 파일: 000 ~ 005
-- 실행 위치: Supabase 대시보드 > SQL Editor
-- =====================================================================

begin;

alter table public.events
  add column if not exists category text;

-- 기존 모임 보정 (새 프로젝트처럼 events 가 비어 있으면 아무 일도 하지 않는다)
update public.events
   set category = '자유'
 where category is null;

alter table public.events
  alter column category set not null;

alter table public.events
  drop constraint if exists events_category_check;

alter table public.events
  add constraint events_category_check
  check (category in ('자유', '전략(초급)', '전략(상급)', '파티', '캠페인', '기타'));

commit;
