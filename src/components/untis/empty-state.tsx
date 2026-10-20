import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// No "use client": usable from Server Components (icons are passed as components).
export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center",
        className,
      )}
    >
      <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
        <Icon className="size-5" />
      </div>
      <div className="max-w-md space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {children}
    </div>
  );
}
