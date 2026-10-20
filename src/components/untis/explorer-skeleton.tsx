import { Skeleton } from "@/components/ui/skeleton";
import { DayTimelineSkeleton } from "./day-timeline";
import { LiveStatusSkeleton } from "./live-status-card";

export function ExplorerSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
        <Skeleton className="h-10 w-full sm:w-80" />
        <Skeleton className="h-8 w-full sm:w-[28rem]" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <LiveStatusSkeleton />
        <DayTimelineSkeleton />
      </div>
    </div>
  );
}
