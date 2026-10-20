"use client";

import { ChevronLeft, ChevronRight, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EffectiveMoment } from "@/hooks/use-moment";
import { addDays, formatLongDate, formatMinutes } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * Date + time selection. Empty time means "live" (follows the clock).
 */
export function MomentControls({
  moment,
  time,
  onChange,
  showTime = true,
  className,
}: {
  moment: EffectiveMoment | null;
  /** Explicit time from the URL (null = live) */
  time: string | null;
  onChange: (patch: { date?: string | null; time?: string | null }) => void;
  showTime?: boolean;
  className?: string;
}) {
  const date = moment?.date ?? "";
  const setDate = (value: string) => onChange({ date: value && value !== moment?.today ? value : null });
  const live = moment?.live ?? false;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label="Vorheriger Tag"
          disabled={!moment}
          onClick={() => setDate(addDays(date, -1))}
        >
          <ChevronLeft />
        </Button>
        <Input
          type="date"
          aria-label="Datum"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-[9.5rem]"
          disabled={!moment}
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Nächster Tag"
          disabled={!moment}
          onClick={() => setDate(addDays(date, 1))}
        >
          <ChevronRight />
        </Button>
      </div>
      {showTime && (
        <Input
          type="time"
          aria-label="Uhrzeit"
          value={time ?? (moment ? formatMinutes(moment.atMin) : "")}
          onChange={(e) => onChange({ time: e.target.value || null })}
          className="w-[7.5rem]"
          disabled={!moment}
        />
      )}
      <Button
        variant={live ? "secondary" : "outline"}
        onClick={() => onChange({ date: null, time: null })}
        disabled={!moment || live}
        aria-pressed={live}
      >
        <Radio className={cn(live && "text-live")} />
        {live ? "Live" : "Jetzt"}
      </Button>
      {moment && (
        <span className="text-muted-foreground text-sm">
          {formatLongDate(moment.date)}
          {moment.date === moment.today ? " (heute)" : ""}
        </span>
      )}
    </div>
  );
}
