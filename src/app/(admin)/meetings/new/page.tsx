import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/guards";
import { MeetingForm } from "../meeting-form";

export default async function NewMeetingPage() {
  await requirePermission("meetings.create");
  return (
    <div>
      <PageHeader title="Créer une réunion" subtitle="Brouillon jusqu'à l'ouverture des inscriptions." />
      <MeetingForm actionUrl="/api/meetings" />
    </div>
  );
}
