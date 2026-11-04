import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth 콜백: 인가 code → 세션 교환 후 메인으로 이동
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error_description");

  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(message)}`);

  if (oauthError) return fail(oauthError);
  if (!code) return fail("로그인 코드가 없습니다.");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail(error.message);

  return NextResponse.redirect(`${origin}/`);
}
