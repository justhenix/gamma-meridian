import { HelpdeskInbox } from "@/components/helpdesk/helpdesk-inbox";
import { StaffNavbar } from "@/components/helpdesk/staff-navbar";

export const metadata = {
  title: "Staff Helpdesk & Case Inbox | Meridian Tax Advisory",
  description: "Internal case assessment and unified consultation workspace for Meridian partners and consultants.",
};

export default function StaffHelpdeskPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <StaffNavbar />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="border-b border-border pb-4">
          <h1 className="font-heading font-bold text-xl sm:text-2xl text-foreground">Client Enquiries & Consultation Inbox</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Review escalated consultations and continue the client’s existing conversation.</p>
        </div>
        <HelpdeskInbox />
      </main>
    </div>
  );
}
