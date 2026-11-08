-- =====================================================================
-- 005: 카카오 로그인 개인정보 미저장 (이메일/이름/프로필사진 등 제거)
--
-- 배경
--   카카오 로그인 동의 화면에서 "(필수) 개인정보 제3자 제공 동의"로
--   닉네임/프로필사진/이메일이 Supabase 서버로 전달된다. 이 전달 자체는
--   앱에서 막을 수 없지만, Supabase 가 그 값을 auth.users / auth.identities
--   에 "저장"하는 것은 DB 트리거로 막을 수 있다.
--
--   매 로그인(최초 가입 포함)마다 auth.users.raw_user_meta_data 와
--   auth.identities.identity_data 가 카카오가 보낸 원본 값으로 다시
--   채워지므로(insert/update 시마다), 그 시점에 before 트리거로 가로채
--   로그인에 필요한 최소 식별자만 남기고 나머지를 제거한다.
--
--   남기는 값: provider_id / sub (카카오 회원번호), iss, email_verified,
--              phone_verified — 모두 식별/로그인 동작에 필요하거나 개인을
--              특정하지 않는 값.
--   제거하는 값: email, name, full_name, user_name, preferred_username,
--              nickname, avatar_url, profile_image_url 등 개인정보 전부.
--
-- 실행 위치: Supabase 대시보드 > SQL Editor
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. 공용 함수: jsonb 에서 개인정보 키만 제거
-- ---------------------------------------------------------------------
create or replace function public.strip_pii_jsonb(data jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(data, '{}'::jsonb) - array[
    'email', 'name', 'full_name', 'user_name', 'preferred_username',
    'nickname', 'avatar_url', 'picture', 'profile_image_url'
  ];
$$;

-- ---------------------------------------------------------------------
-- 1. auth.users: insert/update 시마다 raw_user_meta_data 정리
-- ---------------------------------------------------------------------
create or replace function public.strip_user_pii()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.raw_user_meta_data := public.strip_pii_jsonb(new.raw_user_meta_data);
  -- email 컬럼 자체는 Allow users without an email 설정으로 비어 있지만,
  -- 혹시 채워져 들어오는 경우를 대비해 한 번 더 비운다.
  new.email := null;
  return new;
end;
$$;

drop trigger if exists auth_users_strip_pii on auth.users;

create trigger auth_users_strip_pii
before insert or update on auth.users
for each row execute function public.strip_user_pii();

-- ---------------------------------------------------------------------
-- 2. auth.identities: insert/update 시마다 identity_data 정리
-- ---------------------------------------------------------------------
create or replace function public.strip_identity_pii()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.identity_data := public.strip_pii_jsonb(new.identity_data);
  new.email := null;
  return new;
end;
$$;

drop trigger if exists auth_identities_strip_pii on auth.identities;

create trigger auth_identities_strip_pii
before insert or update on auth.identities
for each row execute function public.strip_identity_pii();

-- ---------------------------------------------------------------------
-- 3. 이미 저장돼 있는 기존 행 일괄 정리 (지금까지 가입된 유저)
--    update 를 거치면 위 트리거가 그대로 적용된다.
-- ---------------------------------------------------------------------
update auth.users set raw_user_meta_data = raw_user_meta_data;
update auth.identities set identity_data = identity_data;

commit;

-- =====================================================================
-- 실행 후 확인
--   select raw_user_meta_data from auth.users;
--   select identity_data from auth.identities;
--   -> email/name/avatar_url 등이 빠지고 provider_id, sub 등만 남아야 한다.
--
--   새 카카오 계정으로 로그인 → 가입 → 승인 흐름이 평소와 동일하게
--   동작하는지 확인한다. (닉네임은 카카오에서 가져오지 않고 앱에서
--   직접 입력받으므로 이 변경과 무관하게 동작해야 한다.)
-- =====================================================================
