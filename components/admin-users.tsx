"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, Pencil, ShieldOff, UserX, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/user-provider";
import type { User, UserStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = UserStatus | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "대기" },
  { value: "approved", label: "승인" },
  { value: "rejected", label: "거절" },
  { value: "all", label: "전체" },
];

const STATUS_LABEL: Record<UserStatus, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "거절",
};

export default function AdminUsers() {
  const router = useRouter();
  const { profile, isAdmin, ready } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 관리자가 아니면 메인으로
  useEffect(() => {
    if (ready && !isAdmin) router.replace("/");
  }, [ready, isAdmin, router]);

  const loadUsers = useCallback(async () => {
    const { data, error: err } = await createClient()
      .from("users")
      .select("*")
      .order("created_at", { ascending: true });
    if (err) setError(`목록을 불러오지 못했습니다. (${err.message})`);
    else setUsers((data ?? []) as User[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !isAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, [ready, isAdmin, loadUsers]);

  if (!ready || !isAdmin) {
    return <div className="p-8 text-center text-sm text-zinc-500">확인 중…</div>;
  }

  const visible =
    filter === "all" ? users : users.filter((u) => u.status === filter);
  const count = (f: Filter) =>
    f === "all" ? users.length : users.filter((u) => u.status === f).length;

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-xl border border-zinc-800 p-1">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-medium transition",
              filter === value
                ? "bg-indigo-500 text-white"
                : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            {label} {count(value)}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-3 rounded-lg bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
          {notice}
        </p>
      )}

      {loading ? (
        <p className="p-8 text-center text-sm text-zinc-500">불러오는 중…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-400">
          해당하는 유저가 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((u) => (
            <UserRow
              key={u.id}
              target={u}
              isSelf={u.id === profile?.id}
              onChanged={loadUsers}
              onError={setError}
              onNotice={setNotice}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function UserRow({
  target,
  isSelf,
  onChanged,
  onError,
  onNotice,
}: {
  target: User;
  isSelf: boolean;
  onChanged: () => Promise<void>;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
}) {
  const [nickname, setNickname] = useState(target.nickname);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const update = (patch: Partial<Pick<User, "status" | "role" | "nickname">>) => {
    onError(null);
    startTransition(async () => {
      const { data, error } = await createClient()
        .from("users")
        .update(patch)
        .eq("id", target.id)
        .select("id");

      if (error) {
        onError(
          error.code === "23505"
            ? "이미 사용 중인 닉네임입니다."
            : `변경에 실패했습니다. (${error.message})`,
        );
        return;
      }
      if (!data || data.length === 0) {
        onError("변경할 수 없습니다. 권한을 확인해주세요.");
        return;
      }
      setEditing(false);
      await onChanged();
    });
  };

  /** 승인된 유저 추방 (004_kick_user.sql) */
  const kick = () => {
    if (
      !window.confirm(
        `${target.nickname}님을 추방할까요?\n\n` +
          "- 앞으로 열릴 모임의 참석이 모두 취소됩니다.\n" +
          "- 룰마인 모임은 다음 참석자에게 넘어가고, 혼자인 모임은 삭제됩니다.\n" +
          "- 지난 모임 기록은 남습니다.\n" +
          "- 다시 가입 요청을 보내면 대기 목록에 나타납니다.",
      )
    ) {
      return;
    }
    onError(null);
    onNotice(null);
    startTransition(async () => {
      const { data, error } = await createClient().rpc("kick_user", {
        p_user: target.id,
      });

      if (error) {
        onError(
          error.message.includes("CANNOT_KICK_SELF")
            ? "본인은 추방할 수 없습니다."
            : error.message.includes("NOT_APPROVED_USER")
              ? "승인된 유저만 추방할 수 있습니다. 목록을 새로고침해 주세요."
              : `추방에 실패했습니다. (${error.message})`,
        );
        await onChanged();
        return;
      }

      const result = (data ?? {}) as {
        handed_over?: number;
        deleted_events?: number;
        removed_participations?: number;
      };
      onNotice(
        `${target.nickname}님을 추방했습니다. ` +
          `참석 취소 ${result.removed_participations ?? 0}건, ` +
          `룰마 위임 ${result.handed_over ?? 0}건, ` +
          `모임 삭제 ${result.deleted_events ?? 0}건`,
      );
      await onChanged();
    });
  };

  const nicknameChanged = nickname.trim() !== target.nickname;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px]",
            target.status === "approved" && "bg-emerald-500/15 text-emerald-300",
            target.status === "pending" && "bg-amber-500/15 text-amber-300",
            target.status === "rejected" && "bg-red-500/15 text-red-300",
          )}
        >
          {STATUS_LABEL[target.status]}
        </span>
        {target.role === "admin" && (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
            <Crown className="h-3 w-3" />
            관리자
          </span>
        )}
        {isSelf && <span className="text-[11px] text-zinc-500">(나)</span>}
        <span className="ml-auto text-[11px] text-zinc-500">
          {target.created_at.slice(0, 10)}
        </span>
      </div>

      {/* 닉네임: 승인된 유저만 수정 가능 (연필 아이콘을 눌러야 입력창 표시) */}
      {editing ? (
        <div className="mb-3 flex gap-2">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            autoFocus
            aria-label="닉네임"
            className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-400"
          />
          <button
            disabled={isPending || !nicknameChanged || !nickname.trim()}
            onClick={() => update({ nickname: nickname.trim() })}
            className="rounded-lg bg-indigo-500 px-3 text-xs font-medium text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            저장
          </button>
          <button
            disabled={isPending}
            onClick={() => {
              setNickname(target.nickname);
              setEditing(false);
            }}
            className="rounded-lg border border-zinc-700 px-3 text-xs text-zinc-400 transition hover:bg-zinc-800"
          >
            취소
          </button>
        </div>
      ) : (
        <div className="mb-3 flex items-center gap-2">
          <span className="min-w-0 truncate text-base font-semibold text-zinc-100">
            {target.nickname}
          </span>
          {target.status === "approved" && (
            <button
              onClick={() => setEditing(true)}
              aria-label="닉네임 수정"
              className="rounded-lg p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* 상태 / 역할 */}
      <div className="flex flex-wrap gap-2">
        {target.status !== "approved" && (
          <button
            disabled={isPending}
            onClick={() => update({ status: "approved" })}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            승인
          </button>
        )}
        {/* 대기 중인 유저: 가입 거절 */}
        {target.status === "pending" && (
          <button
            disabled={isPending}
            onClick={() => update({ status: "rejected" })}
            className="inline-flex items-center gap-1 rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-950 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            거절
          </button>
        )}
        {target.status === "approved" &&
          (target.role === "user" ? (
            <button
              disabled={isPending}
              onClick={() => update({ role: "admin" })}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-amber-400 transition hover:bg-zinc-800 disabled:opacity-50"
            >
              <Crown className="h-3.5 w-3.5" />
              관리자 지정
            </button>
          ) : (
            !isSelf && (
              <button
                disabled={isPending}
                onClick={() => update({ role: "user" })}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
              >
                <ShieldOff className="h-3.5 w-3.5" />
                관리자 해제
              </button>
            )
          ))}
        {/* 승인된 유저: 추방 (본인 제외) */}
        {target.status === "approved" && !isSelf && (
          <button
            disabled={isPending}
            onClick={kick}
            className="ml-auto inline-flex items-center gap-1 rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-950 disabled:opacity-50"
          >
            <UserX className="h-3.5 w-3.5" />
            추방
          </button>
        )}
      </div>
    </div>
  );
}
