-- =====================================================================
-- 003: 동시 요청에도 깨지지 않는 데이터 무결성
--
--   1) 중복 참석 방지      : event_participants (event_id, user_id) 유니크
--   2) 정원 초과 방지      : 참석 추가 직전에 모임 행을 잠그고 인원 수 확인
--   3) 정원 축소 제한      : 현재 참석자 수보다 작게 정원을 수정할 수 없음
--
-- 실행 위치: Supabase 대시보드 > SQL Editor
--
-- [실행 전 점검] 아래 두 쿼리를 먼저 각각 실행해서 결과가 "0 rows" 인지 확인하세요.
-- 결과가 있다면(기존 데이터에 중복/초과가 있다면) 그 행을 정리한 뒤 실행해야 합니다.
--
--   -- (a) 중복 참석
--   select event_id, user_id, count(*)
--     from event_participants
--    group by event_id, user_id
--   having count(*) > 1;
--
--   -- (b) 정원 초과 모임
--   select e.id, e.title, e.max_participants, count(p.id) as joined
--     from events e
--     join event_participants p on p.event_id = e.id
--    group by e.id
--   having count(p.id) > e.max_participants;
--
-- 앱이 인식하는 오류 메시지 (components/event-card.tsx, edit-form.tsx)
--   EVENT_FULL       : 정원이 가득 참
--   MAX_BELOW_COUNT  : 현재 참석자 수보다 작은 정원으로 수정 시도
--   (중복 참석은 유니크 위반 코드 23505 로 전달됨)
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. 중복 참석 방지
-- ---------------------------------------------------------------------
create unique index if not exists event_participants_event_user_unique
  on event_participants (event_id, user_id);

-- ---------------------------------------------------------------------
-- 2. 정원 초과 방지
--    모임 행을 FOR UPDATE 로 잠가서, 같은 모임에 동시에 들어오는 참석 요청을
--    한 명씩 순서대로 처리한다. (동시에 마지막 한 자리를 노려도 한 명만 성공)
-- ---------------------------------------------------------------------
create or replace function public.enforce_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_count integer;
begin
  select max_participants into v_max
  from events
  where id = new.event_id
  for update;

  -- 모임이 없으면 FK 오류가 나도록 그대로 통과시킨다.
  if not found then
    return new;
  end if;

  select count(*) into v_count
  from event_participants
  where event_id = new.event_id;

  if v_count >= v_max then
    raise exception 'EVENT_FULL';
  end if;

  return new;
end;
$$;

drop trigger if exists event_participants_capacity on event_participants;

create trigger event_participants_capacity
before insert on event_participants
for each row execute function public.enforce_capacity();

-- ---------------------------------------------------------------------
-- 3. 정원 축소 제한
--    UPDATE 는 해당 행을 잠근 상태로 트리거를 실행하므로,
--    위의 참석 추가(FOR UPDATE)와 서로 순서대로 처리된다.
-- ---------------------------------------------------------------------
create or replace function public.enforce_max_not_below_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if new.max_participants is distinct from old.max_participants then
    select count(*) into v_count
    from event_participants
    where event_id = new.id;

    if new.max_participants < v_count then
      raise exception 'MAX_BELOW_COUNT';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists events_max_not_below_count on events;

create trigger events_max_not_below_count
before update of max_participants on events
for each row execute function public.enforce_max_not_below_count();

commit;

-- =====================================================================
-- 실행 후 확인
--   1) 정원 1자리 남은 모임에서 두 계정이 거의 동시에 "참석하기"
--      → 한 명은 성공, 다른 한 명은 "정원이 가득 찼습니다"
--   2) 같은 계정으로 두 탭에서 동시에 "참석하기"
--      → 한 번만 등록되고 "이미 참석했습니다"
--   3) 수정 화면을 연 상태에서 다른 계정이 참석 → 정원을 현재 인원보다
--      작게 저장 시도 → "현재 참석자 수보다 정원을 줄일 수 없습니다"
--   4) 모임 삭제 / 룰마 위임(002) 이 이전과 동일하게 동작하는지
-- =====================================================================
