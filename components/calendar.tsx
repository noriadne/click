"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addMonths,
  daysInMonthGrid,
  daysInWeek,
  formatMonthTitle,
  getSelectableRange,
  isSameMonth,
  isSelectableDate,
  startOfMonth,
  startOfWeekMonday,
} from "@/lib/dates";
import type { CalendarViewMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEK_HEADERS = ["월", "화", "수", "목", "금", "토", "일"];

export default function Calendar({
  selectedDate,
  today,
}: {
  selectedDate: string;
  today: string;
}) {
  const router = useRouter();
  const range = getSelectableRange(today);

  const [viewMode, setViewMode] = useState<CalendarViewMode>("week");
  const [viewStart, setViewStart] = useState(() =>
    startOfWeekMonday(selectedDate),
  );

  const handleViewModeChange = (mode: CalendarViewMode) => {
    setViewMode(mode);
    setViewStart(
      mode === "week" ? startOfWeekMonday(selectedDate) : startOfMonth(selectedDate),
    );
  };

  const handlePrev = () =>
    setViewStart((prev) =>
      viewMode === "week" ? addDays(prev, -7) : addMonths(prev, -1),
    );

  const handleNext = () =>
    setViewStart((prev) =>
      viewMode === "week" ? addDays(prev, 7) : addMonths(prev, 1),
    );

  const handleDateClick = (date: string) => {
    if (!isSelectableDate(date, range)) return;
    router.push(`/?date=${date}`);
  };

  const days =
    viewMode === "week" ? daysInWeek(viewStart) : daysInMonthGrid(viewStart);

  return (
    <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
      {/* 상단 컨트롤 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[6rem] text-center text-sm font-semibold text-zinc-100">
            {formatMonthTitle(viewStart)}
          </span>
          <button
            onClick={handleNext}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* 주간 / 월간 토글 */}
        <div className="flex rounded-lg border border-zinc-700 p-0.5">
          {(["week", "month"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleViewModeChange(mode)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition",
                viewMode === mode
                  ? "bg-indigo-500 text-white"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
            >
              {mode === "week" ? "주간" : "월간"}
            </button>
          ))}
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="mb-1 grid grid-cols-7">
        {WEEK_HEADERS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-[11px] font-medium text-zinc-500"
          >
            {label}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((date) => {
          const selectable = isSelectableDate(date, range);
          const isSelected = date === selectedDate;
          const isToday = date === today;
          const inMonth = isSameMonth(date, viewStart);
          const dayNum = Number(date.slice(8));

          return (
            <button
              key={date}
              onClick={() => handleDateClick(date)}
              disabled={!selectable}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg text-sm transition",
                // 선택된 날짜
                isSelected && "bg-indigo-500 font-bold text-white",
                // 선택 가능 + 미선택
                selectable && !isSelected &&
                  "text-zinc-200 hover:bg-zinc-700",
                // 선택 불가
                !selectable && "cursor-not-allowed text-zinc-600",
                // 월간 뷰에서 다른 달 날짜
                viewMode === "month" && !inMonth && !isSelected && "opacity-30",
                // 오늘 표시 (미선택일 때만 링 표시)
                isToday && !isSelected && "ring-2 ring-indigo-400",
              )}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
    </div>
  );
}
