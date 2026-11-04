-- =====================================================================
-- 002: 룰마 자동 위임
--
-- 룰마(events.creator_id)가 참석을 취소하면, 남은 참석자 중
-- 가장 먼저 참석한(created_at 이 가장 이른) 사람에게 룰마를 넘긴다.
--
-- 실행 위치: Supabase 대시보드 > SQL Editor
-- 참고
--   * 남은 참석자가 없으면(룰마 혼자) 아무것도 하지 않는다.
--     (앱 화면에서 이 경우의 참석 취소를 막고 모임 삭제를 안내한다.)
--   * 모임 삭제로 참석 기록이 cascade 삭제될 때는 모임 행이 이미 없으므로
--     아래 exists 조건이 거짓이 되어 위임이 일어나지 않는다.
-- =====================================================================

create or replace function public.handover_host()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next uuid;
begin
  -- 지워진 참석자가 현재 룰마가 아니면 할 일 없음
  if not exists (
    select 1 from events
    where id = old.event_id and creator_id = old.user_id
  ) then
    return old;
  end if;

  -- 남은 참석자 중 가장 먼저 참석한 사람
  select user_id into v_next
  from event_participants
  where event_id = old.event_id and user_id <> old.user_id
  order by created_at asc, id asc
  limit 1;

  if v_next is not null then
    update events set creator_id = v_next where id = old.event_id;
  end if;

  return old;
end;
$$;

drop trigger if exists event_participants_handover on event_participants;

create trigger event_participants_handover
after delete on event_participants
for each row execute function public.handover_host();

-- =====================================================================
-- 실행 후 확인 (테스트 순서)
--   1) 계정 A 가 모임을 만들고, 계정 B 가 참석한다.
--   2) A 가 참석 취소 → 모임 카드에서 B 가 룰마(왕관)가 되었는지 확인
--   3) 새 모임을 만들고 B 가 참석한 뒤, A 가 모임을 "삭제" → 오류 없이
--      삭제되는지 확인 (cascade 와 트리거가 충돌하지 않는지 점검)
-- =====================================================================
