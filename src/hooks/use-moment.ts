"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { isIsoDate, parseTime } from "@/lib/time";
import { useSchoolNow } from "./use-now";

export interface MomentParams {
  id: number | null;
  /** Explicit date from the URL (null = today) */
  date: string | null;
  /** Explicit time from the URL (null = now / live) */
  time: string | null;
}

/** Reads and writes `id`, `date` and `time` search params. */
export function useMomentParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawId = Number(searchParams.get("id"));
  const rawDate = searchParams.get("date");
  const rawTime = searchParams.get("time");
  const params: MomentParams = {
    id: Number.isInteger(rawId) && rawId > 0 ? rawId : null,
    date: isIsoDate(rawDate) ? rawDate : null,
    time: rawTime && !Number.isNaN(parseTime(rawTime)) ? rawTime : null,
  };

  const update = useCallback(
    (patch: Partial<Record<keyof MomentParams, string | number | null>>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return { ...params, update };
}

export interface EffectiveMoment {
  date: string;
  atMin: number;
  /** seconds within the minute – only meaningful when live */
  seconds: number;
  live: boolean;
  today: string;
}

/** Resolves the moment to display: the chosen date/time, or the ticking "now". */
export function useEffectiveMoment(date: string | null, time: string | null): EffectiveMoment | null {
  const now = useSchoolNow();
  if (!now) return null;
  const targetDate = date ?? now.date;
  if (time) {
    return { date: targetDate, atMin: parseTime(time), seconds: 0, live: false, today: now.date };
  }
  return {
    date: targetDate,
    atMin: now.minutes,
    seconds: now.seconds,
    live: targetDate === now.date,
    today: now.date,
  };
}
