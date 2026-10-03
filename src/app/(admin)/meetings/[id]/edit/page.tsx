import { PageHeader } from "@/components/ui";
import { requireMeetingPage } from "@/lib/meeting-access";
import { isFrozen } from "@/lib/meeting-status";
import { redirect } from "next/navigation";
import { meetingTypeChoices } from "@/server/services/meeting-types";
import { secretaryOptions } from "@/server/services/meeting-input";
import { MeetingForm } from "../../meeting-form";

export default async function EditMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { meeting } = await requireMeetingPage(id, "manage");
  if (isFrozen(meeting.status)) redirect(`/meetings/${meeting.id}`);
  const [types, secretaries] = await Promise.all([meetingTypeChoices(meeting.type), secretaryOptions()]);

  return (
    <div>
      <PageHeader title="Modifier la réunion" subtitle={meeting.internalRef} />
      <MeetingForm
        actionUrl={`/api/meetings/${meeting.id}`}
        method="PATCH"
        types={types}
        secretaries={secretaries}
        initial={{
          secretaryId: meeting.secretaryId ?? "",
          title: meeting.title,
          internalRef: meeting.internalRef,
          description: meeting.description ?? "",
          type: meeting.type,
          location: meeting.location ?? "",
          videoConferenceUrl: meeting.videoConferenceUrl ?? "",
          startsAt: meeting.startsAt.toISOString(),
          endsAt: meeting.endsAt?.toISOString(),
          registrationOpensAt: meeting.registrationOpensAt?.toISOString(),
          registrationClosesAt: meeting.registrationClosesAt?.toISOString(),
          toleranceMinutes: meeting.toleranceMinutes,
          qrMode: meeting.qrMode,
          qrSecurityLevel: meeting.qrSecurityLevel,
          allowGuests: meeting.allowGuests,
          showPublicAttendance: meeting.showPublicAttendance,
          expectedParticipants: meeting.expectedParticipants ?? undefined,
          signatureRequired: meeting.signatureRequired,
          emailRequired: meeting.emailRequired,
          internalNotes: meeting.internalNotes ?? "",
        }}
      />
    </div>
  );
}
