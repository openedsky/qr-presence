import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { buildCsv } from "@/server/services/documents";
import { writeAudit } from "@/lib/audit";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireApiPermission("attendances.export");
  if (gate.error) return gate.error;
  const { id } = await params;
  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
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
      "Content-Disposition": `attachment; filename="${meeting.slug}.csv"`,
    },
  });
}
