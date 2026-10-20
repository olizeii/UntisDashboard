"use client";

import {
  BookOpen,
  Clock,
  Coffee,
  DoorOpen,
  GraduationCap,
  Home,
  MapPin,
  Moon,
  Sunrise,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { EffectiveMoment } from "@/hooks/use-moment";
import { ELEMENT_LABELS } from "@/lib/nav";
import { formatDuration, formatMinutes } from "@/lib/time";
import { computeStatus } from "@/lib/untis/status";
import type { ElementRef, ElementState, ElementStatus, ElementType, Lesson, TimeUnit } from "@/lib/untis/types";
import { cn } from "@/lib/utils";
import { LessonBadges, RefList } from "./lesson-meta";

const STATE_META: Record<ElementState, { label: string; icon: LucideIcon; tone: string }> = {
  "in-lesson": { label: "Im Unterricht", icon: GraduationCap, tone: "bg-live/15 text-live" },
  break: { label: "Pause", icon: Coffee, tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  free: { label: "Freistunde", icon: DoorOpen, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  "before-school": { label: "Noch kein Unterricht", icon: Sunrise, tone: "bg-muted text-muted-foreground" },
  "after-school": { label: "Unterricht beendet", icon: Home, tone: "bg-muted text-muted-foreground" },
  "no-lessons": { label: "Kein Unterricht", icon: Moon, tone: "bg-muted text-muted-foreground" },
};

const FACTS: Record<ElementType, { key: "rooms" | "classes" | "teachers" | "subjects"; type: ElementType; label: string; icon: LucideIcon }[]> = {
  teacher: [
    { key: "rooms", type: "room", label: "Raum", icon: MapPin },
    { key: "classes", type: "class", label: "Klasse", icon: UsersRound },
    { key: "subjects", type: "subject", label: "Gegenstand", icon: BookOpen },
  ],
  class: [
    { key: "rooms", type: "room", label: "Raum", icon: MapPin },
    { key: "teachers", type: "teacher", label: "Lehrkraft", icon: UserRound },
    { key: "subjects", type: "subject", label: "Gegenstand", icon: BookOpen },
  ],
  room: [
    { key: "classes", type: "class", label: "Klasse", icon: UsersRound },
    { key: "teachers", type: "teacher", label: "Lehrkraft", icon: UserRound },
    { key: "subjects", type: "subject", label: "Gegenstand", icon: BookOpen },
  ],
  subject: [],
};

export function periodName(units: TimeUnit[], lesson: Lesson) {
  const unit = units.find((u) => u.startMin === lesson.startMin) ?? units.find((u) => u.startMin <= lesson.startMin && lesson.startMin < u.endMin);
  return unit ? `${unit.name}. Stunde` : null;
}

function formatCountdown(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function Fact({ icon: Icon, label, refs, type, date, primary }: {
  icon: LucideIcon;
  label: string;
  refs: ElementRef[];
  type: ElementType;
  date: string;
  primary?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className={cn("font-semibold break-words", primary ? "text-3xl sm:text-4xl" : "text-xl")}>
        <RefList refs={refs} type={type} date={date} />
      </p>
      {refs[0]?.longName && refs[0].longName !== refs[0].name && (
        <p className="text-muted-foreground truncate text-sm">{refs.map((r) => r.longName ?? r.name).join(", ")}</p>
      )}
    </div>
  );
}

function LessonFacts({ lesson, type, date }: { lesson: Lesson; type: ElementType; date: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {FACTS[type].map((f, i) => (
        <Fact key={f.key} icon={f.icon} label={f.label} refs={lesson[f.key]} type={f.type} date={date} primary={i === 0} />
      ))}
    </div>
  );
}

function NextHint({ lesson, type, units, atMin, prefix = "Nächste Stunde" }: {
  lesson: Lesson;
  type: ElementType;
  units: TimeUnit[];
  atMin: number;
  prefix?: string;
}) {
  const [first] = FACTS[type];
  const period = periodName(units, lesson);
  return (
    <div className="bg-muted/50 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-3 py-2 text-sm">
      <span className="text-muted-foreground">{prefix}</span>
      <span className="font-medium tabular-nums">
        {lesson.start}–{lesson.end}
        {period ? ` · ${period}` : ""}
      </span>
      <span className="text-muted-foreground">in</span>
      <span className="font-medium">
        <RefList refs={lesson[first.key]} type={first.type} date={lesson.date} />
      </span>
      {FACTS[type].slice(1).map((f) => (
        <span key={f.key} className="text-muted-foreground">
          · <RefList refs={lesson[f.key]} type={f.type} date={lesson.date} className="text-foreground" />
        </span>
      ))}
      {lesson.startMin > atMin && (
        <span className="text-muted-foreground ml-auto">in {formatDuration(lesson.startMin - atMin)}</span>
      )}
    </div>
  );
}

export function LiveStatusCard({
  status,
  type,
  moment,
}: {
  status: ElementStatus;
  type: ElementType;
  moment: EffectiveMoment;
}) {
  // In live mode re-evaluate every second on the client, so the card flips exactly at the bell.
  const live = moment.live && moment.date === status.date;
  const atMin = live ? moment.atMin : status.atMin;
  const computed = live ? computeStatus(status.lessons, atMin) : status;
  const { state, current, next, previous, currentBlockEnd } = computed;
  const meta = STATE_META[state];
  const units = status.timegrid;

  const nowSeconds = atMin * 60 + (live ? moment.seconds : 0);
  const remaining = current ? current.endMin * 60 - nowSeconds : 0;
  const progress = current ? ((nowSeconds - current.startMin * 60) / ((current.endMin - current.startMin) * 60)) * 100 : 0;
  const period = current ? periodName(units, current) : null;
  const blockEnd = currentBlockEnd ?? current?.endMin ?? 0;
  const afterBlock = current
    ? (status.lessons.find((l) => l.status !== "cancelled" && l.startMin >= blockEnd) ?? null)
    : null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-sm">{ELEMENT_LABELS[type].singular}</p>
            <CardTitle className="truncate text-2xl">
              {status.element.name}
              {status.element.longName && (
                <span className="text-muted-foreground ml-2 text-base font-normal">{status.element.longName}</span>
              )}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {live && (
              <span className="text-live flex items-center gap-1.5 text-xs font-medium">
                <span className="relative flex size-2">
                  <span className="bg-live absolute inline-flex size-full animate-ping rounded-full opacity-60" />
                  <span className="bg-live relative inline-flex size-2 rounded-full" />
                </span>
                Live
              </span>
            )}
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium", meta.tone)}>
              <meta.icon className="size-4" />
              {meta.label}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {current ? (
          <>
            <LessonFacts lesson={current} type={type} date={status.date} />
            <LessonBadges lesson={current} />
            {(current.substText || current.text || current.info) && (
              <p className="text-muted-foreground text-sm">{[current.substText, current.text, current.info].filter(Boolean).join(" · ")}</p>
            )}
            <div className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-2 text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5 tabular-nums">
                  <Clock className="size-4" />
                  {current.start}–{current.end}
                  {period ? ` · ${period}` : ""}
                </span>
                <span className="text-right">
                  <span className="text-muted-foreground">Restzeit </span>
                  <span className="text-2xl font-semibold tabular-nums">
                    {live ? formatCountdown(remaining) : formatDuration(Math.ceil(remaining / 60))}
                  </span>
                </span>
              </div>
              <Progress value={progress} aria-label="Fortschritt der Stunde" />
              {currentBlockEnd && currentBlockEnd > current.endMin && (
                <p className="text-muted-foreground text-xs">
                  Doppelstunde – im selben Raum bis {formatMinutes(currentBlockEnd)}
                </p>
              )}
            </div>
            {afterBlock && <NextHint lesson={afterBlock} type={type} units={units} atMin={atMin} prefix="Danach" />}
          </>
        ) : (
          <div className="space-y-3">
            {state === "no-lessons" && (
              <p className="text-muted-foreground">
                An diesem Tag sind keine Stunden eingetragen (Wochenende, Ferien oder alles entfallen).
              </p>
            )}
            {state === "after-school" && previous && (
              <p className="text-muted-foreground">
                Letzte Stunde endete um <span className="text-foreground font-medium">{previous.end}</span>.
              </p>
            )}
            {(state === "break" || state === "free") && previous && (
              <p className="text-muted-foreground">
                Zuletzt bis {previous.end} in{" "}
                <RefList refs={previous[FACTS[type][0].key]} type={FACTS[type][0].type} date={status.date} className="text-foreground font-medium" />
                .
              </p>
            )}
            {next && <NextHint lesson={next} type={type} units={units} atMin={atMin} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LiveStatusSkeleton() {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="h-7 w-32 rounded-full" />
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-9 w-full" />
      </CardContent>
    </Card>
  );
}
