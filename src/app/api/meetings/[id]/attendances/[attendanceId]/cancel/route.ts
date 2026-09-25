import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { cancelAttendanceSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; attendanceId: string }> },
) {
  const gate = await requireApiPermission("attendances.manage");
  if (gate.error) return gate.error;
  const { id, attendanceId } = await params;
  const parsed = cancelAttendanceSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Motif obligatoire" }, { status: 400 });
  }
  await prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      status: "ANNULEE",
      activeEmailKey: null,
      activePhoneKey: null,
      activeNameKey: null,
      activeUserKey: null,
      cancelledAt: new Date(),
      cancelledById: gate.session.user.id,
      cancelReason: parsed.data.reason,
    },
  });
  await writeAudit({
    actorId: gate.session.user.id,
    action: "attendance.cancel",
    entity: "Attendance",
    entityId: attendanceId,
    afterData: { meetingId: id, reason: parsed.data.reason },
  });
  return NextResponse.json({ ok: true });
}
