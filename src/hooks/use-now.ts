"use client";

import { useSyncExternalStore } from "react";
import { useAppConfig } from "@/components/app-config";
import { zonedNow, type ZonedNow } from "@/lib/time";

// A single shared 1-second clock for all components. The server snapshot is
// `null`, so nothing time-dependent is rendered during prerendering/hydration.

let current: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = () => current;
const getServerSnapshot = () => null;

/** Current epoch ms, or `null` before the component has mounted. */
export function useNowEpoch(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Current date/time in the school's time zone, or `null` before mount. */
export function useSchoolNow(): (ZonedNow & { epoch: number }) | null {
  const epoch = useNowEpoch();
  const { timezone } = useAppConfig();
  if (epoch === null) return null;
  return { ...zonedNow(epoch, timezone), epoch };
}
