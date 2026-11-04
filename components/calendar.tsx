"use client";

import { useState } from "react";
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
  viewMode,
  onViewModeChange,
  onSelect,
}: {
  selectedDate: string;
  today: string;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onSelect: (date: string) => void;
}) {
  const range = getSelectableRange(today);

  const [viewStart, setViewStart] = useState(() =>
    viewMode === "week" ? startOfWeekMonday(selectedDate) : startOfMonth(selectedDate),
  );

  const viewFor = (mode: CalendarViewMode, date: string) =>
    mode === "week" ? startOfWeekMonday(date) : startOfMonth(date);

  const days =
    viewMode === "week" ? daysInWeek(viewStart) : daysInMonthGrid(viewStart);

  // 스크롤 연동 등으로 선택 날짜가 바뀌어 현재 보이는 범위를 벗어나면 달력도 따라간다.
  // (렌더 중 상태 조정 패턴)
  const [prevSelected, setPrevSelected] = useState(selectedDate);
  if (prevSelected !== selectedDate) {
    setPrevSelected(selectedDate);
    const visible =
      viewMode === "week"
        ? daysInWeek(viewStart).includes(selectedDate)
        : isSameMonth(selectedDate, viewStart);
    if (!visible) setViewStart(viewFor(viewMode, selectedDate));
  }

  const handleViewModeChange = (mode: CalendarViewMode) => {
    onViewModeChange(mode);
    setViewStart(viewFor(mode, selectedDate));
  };

  const handlePrev = () =>
    setViewStart((prev) =>
      viewMode === "week" ? addDays(prev, -7) : addMonths(prev, -1),
    );

  const handleNext = () =>
    setViewStart((prev) =>
      viewMode === "week" ? addDays(prev, 7) : addMonths(prev, 1),
    );

  return (
    <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
      {/* 상단 컨트롤 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            aria-label="이전"
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[6rem] text-center text-sm font-semibold text-zinc-100">
            {formatMonthTitle(viewStart)}
          </span>
          <button
            onClick={handleNext}
            aria-label="다음"
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
              onClick={() => selectable && onSelect(date)}
              disabled={!selectable}
              aria-label={`${date}${isToday ? " 오늘" : ""}`}
              aria-pressed={isSelected}
              className={cn(
                "flex items-center justify-center rounded-lg text-sm transition",
                // 주간 보기는 한 줄이라 높이를 줄여 고정(sticky) 시 공간을 덜 차지한다.
                viewMode === "week" ? "h-10" : "aspect-square",
                isSelected && "bg-indigo-500 font-bold text-white",
                selectable && !isSelected && "text-zinc-200 hover:bg-zinc-700",
                !selectable && "cursor-not-allowed text-zinc-600",
                viewMode === "month" && !inMonth && !isSelected && "opacity-30",
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
