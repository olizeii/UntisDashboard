"use client";

import { MousePointerClick, UserRoundX } from "lucide-react";
import { useEffectiveMoment, useMomentParams } from "@/hooks/use-moment";
import { useElementStatus, useMasterData } from "@/hooks/use-untis";
import { ELEMENT_LABELS } from "@/lib/nav";
import type { ElementType } from "@/lib/untis/types";
import { DayTimeline, DayTimelineSkeleton } from "./day-timeline";
import { ElementPicker } from "./element-picker";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { LiveStatusCard, LiveStatusSkeleton } from "./live-status-card";
import { MomentControls } from "./moment-controls";

/**
 * Search + live status + day plan for one teacher, class or room.
 * All state lives in the URL (?id=…&date=…&time=…) so views can be shared.
 */
export function ElementExplorer({ type }: { type: ElementType }) {
  const { id, date, time, update } = useMomentParams();
  const moment = useEffectiveMoment(date, time);
  const { data, error, isLoading, mutate } = useElementStatus(type, id, date, time);
  const master = useMasterData();
  const label = ELEMENT_LABELS[type];
  const stale = data && (data.element.id !== id || data.date !== (moment?.date ?? data.date));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <ElementPicker type={type} value={id} onSelect={(el) => update({ id: el.id })} autoOpen />
        <MomentControls moment={moment} time={time} onChange={update} />
      </div>

      {master.error && !master.data ? (
        <ErrorState error={master.error} onRetry={() => master.mutate()} />
      ) : type === "teacher" && master.data?.teachers.length === 0 ? (
        <EmptyState
          icon={UserRoundX}
          title="Keine Lehrkräfte verfügbar"
          description={
            "Dein WebUntis-Account bekommt von Untis keine Lehrer-Daten – weder als Liste noch in den " +
            "Stundenplänen. Das ist eine Einstellung der Schule für diese Benutzergruppe (oft bei Schüler-Accounts). " +
            "Abhilfe: einen Account mit Lehrer-Leserechten verwenden. Details zeigt /api/untis/diagnose (im Dev-Modus)."
          }
        />
      ) : !id ? (
        <EmptyState
          icon={MousePointerClick}
          title={`${label.singular} auswählen`}
          description={
            type === "teacher"
              ? "Kürzel oder Namen eingeben – du siehst sofort Raum, Klasse, Gegenstand und Restzeit."
              : `Wähle oben eine${type === "room" ? "n" : ""} ${label.singular}, um die aktuelle Belegung zu sehen.`
          }
        />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : !data || !moment || (isLoading && stale) ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <LiveStatusSkeleton />
          <DayTimelineSkeleton />
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="space-y-4">
            {error && <ErrorState error={error} onRetry={() => mutate()} compact />}
            <LiveStatusCard status={data} type={type} moment={moment} />
          </div>
          <DayTimeline
            lessons={data.lessons}
            units={data.timegrid}
            type={type}
            date={data.date}
            atMin={moment.live ? moment.atMin : data.atMin}
            highlight={moment.live || !!time}
          />
        </div>
      )}
    </div>
  );
}
