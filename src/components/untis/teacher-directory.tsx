"use client";

import { CircleHelp, Info, SearchX } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { MasterData, UntisElement } from "@/lib/untis/types";
import { EmptyState } from "./empty-state";

const SOURCE_TEXT: Record<MasterData["teacherNames"]["source"], string> = {
  untis: "Namen aus WebUntis",
  directory: "Namen aus dem Lehrerverzeichnis der Schulwebseite zugeordnet",
  none: "Keine Namen verfügbar – TEACHER_DIRECTORY_URL in .env.local setzen",
};

/** Searchable grid of all teachers (abbreviation + name); click selects one. */
export function TeacherDirectory({
  teachers,
  info,
  onSelect,
}: {
  teachers: UntisElement[];
  info: MasterData["teacherNames"];
  onSelect: (teacher: UntisElement) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = teachers.filter((t) => !q || `${t.name} ${t.longName ?? ""}`.toLowerCase().includes(q));

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Lehrerverzeichnis</CardTitle>
          <CardDescription>
            {teachers.length} Lehrkräfte · {SOURCE_TEXT[info.source]}
            {info.source === "directory" && ` (${info.named} von ${teachers.length})`}
          </CardDescription>
        </div>
        <Input
          placeholder="Kürzel oder Name filtern …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:w-64"
        />
      </CardHeader>
      <CardContent className="space-y-4">
        {(info.uncertain > 0 || info.error) && (
          <p className="text-muted-foreground flex items-start gap-2 text-xs">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {info.error && <>{info.error}. </>}
              {info.uncertain > 0 && (
                <>
                  {info.uncertain} Zuordnungen sind unsicher (markiert mit <CircleHelp className="inline size-3" />).
                  Korrekturen in .env.local, z. B.{" "}
                  <code className="bg-muted rounded px-1">UNTIS_TEACHER_NAMES=&quot;EDER=Eder Markus; KAI=Kainz Sarah&quot;</code>
                </>
              )}
            </span>
          </p>
        )}
        {visible.length === 0 ? (
          <EmptyState icon={SearchX} title="Keine Treffer" className="border-none" />
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onSelect(t)}
                  className="hover:bg-muted flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors"
                >
                  <Badge variant="secondary" className="w-14 shrink-0 justify-center font-semibold">
                    {t.name}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {t.longName && t.longName !== t.name ? t.longName : <span className="text-muted-foreground">–</span>}
                  </span>
                  {t.nameUncertain && (
                    <CircleHelp className="text-muted-foreground size-4 shrink-0" aria-label="Zuordnung unsicher" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
