import { redirect } from "next/navigation";

export default async function LegacyHelpdeskCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/staff/helpdesk/${id}`);
}
