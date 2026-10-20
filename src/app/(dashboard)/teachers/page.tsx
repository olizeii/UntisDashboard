import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ElementExplorer } from "@/components/untis/element-explorer";
import { ExplorerSkeleton } from "@/components/untis/explorer-skeleton";

export const metadata: Metadata = { title: "Lehrkräfte" };

export default function TeachersPage() {
  return (
    <>
      <PageHeader
        title="Lehrer-Suche"
        description="Wo ist eine Lehrkraft gerade – oder zu einem bestimmten Zeitpunkt? Raum, Klasse, Gegenstand und Restzeit."
      />
      <Suspense fallback={<ExplorerSkeleton />}>
        <ElementExplorer type="teacher" />
      </Suspense>
    </>
  );
}
