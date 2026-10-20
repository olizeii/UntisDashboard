"use client";

import { MapPin, Search, UserRound, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useMasterData } from "@/hooks/use-untis";
import { NAV_ITEMS, elementHref } from "@/lib/nav";

const GROUPS = [
  { key: "teachers", label: "Lehrkräfte", icon: UserRound },
  { key: "classes", label: "Klassen", icon: UsersRound },
  { key: "rooms", label: "Räume", icon: MapPin },
] as const;

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data } = useMasterData();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string | null) => {
    setOpen(false);
    if (href) router.push(href);
  };

  return (
    <>
      <Button
        variant="outline"
        className="text-muted-foreground h-8 w-full justify-start gap-2 sm:w-64"
        onClick={() => setOpen(true)}
      >
        <Search />
        <span className="truncate">Suchen …</span>
        <kbd className="bg-muted pointer-events-none ml-auto hidden rounded border px-1.5 font-mono text-[10px] sm:inline-block">
          Strg K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Suche"
        description="Lehrkräfte, Klassen und Räume durchsuchen"
      >
        <CommandInput placeholder="Lehrer-Kürzel, Name, Klasse oder Raum …" />
        <CommandList>
          <CommandEmpty>Keine Treffer.</CommandEmpty>
          {data &&
            GROUPS.map(({ key, label, icon: Icon }) => (
              <CommandGroup key={key} heading={label}>
                {data[key].map((el) => (
                  <CommandItem
                    key={`${el.type}-${el.id}`}
                    value={`${el.type}-${el.id} ${el.name} ${el.longName ?? ""}`}
                    onSelect={() => go(elementHref(el.type, el.id))}
                  >
                    <Icon />
                    <span className="font-medium">{el.name}</span>
                    {el.longName && <span className="text-muted-foreground truncate">{el.longName}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          <CommandSeparator />
          <CommandGroup heading="Seiten">
            {NAV_ITEMS.map((item) => (
              <CommandItem key={item.href} value={`seite ${item.title}`} onSelect={() => go(item.href)}>
                <item.icon />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
