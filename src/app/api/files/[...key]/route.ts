import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMeetingApi } from "@/lib/meeting-access";
import { getObjectBuffer } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";

/** Seuls les objets rattachés à une réunion (signature ou document) sont servis, selon les droits sur cette réunion. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  let objectKey: string;
  try {
    objectKey = key.map((part) => decodeURIComponent(part)).join("/");
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }

  const [attendance, document] = await Promise.all([
    prisma.attendance.findFirst({ where: { signatureObjectKey: objectKey }, select: { meetingId: true, signatureMime: true } }),
    prisma.generatedDocument.findFirst({ where: { objectKey }, select: { id: true, meetingId: true } }),
  ]);
  const meetingId = attendance?.meetingId ?? document?.meetingId;
  if (!meetingId) return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });

  const gate = await requireMeetingApi(meetingId, document ? "documents" : "read");
  if (gate.error) return gate.error;

  const buffer = await getObjectBuffer(objectKey);
  if (!buffer) return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  // Les signatures s'affichent en vignettes dans les écrans : seuls les documents sont journalisés.
  if (document) {
    await writeAudit({
      actorId: gate.session.user.id,
      action: "file.download",
      entity: "GeneratedDocument",
      entityId: document.id,
      meetingId,
    }).catch(() => undefined);
  }
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": document ? "application/pdf" : attendance?.signatureMime || "image/png",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
