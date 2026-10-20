"use client";

import { useConnection } from "@/hooks/use-untis";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function ConnectionBadge({ className }: { className?: string }) {
  const { data, error, isLoading } = useConnection();

  const state = isLoading
    ? { label: "Verbinde …", dot: "bg-muted-foreground animate-pulse", hint: "Verbindung wird geprüft" }
    : error || !data?.ok
      ? {
          label: "Offline",
          dot: "bg-destructive",
          hint: data?.error?.message ?? error?.message ?? "Keine Verbindung zu WebUntis",
        }
      : data.mode === "demo"
        ? { label: "Demo", dot: "bg-amber-500", hint: "Demo-Modus mit generierten Testdaten (UNTIS_MOCK=true)" }
        : { label: "Live", dot: "bg-live", hint: `Verbunden mit ${data.server} · ${data.school}` };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex h-7 items-center gap-2 rounded-full border px-2.5 text-xs font-medium",
            className,
          )}
          role="status"
        >
          <span className={cn("size-2 rounded-full", state.dot)} aria-hidden />
          {state.label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{state.hint}</TooltipContent>
    </Tooltip>
  );
}
