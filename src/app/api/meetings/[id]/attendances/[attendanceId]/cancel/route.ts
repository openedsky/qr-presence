import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMeetingApi } from "@/lib/meeting-access";
import { cancelAttendanceSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import { scheduleOfficialRefresh } from "@/server/services/documents";
import { lockMeetingContent, MeetingStateChangedError } from "@/server/services/meeting-content";
import { readJsonBody } from "@/lib/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; attendanceId: string }> },
) {
  const { id, attendanceId } = await params;
  const gate = await requireMeetingApi(id, "attendances.manage");
  if (gate.error) return gate.error;
  if (gate.meeting.status === "ARCHIVEE" || gate.meeting.purgedAt) {
    return NextResponse.json({ error: "Réunion archivée : aucune modification possible." }, { status: 409 });
  }
  const parsed = cancelAttendanceSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Motif d'annulation obligatoire (5 caractères minimum)." }, { status: 400 });
  }
  const current = await prisma.attendance.findFirst({ where: { id: attendanceId, meetingId: id } });
  if (!current) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (current.status !== "ACTIVE") {
    return NextResponse.json({ error: "Cette présence est déjà annulée." }, { status: 409 });
  }
  // Conditionnée à ACTIVE : deux annulations simultanées ne produisent qu'une annulation (et un seul journal).
  let closed: boolean;
  try {
    closed = await prisma.$transaction(async (tx) => {
      const locked = await lockMeetingContent(tx, id, () => null);
      const result = await tx.attendance.updateMany({
        where: { id: attendanceId, status: "ACTIVE" },
        data: {
          status: "ANNULEE",
          activeEmailKey: null,
          activePhoneKey: null,
          activeNameKey: null,
          activeUserKey: null,
          cancelledAt: new Date(),
          cancelledById: gate.session.user.id,
          cancelReason: parsed.data.reason,
          updatedById: gate.session.user.id,
        },
      });
      if (result.count === 0) throw new MeetingStateChangedError("Cette présence est déjà annulée.");
      return locked.status === "CLOTUREE";
    });
  } catch (error) {
    if (error instanceof MeetingStateChangedError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
  await writeAudit({
    actorId: gate.session.user.id,
    action: closed ? "attendance.post_close_cancel" : "attendance.cancel",
    entity: "Attendance",
    entityId: attendanceId,
    beforeData: { status: "ACTIVE" },
    afterData: { meetingId: id, status: "ANNULEE", reason: parsed.data.reason },
  });
  if (closed) scheduleOfficialRefresh(id, gate.session.user.id);
  return NextResponse.json({ ok: true });
}
