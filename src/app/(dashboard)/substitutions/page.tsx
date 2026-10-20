import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { SubstitutionPlan } from "@/components/untis/substitution-plan";

export const metadata: Metadata = { title: "Vertretungen" };

export default function SubstitutionsPage() {
  return (
    <>
      <PageHeader
        title="Vertretungsplan"
        description="Entfälle, Vertretungen und Raumänderungen für den Tag oder die ganze Woche."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <SubstitutionPlan />
      </Suspense>
    </>
  );
}
