-- =====================================================================
-- 007: 카테고리 잠금 + 캠페인 모임의 룰마 참석자 지정
--
--   1) 카테고리 잠금
--      모임을 만든 뒤에는 앱(API)에서 events.category 를 바꿀 수 없다.
--      (SQL Editor 처럼 로그인 정보가 없는 접속은 예외: 운영자가 직접 보정 가능)
--
--   2) 캠페인 모임의 참석자 지정
--      category = '캠페인' 인 모임에서만, 그 모임의 룰마(events.creator_id)가
--        - 승인된 다른 유저를 참석자로 추가하고
--        - 다른 참석자를 제외할 수 있다.
--      정원 초과(EVENT_FULL)와 중복 참석(23505)은 003 이 그대로 막는다.
--
--   3) 캠페인 모임은 본인이 직접 참석할 수 없다 (룰마가 지정한 사람만 참석)
--      001 의 participants_insert 정책을 캠페인 조건을 넣어 다시 만든다.
--      참석 취소(001 의 participants_delete)는 그대로 허용한다.
--
-- 주의
--   * 001 은 실행할 때마다 이 테이블들의 정책을 전부 지우고 다시 만든다.
--     001 을 단독으로 재실행했다면 이 파일(007)도 다시 실행해야 한다.
--   * 새 프로젝트는 000 → 007 순서로 실행하면 된다.
--
-- 선행 파일: 000 ~ 006
-- 실행 위치: Supabase 대시보드 > SQL Editor
--
-- 앱이 인식하는 오류 메시지
--   CATEGORY_LOCKED : 카테고리 변경 시도
--   (캠페인 본인 참석 차단은 RLS 위반 42501 로 전달됨)
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. 카테고리 잠금
--    auth.uid() 가 null 이면 SQL Editor 등 서버 쪽 직접 접속이므로 허용한다.
-- ---------------------------------------------------------------------
create or replace function public.lock_event_category()
returns trigger
language plpgsql
as $$
begin
  if new.category is distinct from old.category and auth.uid() is not null then
    raise exception 'CATEGORY_LOCKED';
  end if;
  return new;
end;
$$;

drop trigger if exists events_category_locked on events;

create trigger events_category_locked
before update of category on events
for each row execute function public.lock_event_category();

-- ---------------------------------------------------------------------
-- 2. 캠페인 룰마 판별 / 승인 유저 판별 (RLS 재귀 방지를 위해 security definer)
-- ---------------------------------------------------------------------
create or replace function public.is_campaign_host(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_approved()
     and exists (
       select 1 from events e
       where e.id = p_event
         and e.creator_id = auth.uid()
         and e.category = '캠페인'
     );
$$;

create or replace function public.is_approved_member(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from users
    where id = p_user and status = 'approved'
  );
$$;

create or replace function public.is_campaign_event(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from events e
    where e.id = p_event and e.category = '캠페인'
  );
$$;

revoke all on function public.is_campaign_host(uuid) from public;
revoke all on function public.is_approved_member(uuid) from public;
revoke all on function public.is_campaign_event(uuid) from public;
grant execute on function public.is_campaign_host(uuid) to authenticated;
grant execute on function public.is_approved_member(uuid) to authenticated;
grant execute on function public.is_campaign_event(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. 본인 참석 정책 재정의 (001 의 participants_insert 를 대체)
--    캠페인 모임은 본인이 직접 참석할 수 없다. (룰마 본인 등록은 예외)
--    정책은 OR 로 합쳐지므로, 001 의 허용 정책을 그대로 두면 캠페인 제한이 무시된다.
--    그래서 같은 이름의 정책을 지우고 캠페인 조건을 넣어 다시 만든다.
-- ---------------------------------------------------------------------
drop policy if exists participants_insert on event_participants;

create policy participants_insert on event_participants
  for insert to authenticated
  with check (
    is_approved()
    and user_id = auth.uid()
    and (not is_campaign_event(event_id) or is_campaign_host(event_id))
  );

-- ---------------------------------------------------------------------
-- 4. 캠페인 룰마의 참석자 지정 정책 (위 participants_insert / 001 의 participants_delete 와 OR)
-- ---------------------------------------------------------------------
drop policy if exists participants_insert_campaign_host on event_participants;

create policy participants_insert_campaign_host on event_participants
  for insert to authenticated
  with check (
    is_campaign_host(event_id)
    and is_approved_member(user_id)
  );

drop policy if exists participants_delete_campaign_host on event_participants;

create policy participants_delete_campaign_host on event_participants
  for delete to authenticated
  using (is_campaign_host(event_id));

commit;

-- =====================================================================
-- 실행 후 확인 (테스트 순서)
--   1) 모임 생성 화면에서 카테고리를 캠페인으로 고르고 "참석자 지정"으로 다른 유저를
--      지정한 뒤 생성 → 모임 카드에 룰마 + 지정한 유저가 참석자로 보이는지 확인
--   2) 캠페인이 아닌 카테고리를 고르면 "참석자 지정"이 보이지 않는지 확인
--   2-1) 지정되지 않은 계정으로 캠페인 모임 카드에 "참석하기"가 없는지 확인
--        (일반 모임에서는 기존처럼 참석 가능해야 함)
--   3) 모임 수정 화면에서 카테고리가 바뀌지 않는지 확인
--   (참석자 제외 정책은 이후 수정 화면에서 지정 UI 를 재사용할 때 쓰기 위해 둔다)
-- =====================================================================
