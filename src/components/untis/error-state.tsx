"use client";

import {
  CircleAlert,
  KeyRound,
  RefreshCw,
  SearchX,
  ServerCrash,
  Settings2,
  ShieldAlert,
  TimerOff,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import type { UntisErrorKind } from "@/lib/untis/types";
import { cn } from "@/lib/utils";

const KIND_META: Record<UntisErrorKind, { title: string; hint: string; icon: LucideIcon }> = {
  config: {
    title: "WebUntis ist nicht konfiguriert",
    hint: "Prüfe UNTIS_SERVER, UNTIS_SCHOOL und die Zugangsdaten in .env.local und starte den Server neu.",
    icon: Settings2,
  },
  auth: {
    title: "Anmeldung bei WebUntis fehlgeschlagen",
    hint: "Benutzername, Passwort bzw. Secret in .env.local prüfen. Evtl. ist der Account gesperrt.",
    icon: KeyRound,
  },
  permission: {
    title: "Fehlende Berechtigung",
    hint: "Der verwendete WebUntis-Account darf diese Daten nicht abrufen. Ein Account mit mehr Rechten hilft.",
    icon: ShieldAlert,
  },
  network: {
    title: "WebUntis ist nicht erreichbar",
    hint: "Der Untis-Server ist ausgefallen, in Wartung oder die Server-Adresse stimmt nicht.",
    icon: ServerCrash,
  },
  timeout: {
    title: "Zeitüberschreitung",
    hint: "WebUntis antwortet gerade sehr langsam. Bitte gleich nochmal versuchen.",
    icon: TimerOff,
  },
  "not-found": {
    title: "Nicht gefunden",
    hint: "Das gesuchte Element existiert nicht (mehr).",
    icon: SearchX,
  },
  "bad-request": {
    title: "Ungültige Anfrage",
    hint: "Bitte Datum und Uhrzeit prüfen.",
    icon: CircleAlert,
  },
  rpc: {
    title: "WebUntis-Fehler",
    hint: "WebUntis hat einen unerwarteten Fehler gemeldet.",
    icon: CircleAlert,
  },
};

export function ErrorState({
  error,
  onRetry,
  compact = false,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}) {
  const kind: UntisErrorKind = error instanceof ApiError ? error.kind : "rpc";
  const message = error instanceof Error ? error.message : String(error);
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  const retryable = kind === "network" || kind === "timeout" || kind === "rpc";

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center",
        compact ? "p-4" : "p-8 sm:p-10",
        className,
      )}
    >
      <div className="bg-destructive/10 text-destructive flex size-10 items-center justify-center rounded-full">
        <Icon className="size-5" />
      </div>
      <div className="max-w-md space-y-1">
        <p className="font-medium">{meta.title}</p>
        <p className="text-muted-foreground text-sm">{message}</p>
        {!compact && <p className="text-muted-foreground text-xs">{meta.hint}</p>}
      </div>
      {onRetry && (retryable || !compact) && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw /> Erneut versuchen
        </Button>
      )}
    </div>
  );
}
