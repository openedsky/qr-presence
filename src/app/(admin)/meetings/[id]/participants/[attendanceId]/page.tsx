import { prisma } from "@/lib/prisma";
import { requireMeetingPage } from "@/lib/meeting-access";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { AttendanceEditor } from "./editor";

export default async function AttendanceEditPage({
  params,
}: {
  params: Promise<{ id: string; attendanceId: string }>;
}) {
  const { id, attendanceId } = await params;
  const { meeting } = await requireMeetingPage(id, "attendances.manage");
  // Seuls les champs affichés : l'empreinte d'IP, le navigateur ou la clé de signature n'ont rien à faire côté client.
  const attendance = await prisma.attendance.findFirst({
    where: { id: attendanceId, meetingId: id },
    select: {
      id: true,
      lastName: true,
      firstNames: true,
      jobTitle: true,
      organization: true,
      email: true,
      phone: true,
      status: true,
      signatureObjectKey: true,
      suspectedDuplicate: true,
      confirmationCode: true,
      checkInAt: true,
      changes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!attendance) notFound();
  const { signatureObjectKey, changes, confirmationCode, checkInAt, ...editable } = attendance;

  return (
    <div>
      <PageHeader
        title={`${attendance.lastName} ${attendance.firstNames}`}
        subtitle={`Confirmation ${confirmationCode} · ${formatDateTime(checkInAt)}`}
      />
      <AttendanceEditor
        meetingId={id}
        meetingStatus={meeting.status}
        emailRequired={meeting.emailRequired}
        attendance={{ ...editable, hasSignature: Boolean(signatureObjectKey) }}
      />
      <Card className="mt-6">
        <h2 className="font-display text-xl">Historique des corrections</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {changes.map((change) => (
            <li key={change.id} className="rounded-xl bg-sand p-3">
              <p className="font-semibold">Champ « {change.field} »</p>
              <p className="text-muted">Ancienne valeur : {change.oldValue || "—"}</p>
              <p className="text-muted">Nouvelle valeur : {change.newValue || "—"}</p>
              <p className="text-xs text-muted">{formatDateTime(change.createdAt)}</p>
            </li>
          ))}
          {changes.length === 0 ? <p className="text-sm text-muted">Aucune correction.</p> : null}
        </ul>
      </Card>
    </div>
  );
}
