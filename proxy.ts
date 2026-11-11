import { NextResponse, type NextRequest } from "next/server";
import { movedNoticeHtml } from "@/lib/moved-notice";

// v1.07: 서비스가 clickboardgame.com 으로 이전했다.
// 인증 여부와 상관없이 모든 주소에서 이전 안내 페이지만 응답한다. (앱 화면, 로그인 콜백 포함)
// 이전 전의 Supabase 세션 갱신 로직은 git 기록(v1.06, fad7bf2 의 proxy.ts)에서 복구할 수 있다.
//
// v1.08: 운영자(본인)가 모니터링·점검 목적으로 옛 앱 화면에 들어갈 수 있는 우회 코드.
// 안내 페이지의 "운영자 확인" 입력창에 코드(?code=)를 넣으면 쿠키를 심고 통과시킨다.
// 이 코드는 비밀번호가 아니라 운영자 본인만 쓰는 간단한 우회 장치이므로 강도를 낮게 둔다.
const UNLOCK_COOKIE = "click_unlock";
const UNLOCK_CODE = process.env.MOVED_NOTICE_UNLOCK_CODE ?? "1111";

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const hasUnlockCookie = request.cookies.get(UNLOCK_COOKIE)?.value === UNLOCK_CODE;

  // 코드 제출: 루트(/)에 ?code= 가 붙어서 온 경우만 처리한다.
  if (pathname === "/" && searchParams.has("code")) {
    const submitted = searchParams.get("code") ?? "";

    if (submitted === UNLOCK_CODE) {
      const response = NextResponse.redirect(new URL("/", request.url));
      response.cookies.set(UNLOCK_COOKIE, UNLOCK_CODE, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30일
      });
      return response;
    }

    return new Response(movedNoticeHtml({ unlockError: true }), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
      },
    });
  }

  // 코드를 이미 통과한 운영자는 원래 앱(로그인 게이트 등)으로 그대로 보낸다.
  if (hasUnlockCookie) {
    return NextResponse.next();
  }

  return new Response(movedNoticeHtml(), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // 안내 페이지가 캐시돼 나중에 바꾸기 어려워지지 않도록 저장하지 않는다.
      "cache-control": "no-store",
      // 검색엔진에 옛 주소가 남지 않도록 한다.
      "x-robots-tag": "noindex",
    },
  });
}

export const config = {
  matcher: [
    // 정적 파일/이미지 제외 (안내 페이지의 아이콘은 그대로 보여야 함)
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
