import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { buildExcel } from "@/server/services/documents";

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
  const buffer = await buildExcel(meeting, attendances, gate.session.user.id);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${meeting.slug}.xlsx"`,
    },
  });
}
