import {
  ArrowRightLeft,
  Ban,
  CalendarPlus,
  ClipboardCheck,
  Lock,
  MoveRight,
  Repeat,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { elementHref } from "@/lib/nav";
import type { ElementRef, ElementType, Lesson, SubstitutionType } from "@/lib/untis/types";
import { cn } from "@/lib/utils";

type Tone = "critical" | "warning" | "info" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  critical: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  info: "border-sky-500/25 bg-sky-500/10 text-sky-800 dark:text-sky-300",
  neutral: "border-border bg-muted text-muted-foreground",
};

export const SUBST_META: Record<SubstitutionType, { label: string; plural: string; icon: LucideIcon; tone: Tone }> = {
  cancel: { label: "Entfall", plural: "Entfälle", icon: Ban, tone: "critical" },
  subst: { label: "Vertretung", plural: "Vertretungen", icon: Repeat, tone: "warning" },
  add: { label: "Zusatzstunde", plural: "Zusatzstunden", icon: CalendarPlus, tone: "info" },
  shift: { label: "Verlegung", plural: "Verlegungen", icon: MoveRight, tone: "info" },
  rmchg: { label: "Raumänderung", plural: "Raumänderungen", icon: ArrowRightLeft, tone: "info" },
  rmlk: { label: "Raumsperre", plural: "Raumsperren", icon: Lock, tone: "neutral" },
  bs: { label: "Pausenaufsicht", plural: "Pausenaufsichten", icon: ShieldCheck, tone: "neutral" },
  free: { label: "Freisetzung", plural: "Freisetzungen", icon: Sparkles, tone: "neutral" },
  exam: { label: "Prüfung", plural: "Prüfungen", icon: ClipboardCheck, tone: "warning" },
  other: { label: "Änderung", plural: "Änderungen", icon: Sparkles, tone: "neutral" },
};

export function ToneBadge({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: Tone;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(TONE_CLASS[tone], className)}>
      {Icon && <Icon data-icon="inline-start" />}
      {children}
    </Badge>
  );
}

export function SubstitutionBadge({ type, className }: { type: SubstitutionType; className?: string }) {
  const meta = SUBST_META[type];
  return (
    <ToneBadge tone={meta.tone} icon={meta.icon} className={className}>
      {meta.label}
    </ToneBadge>
  );
}

/** All change badges that apply to a lesson. */
export function LessonBadges({ lesson }: { lesson: Lesson }) {
  const types: SubstitutionType[] = [];
  if (lesson.status === "cancelled") types.push("cancel");
  else {
    if (lesson.teacherChanged) types.push("subst");
    if (lesson.roomChanged) types.push("rmchg");
    if (lesson.lessonType === "ex") types.push("exam");
    if (lesson.status === "irregular" && types.length === 0) types.push("other");
  }
  if (types.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {types.map((t) => (
        <SubstitutionBadge key={t} type={t} />
      ))}
    </span>
  );
}

/**
 * Renders a list of element references, linked to their detail page.
 * Changed elements show the original one struck through.
 */
export function RefList({
  refs,
  type,
  long = false,
  date,
  className,
}: {
  refs: ElementRef[];
  type: ElementType;
  long?: boolean;
  date?: string;
  className?: string;
}) {
  if (refs.length === 0) return <span className="text-muted-foreground">–</span>;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5", className)}>
      {refs.map((r, i) => {
        const href = elementHref(type, r.id, { date });
        const label = long && r.longName ? r.longName : r.name;
        return (
          <span key={`${r.id}-${i}`} className="inline-flex items-baseline gap-1">
            {r.original && (
              <s className="text-muted-foreground decoration-muted-foreground/60 font-normal">
                {r.original.name}
              </s>
            )}
            {href ? (
              <Link href={href} className="underline-offset-4 hover:underline" title={r.longName}>
                {label}
              </Link>
            ) : (
              <span title={r.longName}>{label}</span>
            )}
            {i < refs.length - 1 && <span className="text-muted-foreground">,</span>}
          </span>
        );
      })}
    </span>
  );
}
