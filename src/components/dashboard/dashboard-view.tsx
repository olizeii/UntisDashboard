"use client";

import { ArrowRight, CalendarCheck2, DoorOpen, UserRoundSearch } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ElementPicker } from "@/components/untis/element-picker";
import { EmptyState } from "@/components/untis/empty-state";
import { ErrorState } from "@/components/untis/error-state";
import { RefList, SubstitutionBadge } from "@/components/untis/lesson-meta";
import { useSchoolNow } from "@/hooks/use-now";
import { useDashboardStats, useFreeRooms } from "@/hooks/use-untis";
import { elementHref } from "@/lib/nav";
import { formatLongDate, formatMinutes } from "@/lib/time";
import { KpiTiles, KpiTilesSkeleton } from "./kpi-tiles";
import { UtilizationChart } from "./utilization-chart";

function greeting(minutes: number) {
  if (minutes < 11 * 60) return "Guten Morgen";
  if (minutes < 18 * 60) return "Guten Tag";
  return "Guten Abend";
}

function Hero() {
  const now = useSchoolNow();
  return (
    <div className="flex flex-col gap-1">
      {now ? (
        <>
          <h2 className="text-2xl font-semibold tracking-tight">{greeting(now.minutes)}!</h2>
          <p className="text-muted-foreground text-sm">
            {formatLongDate(now.date)} ·{" "}
            <span className="tabular-nums">
              {formatMinutes(now.minutes)}:{String(now.seconds).padStart(2, "0")}
            </span>
          </p>
        </>
      ) : (
        <>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-56" />
        </>
      )}
    </div>
  );
}

function TeacherQuickSearch() {
  const router = useRouter();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRoundSearch className="size-4" /> Wo ist …?
        </CardTitle>
        <CardDescription>Lehrkraft suchen und sofort Raum, Klasse und Restzeit sehen.</CardDescription>
      </CardHeader>
      <CardContent>
        <ElementPicker
          type="teacher"
          value={null}
          className="sm:w-full"
          onSelect={(t) => router.push(elementHref("teacher", t.id)!)}
        />
      </CardContent>
    </Card>
  );
}

function FreeRoomsPreview() {
  const { data, error, mutate } = useFreeRooms();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DoorOpen className="size-4" /> Jetzt freie Räume
        </CardTitle>
        <CardDescription>{data ? `${data.free.length} von ${data.free.length + data.occupied.length} Räumen frei` : " "}</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/rooms/free">
              Alle <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {error && !data ? (
          <ErrorState error={error} onRetry={() => mutate()} compact />
        ) : !data ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-20 rounded-lg" />
            ))}
          </div>
        ) : data.free.length === 0 ? (
          <p className="text-muted-foreground text-sm">Alle Räume sind belegt.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.free.slice(0, 12).map((r) => (
              <Link
                key={r.room.id}
                href={elementHref("room", r.room.id)!}
                className="hover:bg-muted rounded-lg border px-3 py-1.5 text-sm transition-colors"
                title={r.room.longName}
              >
                <span className="font-semibold">{r.room.name}</span>
                <span className="text-muted-foreground block text-xs tabular-nums">
                  {r.freeUntilMin === null ? "ganzer Tag" : `bis ${formatMinutes(r.freeUntilMin)}`}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  const { data: stats, error, mutate } = useDashboardStats();

  return (
    <div className="space-y-6">
      <Hero />

      {error && !stats ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : (
        <>
          {stats ? <KpiTiles stats={stats} /> : <KpiTilesSkeleton />}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            {stats ? (
              <UtilizationChart data={stats.utilization} atMin={stats.atMin} live={stats.live} />
            ) : (
              <Skeleton className="h-80 rounded-xl" />
            )}
            <div className="space-y-4">
              <TeacherQuickSearch />
              <FreeRoomsPreview />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Anstehende Änderungen</CardTitle>
              <CardDescription>Entfälle, Vertretungen und Raumänderungen von heute</CardDescription>
              <CardAction>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/substitutions">
                    Vertretungsplan <ArrowRight />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {!stats ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : stats.upcomingChanges.length === 0 ? (
                <EmptyState icon={CalendarCheck2} title="Keine weiteren Änderungen" description="Für den Rest des Tages ist alles nach Plan." className="border-none" />
              ) : (
                <ul className="divide-y">
                  {stats.upcomingChanges.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                      <span className="w-24 tabular-nums">
                        {s.start}–{s.end}
                      </span>
                      <SubstitutionBadge type={s.type} className="w-32 justify-start" />
                      <span className="min-w-16 font-medium">
                        <RefList refs={s.classes} type="class" />
                      </span>
                      <span className="text-muted-foreground min-w-12">
                        <RefList refs={s.subjects} type="subject" />
                      </span>
                      <RefList refs={s.teachers} type="teacher" />
                      <RefList refs={s.rooms} type="room" className="text-muted-foreground" />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
