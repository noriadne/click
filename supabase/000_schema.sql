-- =====================================================================
-- 000: 기본 스키마 (테이블 생성)
--
-- 새 Supabase 프로젝트(예: 서울 리전)에 처음 실행하는 SQL.
-- 이 파일을 먼저 실행한 뒤 001 → 002 → 003 → 004 → 005 순서로 실행한다.
-- (전체 설명은 supabase/README.md 참고)
--
-- 기존(유럽 리전) 프로젝트의 실제 구조를 그대로 재현한다.
--   users.id 는 auth.users.id 를 그대로 사용 (FK 는 001 에서 건다)
--   삭제 규칙: creator_id/user_id/event_id = CASCADE, game_id/owner_id = SET NULL
--
-- 실행 위치: Supabase 대시보드 > SQL Editor
-- =====================================================================

begin;

-- ---- users -------------------------------------------------------
-- id 는 auth.users.id 를 그대로 넣는다. (기본값 없음 / 001 에서 FK 추가)
create table if not exists public.users (
  id         uuid primary key,
  nickname   text not null,
  status     text not null default 'pending'
             check (status in ('pending', 'approved', 'rejected')),
  role       text not null default 'user'
             check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- ---- games -------------------------------------------------------
create table if not exists public.games (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  min_players integer,
  max_players integer,
  -- 웨이트는 선택값(NULL 허용). 입력하는 경우 BGG 기준 1.00 ~ 5.00
  geek_weight numeric check (geek_weight >= 1.00 and geek_weight <= 5.00),
  owner_id    uuid references public.users (id) on delete set null,
  created_at  timestamptz default now()
);

-- ---- events ------------------------------------------------------
create table if not exists public.events (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  event_time       timestamptz not null,
  max_participants integer default 4,
  creator_id       uuid references public.users (id) on delete cascade,
  game_id          uuid references public.games (id) on delete set null,
  created_at       timestamptz default now()
);

-- ---- event_participants -----------------------------------------
create table if not exists public.event_participants (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid references public.events (id) on delete cascade,
  user_id    uuid references public.users (id) on delete cascade,
  created_at timestamptz default now(),
  -- 같은 모임에 같은 유저 중복 참석 방지 (003 의 유니크 인덱스와 동일 역할 → 003 은 건너뜀)
  unique (event_id, user_id)
);

commit;

-- =====================================================================
-- 다음 단계: 001 → 002 → 003 → 004 → 005 순서로 실행 (supabase/README.md 참고)
-- =====================================================================
