"use client";

import { useState } from "react";
import { UserMinus, UserPlus } from "lucide-react";

export type PickerMember = { id: string; nickname: string };

type ParticipantPickerProps = {
  /** 선택 가능한 유저 목록 (승인된 유저, 룰마 본인은 호출하는 쪽에서 제외) */
  members: PickerMember[];
  /** 현재 선택된 유저 id 목록 */
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** 추가로 선택할 수 있는 최대 인원 (정원 - 룰마) */
  limit: number;
  disabled?: boolean;
};

/**
 * 캠페인 모임의 참석자를 고르는 입력 컴포넌트.
 * 저장은 하지 않고 선택 상태만 다룬다. (생성 폼에서 사용, 수정 폼에서도 재사용 예정)
 * 저장 권한은 DB 정책(supabase/007_campaign_roster.sql)이 검사한다.
 */
export default function ParticipantPicker({
  members,
  selectedIds,
  onChange,
  limit,
  disabled = false,
}: ParticipantPickerProps) {
  const [pending, setPending] = useState("");

  const selectedSet = new Set(selectedIds);
  const nicknameOf = new Map(members.map((m) => [m.id, m.nickname]));
  const candidates = members.filter((m) => !selectedSet.has(m.id));
  const remaining = Math.max(0, limit - selectedIds.length);
  const canAdd = !disabled && remaining > 0 && pending !== "";

  const handleAdd = () => {
    if (!canAdd) return;
    onChange([...selectedIds, pending]);
    setPending("");
  };

  const handleRemove = (id: string) => {
    onChange(selectedIds.filter((v) => v !== id));
  };

  return (
    <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="flex gap-2">
        <select
          value={pending}
          onChange={(e) => setPending(e.target.value)}
          disabled={disabled || remaining === 0 || candidates.length === 0}
          aria-label="참석자로 지정할 유저"
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-zinc-100 outline-none transition focus:border-indigo-400 disabled:opacity-50"
        >
          <option value="">
            {candidates.length === 0 ? "추가할 유저가 없습니다" : "유저 선택"}
          </option>
          {candidates.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nickname}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" />
          추가
        </button>
      </div>

      <p className="text-xs text-zinc-500" aria-live="polite">
        {selectedIds.length}명 선택 · 정원 기준 {remaining}명 더 지정할 수 있어요
      </p>

      {selectedIds.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const name = nicknameOf.get(id) ?? "알 수 없음";
            return (
              <li
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-zinc-800 py-1 pl-2.5 pr-1 text-xs text-zinc-300"
              >
                {name}
                <button
                  type="button"
                  onClick={() => handleRemove(id)}
                  disabled={disabled}
                  aria-label={`${name} 선택 해제`}
                  className="rounded-full p-1 text-zinc-400 transition hover:bg-zinc-700 hover:text-red-400 disabled:opacity-50"
                >
                  <UserMinus className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
