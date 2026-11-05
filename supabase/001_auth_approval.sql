-- =====================================================================
-- 001: 카카오 인증 + 가입 승인제 + RLS
--
-- 실행 위치: Supabase 대시보드 > SQL Editor
-- 주의
--   * 테스트 데이터(users / events / event_participants)를 삭제합니다.
--   * games 테이블 데이터는 유지하고 owner_id 만 null 로 비웁니다.
--   * 이 SQL 실행 후에는 "로그인 + 승인된 유저"만 앱 데이터에 접근 가능합니다.
--     앱 코드(인증 전환)가 배포/반영된 상태에서 실행하세요.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. 테스트 데이터 정리 (FK 순서 주의, games 는 보존)
-- ---------------------------------------------------------------------
delete from event_participants;
delete from events;
update games set owner_id = null;
delete from users;

-- ---------------------------------------------------------------------
-- 1. users 테이블 확장
--    id = auth.users.id (카카오 로그인 시 Supabase 가 발급한 유저 ID)
--
--    000_schema.sql 을 먼저 실행한 새 DB 에서는 status/role 컬럼이 이미 있고
--    id 에 기본값도 없으므로, 아래는 모두 "없을 때만" 적용되도록 작성한다.
--    (기존 DB 에서도 동일하게 안전)
-- ---------------------------------------------------------------------
alter table users alter column id drop default;

-- auth.users 참조 FK (없을 때만 추가)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_id_fkey'
  ) then
    alter table users
      add constraint users_id_fkey
      foreign key (id) references auth.users (id) on delete cascade;
  end if;
end $$;

alter table users
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected'));

alter table users
  add column if not exists role text not null default 'user'
    check (role in ('user', 'admin'));

-- 닉네임 중복 방지 (대소문자 무시)
create unique index if not exists users_nickname_unique
  on users (lower(nickname));

-- ---------------------------------------------------------------------
-- 2. 헬퍼 함수 (RLS 재귀 방지를 위해 security definer)
-- ---------------------------------------------------------------------
create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from users
    where id = auth.uid() and status = 'approved'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from users
    where id = auth.uid() and status = 'approved' and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- 3. 가입 요청 함수
--    - 행이 없으면 pending 으로 생성
--    - rejected 였다면 닉네임을 바꿔 다시 pending 으로 (재요청 허용)
--    - pending / approved 는 변경 불가
--    일반 유저에게는 users 에 대한 직접 insert/update 권한을 주지 않는다.
-- ---------------------------------------------------------------------
create or replace function public.request_signup(p_nickname text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_nick text := btrim(p_nickname);
  v_status text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if v_nick is null or char_length(v_nick) < 1 or char_length(v_nick) > 20 then
    raise exception 'invalid nickname';
  end if;

  select status into v_status from users where id = v_uid;

  if not found then
    insert into users (id, nickname, status, role)
    values (v_uid, v_nick, 'pending', 'user');
    return 'pending';
  end if;

  if v_status = 'rejected' then
    update users set nickname = v_nick, status = 'pending' where id = v_uid;
    return 'pending';
  end if;

  return v_status;
end;
$$;

revoke all on function public.request_signup(text) from public;
grant execute on function public.request_signup(text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. RLS 활성화
-- ---------------------------------------------------------------------
alter table users enable row level security;
alter table games enable row level security;
alter table events enable row level security;
alter table event_participants enable row level security;

-- 기존 정책이 있다면 충돌 방지를 위해 제거
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('users', 'games', 'events', 'event_participants')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ---- users ----
-- 본인 행은 항상 조회 / 승인된 유저는 승인된 유저 목록 조회(참석자 닉네임 표시용) / 관리자는 전체
create policy users_select on users for select to authenticated
  using (
    id = auth.uid()
    or is_admin()
    or (is_approved() and status = 'approved')
  );

-- 상태 / 역할 / 닉네임 변경은 관리자만
create policy users_update_admin on users for update to authenticated
  using (is_admin())
  with check (is_admin());

-- ---- games ----
create policy games_select on games for select to authenticated
  using (is_approved());

create policy games_insert_admin on games for insert to authenticated
  with check (is_admin());

create policy games_update_admin on games for update to authenticated
  using (is_admin()) with check (is_admin());

create policy games_delete_admin on games for delete to authenticated
  using (is_admin());

-- ---- events ----
create policy events_select on events for select to authenticated
  using (is_approved());

create policy events_insert on events for insert to authenticated
  with check (is_approved() and creator_id = auth.uid());

create policy events_update on events for update to authenticated
  using (is_approved() and (creator_id = auth.uid() or is_admin()))
  with check (is_approved() and (creator_id = auth.uid() or is_admin()));

create policy events_delete on events for delete to authenticated
  using (is_approved() and (creator_id = auth.uid() or is_admin()));

-- ---- event_participants ----
create policy participants_select on event_participants for select to authenticated
  using (is_approved());

create policy participants_insert on event_participants for insert to authenticated
  with check (
    is_approved()
    and (
      user_id = auth.uid()
      -- 모임 생성자가 본인을 룰마로 등록하는 경우도 위 조건으로 충족됨
    )
  );

create policy participants_delete on event_participants for delete to authenticated
  using (is_approved() and (user_id = auth.uid() or is_admin()));

commit;

-- =====================================================================
-- 실행 후: 첫 관리자 지정
--   1) 앱에서 카카오 로그인 → 가입 요청(닉네임 입력)까지 진행
--   2) 아래 SQL 로 본인을 승인 + 관리자로 승격
--
--   update users
--      set status = 'approved', role = 'admin'
--    where nickname = '<본인 닉네임>';
-- =====================================================================
