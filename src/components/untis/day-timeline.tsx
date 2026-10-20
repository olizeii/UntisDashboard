"use client";

import { CalendarX2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLongDate } from "@/lib/time";
import type { ElementType, Lesson, TimeUnit } from "@/lib/untis/types";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { LessonBadges, RefList } from "./lesson-meta";

const COLUMNS: Record<ElementType, { key: "rooms" | "classes" | "teachers"; type: ElementType }[]> = {
  teacher: [
    { key: "classes", type: "class" },
    { key: "rooms", type: "room" },
  ],
  class: [
    { key: "teachers", type: "teacher" },
    { key: "rooms", type: "room" },
  ],
  room: [
    { key: "classes", type: "class" },
    { key: "teachers", type: "teacher" },
  ],
  subject: [],
};

interface Row {
  key: string;
  label: string;
  start: string;
  end: string;
  startMin: number;
  endMin: number;
  lessons: Lesson[];
}

function buildRows(units: TimeUnit[], lessons: Lesson[]): Row[] {
  const used = new Set<Lesson>();
  const rows: Row[] = units.map((u) => {
    const inUnit = lessons.filter((l) => l.startMin < u.endMin && l.endMin > u.startMin);
    inUnit.forEach((l) => used.add(l));
    return { key: `u-${u.name}-${u.startMin}`, label: u.name, start: u.start, end: u.end, startMin: u.startMin, endMin: u.endMin, lessons: inUnit };
  });
  // Lessons outside the timegrid (or no timegrid at all)
  for (const l of lessons) {
    if (used.has(l)) continue;
    const existing = rows.find((r) => r.startMin === l.startMin && r.endMin === l.endMin && r.label === "");
    if (existing) existing.lessons.push(l);
    else rows.push({ key: `x-${l.startMin}-${l.endMin}`, label: "", start: l.start, end: l.end, startMin: l.startMin, endMin: l.endMin, lessons: [l] });
  }
  return rows.sort((a, b) => a.startMin - b.startMin);
}

export function DayTimeline({
  lessons,
  units,
  type,
  date,
  atMin,
  highlight,
}: {
  lessons: Lesson[];
  units: TimeUnit[];
  type: ElementType;
  date: string;
  atMin: number;
  /** Whether to highlight the row at `atMin` */
  highlight: boolean;
}) {
  const rows = buildRows(units, lessons);
  // Trim empty rows after the last lesson to keep the list compact
  const lastIdx = rows.findLastIndex((r) => r.lessons.length > 0);
  const visible = lastIdx >= 0 ? rows.slice(0, lastIdx + 1) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tagesplan</CardTitle>
        <CardDescription>{formatLongDate(date)}</CardDescription>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <EmptyState icon={CalendarX2} title="Keine Stunden" description="Für diesen Tag sind keine Stunden eingetragen." />
        ) : (
          <ol className="divide-y">
            {visible.map((row) => {
              const isNow = highlight && row.startMin <= atMin && atMin < row.endMin;
              return (
                <li
                  key={row.key}
                  aria-current={isNow ? "time" : undefined}
                  className={cn(
                    "-mx-2 grid grid-cols-[4.5rem_1fr] gap-3 rounded-lg px-2 py-3 sm:grid-cols-[6rem_1fr]",
                    isNow && "bg-live/10 ring-live/40 ring-1",
                  )}
                >
                  <div className="text-sm tabular-nums">
                    <p className="font-medium">{row.label ? `${row.label}. Std.` : "Sonder"}</p>
                    <p className="text-muted-foreground text-xs">
                      {row.start}–{row.end}
                    </p>
                  </div>
                  <div className="min-w-0 space-y-2">
                    {row.lessons.length === 0 ? (
                      <p className="text-muted-foreground pt-0.5 text-sm">frei</p>
                    ) : (
                      row.lessons.map((l) => (
                        <div key={l.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", l.status === "cancelled" && "opacity-60")}>
                          <span className={cn("min-w-12 font-semibold", l.status === "cancelled" && "line-through")}>
                            <RefList refs={l.subjects} type="subject" />
                          </span>
                          {COLUMNS[type].map((c) => (
                            <span key={c.key} className={cn("text-sm", l.status === "cancelled" && "line-through")}>
                              <RefList refs={l[c.key]} type={c.type} date={date} />
                            </span>
                          ))}
                          <LessonBadges lesson={l} />
                          {isNow && l.status !== "cancelled" && (
                            <span className="text-live text-xs font-medium">jetzt</span>
                          )}
                          {(l.substText || l.text) && l.status !== "regular" && (
                            <p className="text-muted-foreground w-full text-xs">{l.substText ?? l.text}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export function DayTimelineSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="grid grid-cols-[4.5rem_1fr] gap-3 sm:grid-cols-[6rem_1fr]">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
