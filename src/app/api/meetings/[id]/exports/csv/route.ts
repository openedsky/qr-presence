import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMeetingApi } from "@/lib/meeting-access";
import { buildCsv } from "@/server/services/documents";
import { writeAudit } from "@/lib/audit";
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
    orderBy: { checkInAt: "asc" },
  });
  await writeAudit({
    actorId: gate.session.user.id,
    action: "export.csv",
    entity: "Meeting",
    entityId: id,
  });
  return new NextResponse(buildCsv(attendances), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilename(meeting.slug, "presences")}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
