import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { buildOfficialPdf } from "@/server/services/documents";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiPermission("attendances.export");
  if (gate.error) return gate.error;
  const { id } = await params;
  const publicList = new URL(request.url).searchParams.get("public") === "1";
  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const attendances = await prisma.attendance.findMany({
    where: { meetingId: id, status: "ACTIVE" },
    orderBy: { checkInAt: "asc" },
  });
  const actor = await prisma.user.findUnique({ where: { id: gate.session.user.id } });
  const { buffer } = await buildOfficialPdf({
    meeting,
    attendances,
    actor,
    publicList,
  });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${meeting.slug}-${publicList ? "publique" : "officielle"}.pdf"`,
    },
  });
}
