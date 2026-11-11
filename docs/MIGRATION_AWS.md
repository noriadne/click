# Vercel → AWS 이전 계획 (진행 중)

> **현재 상태 (2026-11-11, v1.07): 이 계획은 진행하지 않음.**
> 서비스는 이 저장소가 아닌 별도 소스로 구현되어 `https://clickboardgame.com`(AWS)에서 운영되고, DB 데이터 이관도 끝났다.
> 이 저장소의 Vercel 배포는 모든 주소에서 이전 안내 페이지만 보여준다(`proxy.ts`, `lib/moved-notice.ts`).
> 아래 내용은 당시 검토 기록으로만 남긴다.

이 문서는 웹 호스팅을 Vercel에서 AWS로 옮기는 작업의 **계획과 현재 상태**입니다.
다른 PC·다른 에이전트·협업자가 이어받을 때 이 문서부터 읽습니다.
결정이 바뀌거나 단계가 끝나면 이 문서를 갱신하고, 코드·설정 변경은 `PATCHNOTES.md`에도 버전으로 남깁니다.

- 최종 갱신: 2026-11-09
- 상태: **계획 단계** (AWS 쪽 방식 미정, 저장소·인프라 변경 없음)
- 기준 코드: `main` = `a481210` (v1.04)

---

## 1. 배경과 범위

- 서비스가 호평을 받아 클라우드 엔지니어(협업자)에게서 AWS로 옮기자는 제안을 받음.
- 사용할 도메인: `clickboardgame.com`
- **이번 범위: 웹 호스팅(Next.js 앱 실행·배포)만 Vercel → AWS.**
- **Supabase(DB·로그인·권한)는 이전 보류.** 운영 Supabase(서울 리전)를 그대로 쓰고, AWS에서 돌아가는 앱이 같은 Supabase에 붙는다.

### Supabase를 보류한 이유

이 앱은 Supabase를 DB로만 쓰지 않는다.

- 로그인: 카카오 OAuth, 세션 쿠키(`@supabase/ssr`)
- 데이터 API: 브라우저가 Supabase REST로 직접 읽고 씀(서버 액션 없음)
- 권한: RLS 정책과 함수가 `auth.uid()`, `auth.users`에 의존 (`supabase/001`~`007`)

그래서 이전 난이도가 방식마다 크게 다르다.

| 방식 | 앱 코드 영향 |
|---|---|
| Supabase 유지 (현재 결정) | 거의 없음 |
| 서버에 Supabase 직접 설치(Docker) | 적음. `supabase/` SQL 순차 실행으로 구조 재현 가능. 대신 백업·업데이트·보안 운영 부담 |
| RDS(순수 PostgreSQL) | 큼. 로그인 재구현, 브라우저 직접 DB 접근을 서버 경유로 변경, `auth.uid()` 기반 권한 재작성 필요 |

DB 이전은 호스팅 이전이 끝난 뒤 별도 프로젝트로 다시 검토한다.

---

## 2. 현재 상태 (Vercel)

| 항목 | 현재 |
|---|---|
| 운영 주소 | `https://click-iota-dun.vercel.app` (`main` 브랜치 자동 배포) |
| 테스트 주소 | `https://click-git-dev-click-363b.vercel.app` (`dev` 브랜치 프리뷰) |
| 함수 리전 | 서울 `icn1` (Vercel 대시보드 설정, `vercel.json` 없음) |
| 환경변수 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production and Preview 모두 운영 Supabase 값) |
| 배포 흐름 | `dev` 푸시 → 프리뷰 확인 → `dev`를 `main`에 fast-forward 머지·푸시 → 운영 배포 |
| 플랜 | Hobby (비상업) |

앱 스택: Next.js 16.4.4 (App Router, Turbopack, `cacheComponents`, `partialPrefetching`), React 19.3, Tailwind v4, Node 24.

---

## 3. 저장소 점검 결과 (2026-11-09 확인)

### 문제없음 (확인함)

- Vercel 전용 패키지(`@vercel/*`), `vercel.json`, `VERCEL_*` 환경변수를 쓰지 않음.
- Next.js 16 문서(`node_modules/next/dist/docs/01-app/01-getting-started/17-deploying.md`) 기준, **Node 서버(`next start`)와 Docker 방식은 모든 기능을 지원**. 정적 export는 불가(로그인 콜백, `proxy.ts`, 매 요청 렌더링 때문).
- `proxy.ts`: `next start`에서 별도 설정 없이 동작(`02-guides/self-hosting.md`).
- Cache Components: Node 서버·Docker에서 기본 동작. **서버 한 대 + 로컬 디스크면 추가 설정 불필요.**
- `next/image` 미사용 → 이미지 최적화(sharp) 설정 불필요.
- `app/layout.tsx`의 개발 환경 표시는 `NODE_ENV` 기준이라 AWS에서도 그대로 동작.

### 이전 시 처리 필요

| # | 항목 | 내용 | 대응 | 상태 |
|---|---|---|---|---|
| C1 | 로그인 콜백 주소 | `app/auth/callback/route.ts`가 `new URL(request.url).origin`으로 돌아갈 주소를 만든다. Nginx 등 리버스 프록시 뒤에서는 `http://localhost:3000` 같은 내부 주소가 될 수 있어 로그인 후 잘못된 곳으로 이동할 수 있음 | 프록시가 원래 `Host`와 `X-Forwarded-Proto`를 넘기게 설정. 또는 코드가 `x-forwarded-host`/`x-forwarded-proto`를 읽게 수정(Vercel에서도 동작하므로 미리 적용 가능). **유일하게 코드 수정이 예상되는 곳** | 미적용 |
| C2 | 스트리밍 | 홈·생성 화면이 Suspense로 나눠 전송됨. Nginx 버퍼링이 켜져 있으면 스트리밍이 사라져 느려 보임(깨지지는 않음) | Nginx에서 버퍼링 끄기 또는 `X-Accel-Buffering: no` 헤더 | 미적용 |
| C3 | 공개 환경변수 | `NEXT_PUBLIC_*`는 **빌드 시점에 코드에 박힘** | 빌드하는 곳(GitHub Actions 또는 서버)에 값 제공. 실행 시점에만 넣으면 안 됨 | - |
| C4 | 폰트 | `next/font/google`(Geist)이 빌드 때 Google Fonts에서 받음 | 빌드 환경에서 인터넷 접속 필요 | - |
| C5 | Node 버전 | 로컬 확인은 Node 24. `package.json`에 `engines` 없음 | 서버·CI도 Node 24 | - |
| C6 | 빌드 메모리 | 작은 인스턴스에서 `next build` 메모리 부족 가능 | CI에서 빌드하거나 스왑 확보 | - |
| C7 | 다중 인스턴스 | 서버 여러 대로 늘리면 공유 캐시, 일관된 build ID(`deploymentId`/`generateBuildId`), Server Functions 암호화 키 공유가 필요(`self-hosting.md` "Multi-Server Deployments") | 초기에는 서버 1대 권장 | - |

---

## 4. Vercel이 하던 일 → AWS에서 대신할 것

| Vercel 기능 | AWS 대체 |
|---|---|
| 푸시 시 자동 빌드·배포 | GitHub Actions (SSH로 `git pull → npm ci → npm run build → 재시작`, 또는 Docker 이미지 → ECR → 서버 실행). AWS 인증은 장기 키 대신 GitHub OIDC + IAM 역할 권장 |
| HTTPS 자동 | Nginx/Caddy + Let's Encrypt, 또는 ALB + ACM |
| 서울 리전 | `ap-northeast-2` |
| 환경변수 관리 | GitHub Secrets / 서버 환경 파일 |
| `dev` 브랜치 프리뷰 | 필요 시 `dev.clickboardgame.com` 테스트 서버 |
| 롤백 | 이전 빌드·이미지 태그 보관 |
| 로그 | pm2 로그, CloudWatch |
| 자동 재시작 | pm2, systemd, Docker restart 정책 |

### AWS 실행 방식 후보 (미정, 협업자와 결정)

| 방식 | 특징 |
|---|---|
| EC2 + Node(`next start`) + Nginx | 모든 기능 지원. 서버 운영을 직접 함 |
| Docker (EC2 / ECS / App Runner) | 모든 기능 지원. 환경 재현이 쉬움. 초기 설정이 더 많음 |
| AWS Amplify Hosting | Vercel과 가장 비슷(저장소 연결, 브랜치 프리뷰). **Next 16 최신 기능(`proxy.ts`, Cache Components) 지원 여부 확인 필요** |

---

## 5. 외부 설정 변경 (Supabase는 유지)

- **운영 Supabase → Authentication → URL Configuration**
  - Site URL: `https://clickboardgame.com`
  - Redirect URLs 추가: `https://clickboardgame.com/auth/callback` (테스트 서버를 두면 그 주소도)
  - Vercel 주소들은 전환 완료 후 제거
- **카카오 개발자 콘솔**: OAuth 콜백은 Supabase 주소라 변경 없음. "사이트 도메인"에 새 도메인 등록 필요 여부는 콘솔에서 확인(미확인).
- **기존 주소 이용자**: `click-iota-dun.vercel.app` 접속자를 새 도메인으로 보내는 리다이렉트를 Vercel에 남겨둠.
- **문서**: `PATCHNOTES.md`의 Vercel 기준 배포 흐름·프리뷰 로그인 메모, 코드 주석의 Vercel 언급 갱신.

---

## 6. 전환 순서

1. AWS에 앱을 띄우고 **운영 Supabase**에 연결 (임시 주소 또는 테스트 서브도메인)
2. 임시 주소를 운영 Supabase Redirect URLs에 추가 후 로그인·모임 생성·캠페인 참석자 지정 확인
3. `clickboardgame.com` DNS를 AWS로 연결, Supabase Site URL 변경
4. Vercel은 1~2주 유지(새 도메인으로 리다이렉트, 문제 시 DNS 되돌림)
5. 안정화 후 Vercel 정리, 문서 갱신, 이용자 안내

---

## 7. 미결정 사항 (협업자에게 확인)

1. AWS 실행 방식: EC2 / Docker(ECS·App Runner) / Amplify
2. AWS 계정 소유자와 비용 부담
3. 배포 자동화와 서버 설정 담당자
4. 테스트용 `dev` 주소 필요 여부
5. `clickboardgame.com` DNS 관리 위치(Route 53, 기타 등록업체)와 기존 사이트 유무
6. DB 이전을 나중에라도 할지, 한다면 이유(비용, 데이터 위치 규정, 운영 통합 등)

---

## 8. 확인된 사실 / 확인하지 못한 것

- `clickboardgame.com`: 2026-11-09 기준 이 PC에서 DNS 조회 결과 연결된 서버 주소(A/CNAME)가 없었음. 공용 DNS 재확인은 중단되어 결과 없음. **현재 떠 있는 서버는 없는 것으로 보이나 확정 아님.**
- Amplify의 Next 16 지원 범위: 미확인.
- 카카오 콘솔의 도메인 등록 필요 여부: 미확인.
- AWS 환경에서 C1(콜백 주소) 실제 동작: 미확인(프록시 설정에 따라 다름).

---

## 9. 다른 PC 환경 메모

- LG U+ 망 등 HTTPS 검사 장비가 있는 네트워크에서는 Node가 인증서를 거부해 `fetch failed`(`SELF_SIGNED_CERT_IN_CHAIN`)가 날 수 있음. 해결: 사용자 환경변수 `NODE_OPTIONS=--use-system-ca`. (`NODE_TLS_REJECT_UNAUTHORIZED=0`은 쓰지 않음.) AWS 서버에는 해당 없음.

---

## 10. 관련 파일

- `PATCHNOTES.md`: 버전별 변경 기록(현재 v1.04)
- `supabase/README.md`, `supabase/000`~`007`: DB 구축 정의(빈 프로젝트 순차 실행 = 운영 상태)
- `app/auth/callback/route.ts`: C1 대상
- `next.config.ts`: `cacheComponents`, `partialPrefetching` (C2·C7 관련 설정 추가 위치)
- `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md`: 자체 호스팅 공식 가이드(Next 16)
