import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMeetingApi } from "@/lib/meeting-access";
import { buildExcel } from "@/server/services/documents";
import { ATTENDANCE_ORDER } from "@/server/services/attendances";
import { safeFilename } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireMeetingApi(id, "export");
  if (gate.error) return gate.error;
  if (!(await rateLimit(`export:${gate.session.user.id}`, 20, 60)).allowed) {
    return NextResponse.json({ error: "Trop d'exports en peu de temps : réessayez dans une minute." }, { status: 429 });
  }
  const meeting = gate.meeting;
  const attendances = await prisma.attendance.findMany({
    where: { meetingId: id },
    orderBy: ATTENDANCE_ORDER,
  });
  const buffer = await buildExcel(meeting, attendances, gate.session.user.id);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeFilename(meeting.slug, "presences")}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
