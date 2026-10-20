"use client";

import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useMasterData } from "@/hooks/use-untis";
import { ELEMENT_LABELS } from "@/lib/nav";
import type { ElementType, UntisElement } from "@/lib/untis/types";
import { cn } from "@/lib/utils";

const MASTER_KEY = { teacher: "teachers", class: "classes", room: "rooms", subject: "subjects" } as const;

const PLACEHOLDER: Record<ElementType, string> = {
  teacher: "Kürzel oder Name …",
  class: "Klasse …",
  room: "Raum oder Gebäude …",
  subject: "Gegenstand …",
};

/** Autocomplete combobox for teachers, classes or rooms. */
export function ElementPicker({
  type,
  value,
  onSelect,
  autoOpen = false,
  className,
}: {
  type: ElementType;
  value: number | null;
  onSelect: (element: UntisElement) => void;
  autoOpen?: boolean;
  className?: string;
}) {
  const { data, error, isLoading } = useMasterData();
  const [open, setOpen] = useState(autoOpen && !value);
  const items = data?.[MASTER_KEY[type]] ?? [];
  const selected = items.find((e) => e.id === value);
  const label = ELEMENT_LABELS[type];

  if (isLoading && !data) return <Skeleton className={cn("h-10 w-full sm:w-80", className)} />;
  if (error && !data) {
    return (
      <Button variant="outline" disabled className={cn("h-10 w-full justify-start sm:w-80", className)}>
        <Search /> {label.plural} nicht verfügbar
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={`${label.singular} auswählen`}
          className={cn("h-10 w-full justify-between sm:w-80", className)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Search className="text-muted-foreground" />
            {selected ? (
              <>
                <span className="font-semibold">{selected.name}</span>
                {selected.longName && (
                  <span className="text-muted-foreground truncate">{selected.longName}</span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">{label.singular} suchen …</span>
            )}
          </span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const q = search.trim().toLowerCase();
            if (!q) return 1;
            const v = itemValue.toLowerCase();
            const [abbr] = v.split(" ");
            // exact abbreviation first, then prefix, then substring
            if (abbr === q) return 1;
            if (abbr.startsWith(q)) return 0.9;
            if (v.split(/\s+/).some((w) => w.startsWith(q))) return 0.7;
            return v.includes(q) ? 0.4 : 0;
          }}
        >
          <CommandInput placeholder={PLACEHOLDER[type]} />
          <CommandList>
            <CommandEmpty>Keine {label.plural} gefunden.</CommandEmpty>
            <CommandGroup>
              {items.map((el) => (
                <CommandItem
                  key={el.id}
                  value={`${el.name} ${el.longName ?? ""} ${el.building ?? ""} #${el.id}`}
                  onSelect={() => {
                    onSelect(el);
                    setOpen(false);
                  }}
                >
                  <Check className={cn(el.id === value ? "opacity-100" : "opacity-0")} />
                  <span className="w-14 shrink-0 font-semibold">{el.name}</span>
                  <span className="text-muted-foreground truncate">
                    {el.longName}
                    {el.building ? ` · ${el.building}` : ""}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
