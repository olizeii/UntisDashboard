"use client";

import { createContext, useContext } from "react";
import { DEFAULT_TIMEZONE } from "@/lib/time";

interface AppConfig {
  timezone: string;
}

const AppConfigContext = createContext<AppConfig>({ timezone: DEFAULT_TIMEZONE });

export function AppConfigProvider({
  timezone,
  children,
}: AppConfig & { children: React.ReactNode }) {
  return <AppConfigContext value={{ timezone }}>{children}</AppConfigContext>;
}

export function useAppConfig() {
  return useContext(AppConfigContext);
}
