import { ArrowRightLeft, Ban, DoorClosed, Repeat, UserRoundCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardStats } from "@/lib/untis/types";

function Tile({
  label,
  value,
  total,
  sub,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  total?: number;
  sub?: string;
  icon: LucideIcon;
  href?: string;
}) {
  const pct = total ? Math.round((value / total) * 100) : null;
  const body = (
    <Card className="hover:bg-muted/40 h-full gap-0 py-4 transition-colors">
      <CardContent className="space-y-2 px-4">
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>{label}</span>
          <Icon className="size-4" />
        </div>
        <p className="text-3xl font-semibold tracking-tight tabular-nums">
          {value}
          {total !== undefined && <span className="text-muted-foreground text-base font-normal"> / {total}</span>}
        </p>
        {pct !== null ? (
          <div className="space-y-1">
            <div className="bg-bar-muted h-1.5 overflow-hidden rounded-full" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
              <div className="bg-bar h-full rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-muted-foreground text-xs">{pct} % {sub}</p>
          </div>
        ) : (
          sub && <p className="text-muted-foreground text-xs">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

export function KpiTiles({ stats }: { stats: DashboardStats }) {
  const nowLabel = stats.live ? "gerade" : "zum Zeitpunkt";
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Tile label="Vertretungen" value={stats.substitutions} sub={`von ${stats.lessonsToday} Stunden heute`} icon={Repeat} href="/substitutions" />
      <Tile label="Entfälle" value={stats.cancellations} sub="Stunden entfallen" icon={Ban} href="/substitutions" />
      <Tile label="Raumänderungen" value={stats.roomChanges} sub={stats.additional ? `+ ${stats.additional} sonstige Änderungen` : "heute"} icon={ArrowRightLeft} href="/substitutions" />
      <Tile label="Räume belegt" value={stats.roomsOccupiedNow} total={stats.roomsTotal} sub={`Auslastung ${nowLabel}`} icon={DoorClosed} href="/rooms/free" />
      <Tile label="Lehrkräfte im Unterricht" value={stats.teachersInLessonNow} total={stats.teachersTotal} sub={nowLabel} icon={UserRoundCheck} href="/teachers" />
    </div>
  );
}

export function KpiTilesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-[7.5rem] rounded-xl" />
      ))}
    </div>
  );
}
