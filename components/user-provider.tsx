"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

type CurrentUser = { id: string; nickname: string } | null;

type UserContextValue = {
  user: CurrentUser;
  ready: boolean;
  registerNickname: (nickname: string) => Promise<{ error?: string }>;
  logout: () => void;
};

const UserContext = createContext<UserContextValue>({
  user: null,
  ready: false,
  registerNickname: async () => ({}),
  logout: () => {},
});

const STORAGE_KEY = "boardgame_user_nickname";

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser>(null);
  const [ready, setReady] = useState(false);

  // 마운트 시 localStorage 닉네임 → Supabase 유저 조회
  useEffect(() => {
    const nickname = localStorage.getItem(STORAGE_KEY);
    if (!nickname) {
      setReady(true);
      return;
    }

    const supabase = createClient();
    supabase
      .from("users")
      .select("*")
      .eq("nickname", nickname)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setUser(data);
        } else {
          // DB에 없는 닉네임이면 localStorage 정리
          localStorage.removeItem(STORAGE_KEY);
        }
        setReady(true);
      });
  }, []);

  const registerNickname = useCallback(
    async (nickname: string): Promise<{ error?: string }> => {
      const trimmed = nickname.trim();
      if (!trimmed) return { error: "닉네임을 입력해주세요." };

      const supabase = createClient();

      // 기존 유저 조회
      const { data: existing } = await supabase
        .from("users")
        .select("*")
        .eq("nickname", trimmed)
        .maybeSingle();

      if (existing) {
        localStorage.setItem(STORAGE_KEY, trimmed);
        setUser(existing);
        return {};
      }

      // 신규 유저 생성
      const { data: created, error } = await supabase
        .from("users")
        .insert({ nickname: trimmed })
        .select()
        .single();

      if (error || !created) return { error: "유저 생성에 실패했습니다." };

      localStorage.setItem(STORAGE_KEY, trimmed);
      setUser(created);
      return {};
    },
    [],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <UserContext.Provider value={{ user, ready, registerNickname, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
