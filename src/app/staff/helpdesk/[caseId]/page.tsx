import { HelpdeskCaseWorkspace } from "@/components/helpdesk/helpdesk-case-workspace";

export default async function StaffHelpdeskCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return <HelpdeskCaseWorkspace caseId={caseId} />;
}
