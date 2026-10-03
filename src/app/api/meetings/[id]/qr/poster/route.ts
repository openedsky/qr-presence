import { NextResponse } from "next/server";
import { requireMeetingApi } from "@/lib/meeting-access";
import { ensureStaticToken } from "@/lib/qr";
import { writeAudit } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { safeFilename } from "@/lib/http";
import { buildQrPoster } from "@/server/services/qr-poster";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireMeetingApi(id, "qr");
  if (gate.error) return gate.error;
  const meeting = gate.meeting;
  if (meeting.qrMode === "DYNAMIC") {
    return NextResponse.json(
      { error: "Le QR dynamique se renouvelle en permanence : il doit être affiché à l'écran, pas imprimé." },
      { status: 409 },
    );
  }
  if (meeting.purgedAt) {
    return NextResponse.json({ error: "Données anonymisées : le QR code de cette réunion a été révoqué." }, { status: 409 });
  }

  const { url } = await ensureStaticToken(meeting);
  const pdf = await buildQrPoster(meeting, url);
  await writeAudit({
    actorId: gate.session.user.id,
    action: "meeting.qr_poster",
    entity: "Meeting",
    entityId: meeting.id,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="qrcode-${safeFilename(slugify(meeting.title) || meeting.internalRef, "reunion")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
