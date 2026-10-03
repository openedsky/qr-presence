import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireMeetingPage } from "@/lib/meeting-access";
import { toDateTimeLocal } from "@/lib/utils";
import { ManualAttendanceForm } from "./manual-form";

export default async function ManualAttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { meeting } = await requireMeetingPage(id, "attendances.manage");
  if (meeting.status === "ARCHIVEE" || meeting.status === "BROUILLON" || meeting.status === "PLANIFIEE") {
    redirect(`/meetings/${meeting.id}?tab=participants`);
  }
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Ajout manuel" subtitle={`${meeting.title} · participant sans smartphone ou hors connexion`} />
      <ManualAttendanceForm
        meetingId={meeting.id}
        closed={meeting.status === "CLOTUREE"}
        emailRequired={meeting.emailRequired}
        internalOnly={!meeting.allowGuests}
        defaultCheckIn={toDateTimeLocal(new Date())}
        earliestCheckIn={toDateTimeLocal(new Date(meeting.startsAt.getTime() - 24 * 3600_000))}
      />
    </div>
  );
}
