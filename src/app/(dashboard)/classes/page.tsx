import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ElementExplorer } from "@/components/untis/element-explorer";
import { ExplorerSkeleton } from "@/components/untis/explorer-skeleton";

export const metadata: Metadata = { title: "Klassen" };

export default function ClassesPage() {
  return (
    <>
      <PageHeader
        title="Klassen-Suche"
        description="Wo ist eine Klasse gerade, bei wem und in welchem Gegenstand?"
      />
      <Suspense fallback={<ExplorerSkeleton />}>
        <ElementExplorer type="class" />
      </Suspense>
    </>
  );
}
