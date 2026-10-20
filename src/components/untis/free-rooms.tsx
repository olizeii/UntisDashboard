"use client";

import { DoorClosed, DoorOpen, SearchX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffectiveMoment, useMomentParams } from "@/hooks/use-moment";
import { useFreeRooms } from "@/hooks/use-untis";
import { elementHref } from "@/lib/nav";
import { formatDuration, formatMinutes } from "@/lib/time";
import type { RoomAvailability } from "@/lib/untis/types";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { RefList } from "./lesson-meta";
import { MomentControls } from "./moment-controls";

const ALL = "__all";

function FreeRoomCard({ item, atMin, date }: { item: RoomAvailability; atMin: number; date: string }) {
  const href = elementHref("room", item.room.id, { date });
  const freeFor = item.freeUntilMin === null ? null : item.freeUntilMin - atMin;
  return (
    <Link href={href ?? "#"} className="group">
      <Card className="group-hover:border-live/50 h-full gap-2 py-4 transition-colors">
        <CardContent className="space-y-2 px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-lg font-semibold">{item.room.name}</p>
              <p className="text-muted-foreground truncate text-xs">
                {item.room.longName}
                {item.room.building ? ` · ${item.room.building}` : ""}
              </p>
            </div>
            <DoorOpen className="text-live size-5 shrink-0" />
          </div>
          <p className="text-sm">
            {item.freeUntilMin === null ? (
              <span className="text-live font-medium">Rest des Tages frei</span>
            ) : (
              <>
                frei bis <span className="font-medium tabular-nums">{formatMinutes(item.freeUntilMin)}</span>
                <span className="text-muted-foreground"> · {formatDuration(freeFor!)}</span>
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function FreeRooms() {
  const { date, time, update } = useMomentParams();
  const moment = useEffectiveMoment(date, time);
  const { data, error, mutate } = useFreeRooms(date, time);
  const [query, setQuery] = useState("");
  const [building, setBuilding] = useState(ALL);

  const buildings = [...new Set([...(data?.free ?? []), ...(data?.occupied ?? [])].map((r) => r.room.building).filter(Boolean))] as string[];
  const q = query.trim().toLowerCase();
  const matches = (r: RoomAvailability) =>
    (building === ALL || r.room.building === building) &&
    (!q || `${r.room.name} ${r.room.longName ?? ""}`.toLowerCase().includes(q));
  const free = data?.free.filter(matches) ?? [];
  const occupied = data?.occupied.filter(matches) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <MomentControls moment={moment} time={time} onChange={update} />
        <div className="flex gap-2">
          <Input placeholder="Raum filtern …" value={query} onChange={(e) => setQuery(e.target.value)} className="sm:w-48" />
          {buildings.length > 1 && (
            <Select value={building} onValueChange={setBuilding}>
              <SelectTrigger className="w-40" aria-label="Gebäude">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Gebäude</SelectItem>
                {buildings.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {error && !data ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : !data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Frei um {formatMinutes(data.atMin)}</h3>
              <Badge variant="secondary">
                {free.length} von {free.length + occupied.length}
              </Badge>
            </div>
            {free.length === 0 ? (
              <EmptyState icon={q || building !== ALL ? SearchX : DoorClosed} title="Keine freien Räume" description={q || building !== ALL ? "Filter anpassen." : "Zu diesem Zeitpunkt sind alle Räume belegt."} />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {free.map((item) => (
                  <FreeRoomCard key={item.room.id} item={item} atMin={data.atMin} date={data.date} />
                ))}
              </div>
            )}
          </section>

          {occupied.length > 0 && (
            <section className="space-y-3">
              <h3 className="font-semibold">Belegt</h3>
              <Card className="py-0">
                <CardContent className="divide-y px-0">
                  {occupied.map((item) => {
                    const l = item.occupiedBy!;
                    return (
                      <div key={item.room.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm")}>
                        <Link href={elementHref("room", item.room.id, { date: data.date }) ?? "#"} className="w-16 font-semibold hover:underline">
                          {item.room.name}
                        </Link>
                        <span className="min-w-24">
                          <RefList refs={l.classes} type="class" date={data.date} />
                        </span>
                        <span className="text-muted-foreground min-w-14">
                          <RefList refs={l.subjects} type="subject" />
                        </span>
                        <span className="min-w-14">
                          <RefList refs={l.teachers} type="teacher" date={data.date} />
                        </span>
                        <span className="text-muted-foreground ml-auto tabular-nums">
                          belegt bis {formatMinutes(item.busyUntilMin ?? l.endMin)}
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}
