"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NAV_ITEMS } from "@/lib/nav";
import { ConnectionBadge } from "./connection-badge";
import { GlobalSearch } from "./global-search";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  const pathname = usePathname();
  const current =
    NAV_ITEMS.find((i) => i.href === pathname) ??
    NAV_ITEMS.filter((i) => i.href !== "/" && pathname.startsWith(i.href)).at(-1);

  return (
    <header className="bg-background/80 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      <h1 className="hidden truncate text-sm font-medium md:block">{current?.title ?? "Untis Dashboard"}</h1>
      <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
        <div className="min-w-0 flex-1 sm:flex-none">
          <GlobalSearch />
        </div>
        <ConnectionBadge className="hidden sm:inline-flex" />
        <ThemeToggle />
      </div>
    </header>
  );
}
