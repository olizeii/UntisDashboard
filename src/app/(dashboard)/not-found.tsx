import { MapPinOff } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/untis/empty-state";

export default function NotFound() {
  return (
    <EmptyState icon={MapPinOff} title="Seite nicht gefunden" description="Diese Seite gibt es nicht." className="mt-10">
      <Button asChild variant="outline">
        <Link href="/">Zum Dashboard</Link>
      </Button>
    </EmptyState>
  );
}
