"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { parseTime } from "@/lib/time";
import type { PeriodUtilization } from "@/lib/untis/types";
import { cn } from "@/lib/utils";

const GRID = [0, 50, 100];
const PLOT_HEIGHT = 160;

/**
 * Room utilization per period. Single series: one hue, no legend, recessive
 * gridlines, ≤ 24px columns with a 4px rounded cap, per-column tooltip and an
 * equivalent screen-reader table.
 */
export function UtilizationChart({
  data,
  atMin,
  live,
}: {
  data: PeriodUtilization[];
  atMin: number;
  live: boolean;
}) {
  const pct = (p: PeriodUtilization) => (p.totalRooms ? Math.round((p.occupiedRooms / p.totalRooms) * 100) : 0);
  const currentIdx = data.findIndex((p) => parseTime(p.start) <= atMin && atMin < parseTime(p.end));
  const peak = data.reduce((best, p, i) => (pct(p) > pct(data[best]) ? i : best), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Raumauslastung pro Stunde</CardTitle>
        <CardDescription>Anteil belegter Räume je Unterrichtseinheit</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">Heute kein Unterricht.</p>
        ) : (
          <>
            <div className="flex gap-2">
              {/* y-axis */}
              <div className="text-muted-foreground relative w-9 shrink-0 text-right text-[11px] tabular-nums" style={{ height: PLOT_HEIGHT }} aria-hidden>
                {GRID.map((g) => (
                  <span key={g} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${g}%` }}>
                    {g} %
                  </span>
                ))}
              </div>
              <div className="relative min-w-0 flex-1">
                {/* gridlines */}
                <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: PLOT_HEIGHT }} aria-hidden>
                  {GRID.map((g) => (
                    <div key={g} className="border-border absolute inset-x-0 border-t" style={{ bottom: `${g}%` }} />
                  ))}
                </div>
                <div className="relative flex items-end gap-0.5" style={{ height: PLOT_HEIGHT }} aria-hidden>
                  {data.map((p, i) => {
                    const v = pct(p);
                    const isNow = live && i === currentIdx;
                    return (
                      <Tooltip key={p.name}>
                        <TooltipTrigger asChild>
                          <div className="group flex h-full flex-1 cursor-default flex-col items-center justify-end">
                            {(isNow || i === peak) && (
                              <span className="text-foreground mb-1 text-[11px] font-medium tabular-nums">{v} %</span>
                            )}
                            <div
                              className={cn(
                                "bg-bar w-full max-w-6 rounded-t-[4px] transition-opacity group-hover:opacity-80",
                                live && parseTime(p.end) <= atMin && "opacity-45",
                              )}
                              style={{ height: `${Math.max(v, 1)}%` }}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">
                            {p.name}. Stunde · {p.start}–{p.end}
                          </p>
                          <p>
                            {p.occupiedRooms} von {p.totalRooms} Räumen belegt ({v} %)
                          </p>
                          <p>{p.lessons} Unterrichtseinheiten</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                {/* x-axis */}
                <div className="mt-1.5 flex gap-0.5" aria-hidden>
                  {data.map((p, i) => (
                    <div key={p.name} className="text-muted-foreground flex-1 text-center text-[11px] tabular-nums">
                      <span className={cn(live && i === currentIdx && "text-foreground font-semibold")}>{p.name}.</span>
                      {live && i === currentIdx && <span className="text-live block font-medium">jetzt</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <table className="sr-only">
              <caption>Raumauslastung pro Stunde</caption>
              <thead>
                <tr>
                  <th>Stunde</th>
                  <th>Zeit</th>
                  <th>Belegte Räume</th>
                  <th>Auslastung</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>
                      {p.start}–{p.end}
                    </td>
                    <td>
                      {p.occupiedRooms} / {p.totalRooms}
                    </td>
                    <td>{pct(p)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
