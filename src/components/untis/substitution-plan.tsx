"use client";

import { CalendarCheck2, Info, SearchX } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffectiveMoment, useMomentParams } from "@/hooks/use-moment";
import { useSubstitutions } from "@/hooks/use-untis";
import { formatLongDate } from "@/lib/time";
import type { Substitution, SubstitutionType } from "@/lib/untis/types";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { RefList, SUBST_META, SubstitutionBadge } from "./lesson-meta";
import { MomentControls } from "./moment-controls";

const FILTERS: { value: "all" | SubstitutionType[]; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: ["cancel"], label: "Entfälle" },
  { value: ["subst"], label: "Vertretungen" },
  { value: ["rmchg", "rmlk"], label: "Raumänderungen" },
  { value: ["add", "shift", "exam", "bs", "free", "other"], label: "Sonstige" },
];

function groupByDate(items: Substitution[]) {
  const map = new Map<string, Substitution[]>();
  for (const s of items) map.set(s.date, [...(map.get(s.date) ?? []), s]);
  return [...map.entries()];
}

function SubstitutionRows({ items, date, isPast }: { items: Substitution[]; date: string; isPast: (s: Substitution) => boolean }) {
  return (
    <>
      {/* Desktop: table */}
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Zeit</TableHead>
            <TableHead className="w-36">Art</TableHead>
            <TableHead>Klasse</TableHead>
            <TableHead>Gegenstand</TableHead>
            <TableHead>Lehrkraft</TableHead>
            <TableHead>Raum</TableHead>
            <TableHead>Info</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((s) => (
            <TableRow key={s.id} className={cn(isPast(s) && "opacity-50")}>
              <TableCell className="tabular-nums">
                {s.start}–{s.end}
              </TableCell>
              <TableCell>
                <SubstitutionBadge type={s.type} />
              </TableCell>
              <TableCell className="font-medium">
                <RefList refs={s.classes} type="class" date={date} />
              </TableCell>
              <TableCell>
                <RefList refs={s.subjects} type="subject" />
              </TableCell>
              <TableCell>
                <RefList refs={s.teachers} type="teacher" date={date} />
              </TableCell>
              <TableCell>
                <RefList refs={s.rooms} type="room" date={date} />
              </TableCell>
              <TableCell className="text-muted-foreground max-w-64 truncate" title={s.text}>
                {s.text}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {/* Mobile: cards */}
      <ul className="divide-y md:hidden">
        {items.map((s) => (
          <li key={s.id} className={cn("space-y-1.5 py-3", isPast(s) && "opacity-50")}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">
                <RefList refs={s.classes} type="class" date={date} />
              </span>
              <SubstitutionBadge type={s.type} />
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-x-3 text-sm">
              <span className="text-foreground tabular-nums">
                {s.start}–{s.end}
              </span>
              <RefList refs={s.subjects} type="subject" />
              <RefList refs={s.teachers} type="teacher" date={date} />
              <RefList refs={s.rooms} type="room" date={date} />
            </div>
            {s.text && <p className="text-muted-foreground text-xs">{s.text}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}

export function SubstitutionPlan() {
  const { date, update } = useMomentParams();
  const moment = useEffectiveMoment(date, null);
  const [range, setRange] = useState<"day" | "week">("day");
  const [filter, setFilter] = useState(0);
  const [query, setQuery] = useState("");
  const { data, error, mutate, isLoading } = useSubstitutions(date, range);

  const types = FILTERS[filter].value;
  const q = query.trim().toLowerCase();
  const items = (data?.items ?? []).filter((s) => {
    if (types !== "all" && !types.includes(s.type)) return false;
    if (!q) return true;
    const hay = [...s.classes, ...s.teachers, ...s.rooms, ...s.subjects]
      .flatMap((r) => [r.name, r.longName ?? "", r.original?.name ?? ""])
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
  const isPast = (s: Substitution) =>
    !!moment && (s.date < moment.today || (s.date === moment.today && s.endMin <= moment.atMin));

  const counts = (data?.items ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.type] = (acc[s.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <MomentControls moment={moment} time={null} showTime={false} onChange={({ date: d }) => update({ date: d ?? null })} />
        <Tabs value={range} onValueChange={(v) => setRange(v as "day" | "week")}>
          <TabsList>
            <TabsTrigger value="day">Tag</TabsTrigger>
            <TabsTrigger value="week">Woche</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Art filtern">
          {FILTERS.map((f, i) => {
            const n = f.value === "all" ? data?.items.length : f.value.reduce((sum, t) => sum + (counts[t] ?? 0), 0);
            return (
              <button
                key={f.label}
                type="button"
                onClick={() => setFilter(i)}
                aria-pressed={filter === i}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  filter === i ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
                )}
              >
                {f.label}
                {n !== undefined && <span className="tabular-nums opacity-70">{n}</span>}
              </button>
            );
          })}
        </div>
        <Input placeholder="Klasse, Lehrkraft, Raum …" value={query} onChange={(e) => setQuery(e.target.value)} className="sm:w-64" />
      </div>

      {data?.source === "derived" && (
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <Info className="size-3.5" />
          Der Account darf den offiziellen Vertretungsplan nicht abrufen – die Liste wurde aus den Stundenplänen abgeleitet.
        </p>
      )}

      {error && !data ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : !data || (isLoading && data.to === data.from && range === "week") ? (
        <Card>
          <CardContent className="space-y-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={data.items.length === 0 ? CalendarCheck2 : SearchX}
          title={data.items.length === 0 ? "Keine Änderungen" : "Keine Treffer"}
          description={data.items.length === 0 ? "Für diesen Zeitraum gibt es keine Entfälle oder Vertretungen." : "Filter oder Suchbegriff anpassen."}
        />
      ) : (
        groupByDate(items).map(([day, list]) => (
          <Card key={day}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">{formatLongDate(day)}</CardTitle>
              <div className="flex flex-wrap justify-end gap-1">
                {(Object.keys(SUBST_META) as SubstitutionType[])
                  .filter((t) => list.some((s) => s.type === t))
                  .map((t) => (
                    <Badge key={t} variant="secondary" className="tabular-nums">
                      {(() => {
                        const n = list.filter((s) => s.type === t).length;
                        return `${n} ${n === 1 ? SUBST_META[t].label : SUBST_META[t].plural}`;
                      })()}
                    </Badge>
                  ))}
              </div>
            </CardHeader>
            <CardContent>
              <SubstitutionRows items={list} date={day} isPast={isPast} />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
