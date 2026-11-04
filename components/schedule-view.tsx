"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Calendar from "@/components/calendar";
import type { CalendarViewMode } from "@/lib/types";
import { cn } from "@/lib/utils";

/** header.tsx 의 높이(h-14 + 하단 보더 1px)와 맞춘다. */
const HEADER_HEIGHT = 57;
/** 고정된 달력/헤더 아래에 섹션 제목이 붙지 않도록 주는 여백 */
const GAP = 8;
/** 스크롤 연동: 섹션이 이 높이(px) 이상 보여야 현재 날짜로 인정 */
const VISIBLE_MIN = 40;
/** 클릭 이동 중 스크롤 연동이 선택 날짜를 덮어쓰지 않도록 막는 최대 시간 */
const SCROLL_LOCK_MS = 1500;

/**
 * 달력 + 날짜별 모임 목록.
 * - 달력에서 날짜를 누르면 해당 날짜 섹션(#day-YYYY-MM-DD)으로 스크롤한다.
 * - 스크롤하면 현재 보이는 날짜가 달력의 선택 날짜로 반영된다.
 * - 주간 보기일 때만 달력을 헤더 아래에 고정한다.
 */
export default function ScheduleView({
  today,
  children,
}: {
  today: string;
  children: React.ReactNode;
}) {
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("week");
  const stickyRef = useRef<HTMLDivElement>(null);
  const lockUntil = useRef(0);

  /** 섹션이 멈춰야 할 화면 상단 오프셋 (헤더 + 고정된 달력 + 여백) */
  const getOffset = useCallback(() => {
    const sticky = stickyRef.current;
    const isSticky = !!sticky && getComputedStyle(sticky).position === "sticky";
    return HEADER_HEIGHT + (isSticky ? sticky.offsetHeight : 0) + GAP;
  }, []);

  const scrollToDate = useCallback(
    (date: string, smooth: boolean) => {
      const el = document.getElementById(`day-${date}`);
      // 아직 렌더링 전이거나 숨겨진 상태(승인 전)면 이동하지 않는다.
      if (!el || el.offsetParent === null) return false;

      const top = el.getBoundingClientRect().top + window.scrollY - getOffset();
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      lockUntil.current = Date.now() + SCROLL_LOCK_MS;
      window.scrollTo({
        top: Math.max(0, top),
        behavior: smooth && !reduceMotion ? "smooth" : "auto",
      });
      return true;
    },
    [getOffset],
  );

  const handleSelect = (date: string) => {
    setSelectedDate(date);
    scrollToDate(date, true);
  };

  // 스크롤 연동: 화면 상단에 걸린 날짜 섹션을 선택 날짜로 반영
  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      if (Date.now() < lockUntil.current) return; // 클릭 이동 중에는 무시

      const sections = document.querySelectorAll<HTMLElement>("[data-day]");
      if (sections.length === 0 || sections[0].offsetParent === null) return;

      // 고정 영역(헤더 + 달력) 아래로 섹션이 VISIBLE_MIN px 이상 남아 있는
      // 첫 번째 섹션을 현재 날짜로 본다. (지나간 섹션의 끝부분만 살짝 보이는 경우는 제외)
      const threshold = getOffset() + VISIBLE_MIN;
      let active = sections[sections.length - 1].dataset.day ?? "";
      for (const section of sections) {
        if (section.getBoundingClientRect().bottom > threshold) {
          active = section.dataset.day ?? active;
          break;
        }
      }
      setSelectedDate((prev) => (prev === active ? prev : active));
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // 클릭 이동이 끝나면 잠금을 풀어 다음 사용자 스크롤부터 연동한다.
    const onScrollEnd = () => {
      lockUntil.current = 0;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scrollend", onScrollEnd);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scrollend", onScrollEnd);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [getOffset]);

  // 모임 생성/수정 후 돌아왔을 때 (?date=YYYY-MM-DD) 해당 날짜로 이동
  useEffect(() => {
    const date = new URLSearchParams(window.location.search).get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (scrollToDate(date, false)) {
        setSelectedDate(date);
        clearInterval(timer);
      } else if (tries > 50) {
        clearInterval(timer); // 목록이 아직 없거나 범위 밖의 날짜
      }
    }, 100);
    return () => clearInterval(timer);
  }, [scrollToDate]);

  return (
    <>
      <div
        ref={stickyRef}
        className={cn(
          "z-30 -mx-4 bg-zinc-950 px-4 pb-2",
          viewMode === "week" && "sticky top-[57px] pt-2",
        )}
      >
        <Calendar
          selectedDate={selectedDate}
          today={today}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onSelect={handleSelect}
        />
      </div>

      {children}
    </>
  );
}
