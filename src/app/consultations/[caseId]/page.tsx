import { ConsultationThread } from "@/components/consultations/consultation-thread";

export default async function ConsultationPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="mx-auto max-w-3xl">
        <ConsultationThread caseId={caseId} />
      </div>
    </main>
  );
}
