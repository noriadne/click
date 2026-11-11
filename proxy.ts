import { movedNoticeHtml } from "@/lib/moved-notice";

// v1.07: 서비스가 clickboardgame.com 으로 이전했다.
// 인증 여부와 상관없이 모든 주소에서 이전 안내 페이지만 응답한다. (앱 화면, 로그인 콜백 포함)
// 이전 전의 Supabase 세션 갱신 로직은 git 기록(v1.06, fad7bf2 의 proxy.ts)에서 복구할 수 있다.
export function proxy() {
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
