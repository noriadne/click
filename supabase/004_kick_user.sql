-- =====================================================================
-- 004: 유저 추방 (관리자 전용)
--
-- kick_user(p_user) 하나로 아래를 한 트랜잭션에서 처리한다.
--   1) 앞으로 열릴 모임 중 추방 대상이 룰마인 모임
--        - 다른 참석자가 있으면 가장 먼저 참석한 사람에게 룰마 위임
--        - 다른 참석자가 없으면 모임 삭제 (참석 기록은 cascade 삭제)
--   2) 앞으로 열릴 모임의 참석 기록 삭제
--   3) 상태 rejected, 역할 user 로 변경 (재요청은 기존처럼 가능 → 대기로 들어옴)
--   * 지난 모임(서울 기준 오늘 이전 날짜)의 기록은 이력으로 남긴다.
--
-- 실행 위치: Supabase 대시보드 > SQL Editor (데이터 변경 없음, 함수만 생성)
-- =====================================================================

create or replace function public.kick_user(p_user uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_event record;
  v_next uuid;
  v_handed_over integer := 0;
  v_deleted_events integer := 0;
  v_removed integer := 0;
begin
  if not is_admin() then
    raise exception 'NOT_ADMIN';
  end if;
  if p_user = auth.uid() then
    raise exception 'CANNOT_KICK_SELF';
  end if;
  if not exists (select 1 from users where id = p_user and status = 'approved') then
    raise exception 'NOT_APPROVED_USER';
  end if;

  -- 1) 앞으로 열릴 모임 중 대상이 룰마인 모임: 위임 또는 삭제
  for v_event in
    select id from events
    where creator_id = p_user
      and (event_time at time zone 'Asia/Seoul')::date >= v_today
    for update
  loop
    select user_id into v_next
    from event_participants
    where event_id = v_event.id and user_id <> p_user
    order by created_at asc, id asc
    limit 1;

    if v_next is null then
      delete from events where id = v_event.id;
      v_deleted_events := v_deleted_events + 1;
    else
      update events set creator_id = v_next where id = v_event.id;
      v_handed_over := v_handed_over + 1;
    end if;
  end loop;

  -- 2) 앞으로 열릴 모임의 참석 기록 삭제
  --    (룰마는 위에서 이미 바뀌었으므로 002 위임 트리거는 아무것도 하지 않는다)
  delete from event_participants p
  using events e
  where p.event_id = e.id
    and p.user_id = p_user
    and (e.event_time at time zone 'Asia/Seoul')::date >= v_today;
  get diagnostics v_removed = row_count;

  -- 3) 상태 / 역할 변경
  update users set status = 'rejected', role = 'user' where id = p_user;

  return json_build_object(
    'handed_over', v_handed_over,
    'deleted_events', v_deleted_events,
    'removed_participations', v_removed
  );
end;
$$;

revoke all on function public.kick_user(uuid) from public;
grant execute on function public.kick_user(uuid) to authenticated;

-- =====================================================================
-- 실행 후 확인
--   1) 계정 B 가 룰마인 모임(참석자 2명 이상) / B 혼자인 모임 / B 가 참석만 한 모임을 준비
--   2) 관리자 화면에서 B 를 "추방"
--   3) 첫 모임은 다음 참석자가 룰마, 혼자였던 모임은 삭제, 참석만 한 모임은 B 빠짐
--   4) B 창 새로고침 → 재요청 화면, 재요청하면 관리자 화면 "대기" 에 나타남
-- =====================================================================
