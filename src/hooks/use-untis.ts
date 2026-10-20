"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { buildUrl, fetcher, type ApiError } from "@/lib/api-client";
import type {
  ConnectionInfo,
  DashboardStats,
  ElementStatus,
  ElementType,
  FreeRoomsResult,
  MasterData,
  Substitution,
} from "@/lib/untis/types";

const LIVE_REFRESH_MS = 60_000;

/** Live views (no fixed time) refresh every minute; historical views don't. */
function liveOptions(time?: string | null): SWRConfiguration {
  return {
    refreshInterval: time ? 0 : LIVE_REFRESH_MS,
    keepPreviousData: true,
    revalidateOnFocus: !time,
  };
}

export function useConnection() {
  return useSWR<ConnectionInfo, ApiError>("/api/untis/status", fetcher, {
    refreshInterval: LIVE_REFRESH_MS,
  });
}

export function useMasterData() {
  return useSWR<MasterData, ApiError>("/api/untis/master", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10 * 60_000,
  });
}

export function useElementStatus(
  type: ElementType,
  id: number | null,
  date?: string | null,
  time?: string | null,
) {
  return useSWR<ElementStatus, ApiError>(
    id ? buildUrl("/api/untis/element", { type, id, date, time }) : null,
    fetcher,
    liveOptions(time),
  );
}

export function useFreeRooms(date?: string | null, time?: string | null) {
  return useSWR<FreeRoomsResult, ApiError>(
    buildUrl("/api/untis/rooms", { date, time }),
    fetcher,
    liveOptions(time),
  );
}

export function useDashboardStats(date?: string | null, time?: string | null) {
  return useSWR<DashboardStats, ApiError>(
    buildUrl("/api/untis/stats", { date, time }),
    fetcher,
    liveOptions(time),
  );
}

export interface SubstitutionsResponse {
  from: string;
  to: string;
  items: Substitution[];
  source: "api" | "derived";
}

export function useSubstitutions(date?: string | null, range: "day" | "week" = "day") {
  return useSWR<SubstitutionsResponse, ApiError>(
    buildUrl("/api/untis/substitutions", { date, range }),
    fetcher,
    { refreshInterval: 3 * 60_000, keepPreviousData: true },
  );
}
