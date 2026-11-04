"use client";

import { useRouter } from "next/navigation";
import { addDays, getSelectableRange, weekdayLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** 오늘부터 다음 주 일요일까지 날짜 배열 생성 */
function buildDateList(min: string, max: string): string[] {
  const dates: string[] = [];
  let cur = min;
  while (cur <= max) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}

export default function DateBar({
  selectedDate,
  today,
}: {
  selectedDate: string;
  today: string;
}) {
  const router = useRouter();
  const range = getSelectableRange(today);
  const dates = buildDateList(range.min, range.max);

  const handleClick = (date: string) => {
    router.push(`/?date=${date}`);
  };

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1">
      <div className="flex gap-2">
        {dates.map((date) => {
          const isSelected = date === selectedDate;
          const isToday = date === today;
          const day = Number(date.slice(8));

          return (
            <button
              key={date}
              onClick={() => handleClick(date)}
              className={cn(
                "flex min-w-[3.25rem] flex-col items-center rounded-xl px-3 py-2 transition",
                isSelected
                  ? "bg-indigo-500 text-white"
                  : "bg-white text-zinc-600 hover:bg-indigo-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800",
              )}
            >
              <span className="text-[11px] opacity-70">
                {weekdayLabel(date)}
              </span>
              <span className="text-lg font-bold leading-tight">{day}</span>
              {isToday && (
                <span
                  className={cn(
                    "text-[9px] font-medium",
                    isSelected ? "text-white/80" : "text-indigo-500",
                  )}
                >
                  오늘
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
