"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/untis/error-state";

export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState error={error} onRetry={retry} className="mt-10" />;
}
