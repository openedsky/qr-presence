import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guards";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { AttendanceEditor } from "./editor";

export default async function AttendanceEditPage({
  params,
}: {
  params: Promise<{ id: string; attendanceId: string }>;
}) {
  await requireSession();
  const { id, attendanceId } = await params;
  const attendance = await prisma.attendance.findFirst({
    where: { id: attendanceId, meetingId: id },
    include: { changes: { orderBy: { createdAt: "desc" } } },
  });
  if (!attendance) notFound();

  return (
    <div>
      <PageHeader
        title={`${attendance.lastName} ${attendance.firstNames}`}
        subtitle={`Confirmation ${attendance.confirmationCode} · ${formatDateTime(attendance.checkInAt)}`}
      />
      <AttendanceEditor meetingId={id} attendance={attendance} />
      <Card className="mt-6">
        <h2 className="font-display text-xl">Historique des corrections</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {attendance.changes.map((change) => (
            <li key={change.id} className="rounded-xl bg-sand p-3">
              <p className="font-semibold">Champ « {change.field} »</p>
              <p className="text-muted">Ancienne valeur : {change.oldValue || "—"}</p>
              <p className="text-muted">Nouvelle valeur : {change.newValue || "—"}</p>
              <p className="text-xs text-muted">{formatDateTime(change.createdAt)}</p>
            </li>
          ))}
          {attendance.changes.length === 0 ? <p className="text-sm text-muted">Aucune correction.</p> : null}
        </ul>
      </Card>
    </div>
  );
}
