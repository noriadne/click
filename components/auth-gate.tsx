"use client";

import { useEffect, useState, useTransition } from "react";
import { Clock, Dice5, LogOut, XCircle } from "lucide-react";
import { useUser } from "@/components/user-provider";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-center gap-2">
          <Dice5 className="h-6 w-6 text-indigo-500" />
          <span className="text-lg font-bold tracking-tight">Click 모임일정</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function LogoutButton() {
  const { signOut } = useUser();
  return (
    <button
      onClick={signOut}
      className="mx-auto flex items-center gap-1 text-xs text-zinc-500 transition hover:text-zinc-300"
    >
      <LogOut className="h-3.5 w-3.5" />
      로그아웃
    </button>
  );
}

function LoginCard() {
  const { signInWithKakao } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("auth_error");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (err) setError(err);
  }, []);

  return (
    <Shell>
      <p className="text-center text-sm text-zinc-400">
        초대받은 멤버만 이용할 수 있는 모임 캘린더입니다.
        <br />
        카카오 계정으로 로그인해 주세요.
      </p>
      {error && (
        <p className="rounded-lg bg-red-950 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await signInWithKakao();
            if (result.error) setError(result.error);
          })
        }
        className="w-full rounded-xl bg-yellow-400 py-3 text-sm font-semibold text-black transition hover:bg-yellow-300 disabled:opacity-50"
      >
        {isPending ? "이동 중…" : "카카오로 로그인"}
      </button>
    </Shell>
  );
}

function SignupCard({ rejected }: { rejected: boolean }) {
  const { requestSignup } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nickname = new FormData(e.currentTarget).get("nickname") as string;
    setError(null);
    startTransition(async () => {
      const result = await requestSignup(nickname);
      if (result.error) setError(result.error);
    });
  };

  return (
    <Shell>
      {rejected ? (
        <div className="flex items-start gap-2 rounded-lg bg-red-950 px-3 py-2 text-xs text-red-300">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            현재 이용이 승인되지 않은 상태입니다. 오픈톡방에서 쓰는 이름을
            확인하고 다시 가입 요청을 보내거나, 관리자에게 문의해 주세요.
          </p>
        </div>
      ) : (
        <p className="text-center text-sm text-zinc-400">
          가입 요청을 보내면 관리자가 확인 후 승인합니다.
          <br />
          오픈톡방에서 쓰는 이름을 입력해 주세요.
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label
            htmlFor="signup-nickname"
            className="mb-1 block text-sm font-medium text-zinc-400"
          >
            닉네임
          </label>
          <input
            id="signup-nickname"
            name="nickname"
            type="text"
            maxLength={20}
            required
            autoComplete="off"
            placeholder="오픈톡방 이름"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-900"
          />
        </div>
        {error && (
          <p className="rounded-lg bg-red-950 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
        >
          {isPending ? "요청 중…" : rejected ? "다시 가입 요청" : "가입 요청"}
        </button>
      </form>
      <LogoutButton />
    </Shell>
  );
}

function PendingCard({ nickname }: { nickname: string }) {
  return (
    <Shell>
      <div className="flex flex-col items-center gap-2 text-center">
        <Clock className="h-8 w-8 text-amber-400" />
        <p className="text-sm font-medium text-zinc-100">승인 대기 중</p>
        <p className="text-sm text-zinc-400">
          <span className="text-zinc-200">{nickname}</span> 님의 가입 요청을
          관리자가 확인하고 있습니다.
          <br />
          승인되면 다시 접속해 주세요.
        </p>
      </div>
      <LogoutButton />
    </Shell>
  );
}

/** 로그인 + 승인된 유저에게만 앱 화면을 보여준다. (실제 데이터 보호는 RLS가 담당) */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, authed, profile } = useUser();

  let gate: React.ReactNode = null;
  if (!ready) {
    gate = (
      <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
        불러오는 중…
      </div>
    );
  } else if (!authed) {
    gate = <LoginCard />;
  } else if (!profile) {
    gate = <SignupCard rejected={false} />;
  } else if (profile.status === "pending") {
    gate = <PendingCard nickname={profile.nickname} />;
  } else if (profile.status === "rejected") {
    gate = <SignupCard rejected />;
  }

  // children 은 항상 렌더링한다. (Next.js 인스턴트 내비게이션 검증이 세그먼트를
  // 렌더링할 수 있어야 하기 때문) 승인 전에는 hidden 으로 화면과 접근성 트리에서 숨긴다.
  // 데이터 보호는 RLS 가 담당하므로 숨겨진 영역에는 권한 없는 데이터가 없다.
  return (
    <>
      {gate}
      <div hidden={gate !== null}>{children}</div>
    </>
  );
}
