import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guards";
import { notFound } from "next/navigation";
import { MeetingForm } from "../../meeting-form";

export default async function EditMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting) notFound();

  return (
    <div>
      <PageHeader title="Modifier la réunion" subtitle={meeting.internalRef} />
      <MeetingForm
        actionUrl={`/api/meetings/${meeting.id}`}
        method="PATCH"
        initial={{
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
