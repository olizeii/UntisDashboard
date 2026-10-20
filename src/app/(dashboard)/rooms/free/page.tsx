import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { FreeRooms } from "@/components/untis/free-rooms";

export const metadata: Metadata = { title: "Freie Räume" };

export default function FreeRoomsPage() {
  return (
    <>
      <PageHeader
        title="Raumfinder"
        description="Welche Räume sind jetzt (oder zu einem gewählten Zeitpunkt) frei – und wie lange noch?"
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <FreeRooms />
      </Suspense>
    </>
  );
}
