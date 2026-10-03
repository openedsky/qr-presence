import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMeetingApi } from "@/lib/meeting-access";
import { isFrozen } from "@/lib/meeting-status";
import { writeAudit } from "@/lib/audit";
import { safeFilename } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { DocumentBusyError, DocumentUnavailableError, generateListDocument, listFilename } from "@/server/services/documents";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await requireMeetingApi(id, "export");
  if (gate.error) return gate.error;
  if (!(await rateLimit(`export:${gate.session.user.id}`, 20, 60)).allowed) {
    return NextResponse.json({ error: "Trop d'exports en peu de temps : réessayez dans une minute." }, { status: 429 });
  }
  const meeting = gate.meeting;
  const publicList = new URL(request.url).searchParams.get("public") === "1";
  if (publicList && !meeting.showPublicAttendance) {
    return NextResponse.json({ error: "La liste publique n'est pas activée pour cette réunion." }, { status: 409 });
  }
  const kind = publicList ? "public" : isFrozen(meeting.status) ? "official" : "provisional";
  const actor = await prisma.user.findUnique({ where: { id: gate.session.user.id } });
  try {
    const { buffer, document, reused } = await generateListDocument({ meeting, actor, kind });
    if (reused) {
      await writeAudit({
        actorId: gate.session.user.id,
        action: "document.download",
        entity: "GeneratedDocument",
        entityId: document.id,
        afterData: { meetingId: meeting.id, kind, version: document.version },
      });
    }
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename(listFilename(meeting, document), "liste.pdf")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof DocumentUnavailableError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof DocumentBusyError) {
      return NextResponse.json({ error: error.message }, { status: 503, headers: { "Retry-After": "5" } });
    }
    throw error;
  }
}
