import { DoorOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ElementExplorer } from "@/components/untis/element-explorer";
import { ExplorerSkeleton } from "@/components/untis/explorer-skeleton";

export const metadata: Metadata = { title: "Räume" };

export default function RoomsPage() {
  return (
    <>
      <PageHeader title="Raum-Suche" description="Wer ist gerade in welchem Raum – und wann wird er frei?">
        <Button variant="outline" asChild>
          <Link href="/rooms/free">
            <DoorOpen /> Freie Räume anzeigen
          </Link>
        </Button>
      </PageHeader>
      <Suspense fallback={<ExplorerSkeleton />}>
        <ElementExplorer type="room" />
      </Suspense>
    </>
  );
}
