import {
  CalendarClock,
  DoorOpen,
  LayoutDashboard,
  MapPin,
  UserRoundSearch,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { ElementType } from "@/lib/untis/types";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard, description: "Überblick über den Schultag" },
  { title: "Lehrkräfte", href: "/teachers", icon: UserRoundSearch, description: "Wo ist eine Lehrkraft gerade?" },
  { title: "Klassen", href: "/classes", icon: UsersRound, description: "Wo ist eine Klasse gerade?" },
  { title: "Räume", href: "/rooms", icon: MapPin, description: "Belegung eines Raums" },
  { title: "Freie Räume", href: "/rooms/free", icon: DoorOpen, description: "Aktuell unbesetzte Räume" },
  { title: "Vertretungen", href: "/substitutions", icon: CalendarClock, description: "Entfälle, Vertretungen, Raumänderungen" },
];

const ELEMENT_PATH: Partial<Record<ElementType, string>> = {
  teacher: "/teachers",
  class: "/classes",
  room: "/rooms",
};

export function elementHref(type: ElementType, id: number, extra?: { date?: string; time?: string }) {
  const base = ELEMENT_PATH[type];
  if (!base) return null;
  const params = new URLSearchParams({ id: String(id) });
  if (extra?.date) params.set("date", extra.date);
  if (extra?.time) params.set("time", extra.time);
  return `${base}?${params}`;
}

export const ELEMENT_LABELS: Record<ElementType, { singular: string; plural: string }> = {
  teacher: { singular: "Lehrkraft", plural: "Lehrkräfte" },
  class: { singular: "Klasse", plural: "Klassen" },
  room: { singular: "Raum", plural: "Räume" },
  subject: { singular: "Gegenstand", plural: "Gegenstände" },
};
