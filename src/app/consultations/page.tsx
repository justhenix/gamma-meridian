import Link from "next/link";

import { ConsultationsList } from "@/components/consultations/consultations-list";

export const metadata = {
  title: "My Consultations | Meridian Tax Advisory",
};

export default function ConsultationsPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="font-heading text-2xl font-bold">My Consultations</h1>
            <p className="mt-1 text-sm text-muted-foreground">Continue from the same consultation history shared with Meridian.</p>
          </div>
          <Link href="/" className="text-xs font-semibold text-muted-foreground hover:text-foreground">Back to Meridian</Link>
        </div>
        <ConsultationsList />
      </div>
    </main>
  );
}
