"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/lib/types";

type ApprovedUser = { id: string; nickname: string };

type UserContextValue = {
  /** 승인(approved)된 유저만 값이 있다. 기존 화면 호환용. */
  user: ApprovedUser | null;
  /** users 테이블 행 (가입 요청 전이면 null) */
  profile: User | null;
  /** 카카오 로그인 세션 존재 여부 */
  authed: boolean;
  isAdmin: boolean;
  ready: boolean;
  signInWithKakao: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  requestSignup: (nickname: string) => Promise<{ error?: string }>;
  reload: () => Promise<void>;
};

const UserContext = createContext<UserContextValue>({
  user: null,
  profile: null,
  authed: false,
  isAdmin: false,
  ready: false,
  signInWithKakao: async () => ({}),
  signOut: async () => {},
  requestSignup: async () => ({}),
  reload: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [authed, setAuthed] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setAuthed(false);
      setProfile(null);
      setReady(true);
      return;
    }

    setAuthed(true);
    const { data: row } = await supabase
      .from("users")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();
    setProfile((row as User | null) ?? null);
    setReady(true);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      // 콜백 안에서 바로 supabase 호출을 await 하면 교착될 수 있어 지연 실행
      setTimeout(() => void load(), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, load]);

  const signInWithKakao = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    return error ? { error: error.message } : {};
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // 서버 컴포넌트 데이터도 초기화되도록 전체 새로고침
    window.location.href = "/";
  }, [supabase]);

  const requestSignup = useCallback(
    async (nickname: string): Promise<{ error?: string }> => {
      const trimmed = nickname.trim();
      if (!trimmed) return { error: "닉네임을 입력해주세요." };
      if (trimmed.length > 20) return { error: "닉네임은 20자 이하여야 합니다." };

      const { error } = await supabase.rpc("request_signup", {
        p_nickname: trimmed,
      });
      if (error) {
        if (error.code === "23505") {
          return { error: "이미 사용 중인 닉네임입니다." };
        }
        return { error: `가입 요청에 실패했습니다. (${error.message})` };
      }
      await load();
      return {};
    },
    [supabase, load],
  );

  const user: ApprovedUser | null =
    profile && profile.status === "approved"
      ? { id: profile.id, nickname: profile.nickname }
      : null;

  // 서버 컴포넌트(모임 목록 등)는 "요청 당시"의 권한으로 그려진다.
  // 승인 대기 중에 그려진 화면은 RLS 때문에 비어 있으므로, 화면을 연 채로
  // 승인되거나(또는 승인이 풀리거나 다른 계정으로 바뀌면) 서버 데이터를 다시 받아온다.
  // 첫 판정은 서버 렌더링과 같은 세션 기준이므로 새로고침하지 않는다.
  const router = useRouter();
  const approvedUserId = ready ? (user?.id ?? null) : undefined;
  const lastApprovedUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (approvedUserId === undefined) return; // 아직 판정 전
    const previous = lastApprovedUserId.current;
    lastApprovedUserId.current = approvedUserId;
    if (previous !== undefined && previous !== approvedUserId) {
      router.refresh();
    }
  }, [approvedUserId, router]);

  return (
    <UserContext.Provider
      value={{
        user,
        profile,
        authed,
        isAdmin: profile?.status === "approved" && profile.role === "admin",
        ready,
        signInWithKakao,
        signOut,
        requestSignup,
        reload: load,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
