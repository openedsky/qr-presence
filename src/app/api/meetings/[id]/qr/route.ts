import { NextResponse } from "next/server";
import { requireMeetingApi } from "@/lib/meeting-access";
import { currentDynamicToken, ensureStaticToken, qrPngDataUrl } from "@/lib/qr";
import { isFrozen } from "@/lib/meeting-status";
import { getSettings } from "@/server/services/settings";

/** QR courant ; `?image=1` ajoute l'image PNG (renouvellement du QR dynamique sans recharger la page). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireMeetingApi(id, "qr");
  if (gate.error) return gate.error;
  const meeting = gate.meeting;
  if (meeting.qrMode === "DYNAMIC" && (isFrozen(meeting.status) || meeting.purgedAt)) {
    return NextResponse.json({ error: "Réunion clôturée : l'émargement est terminé." }, { status: 409 });
  }
  if (meeting.purgedAt) {
    return NextResponse.json({ error: "Données anonymisées : le QR code de cette réunion a été révoqué." }, { status: 409 });
  }
  const settings = await getSettings();
  const payload =
    meeting.qrMode === "DYNAMIC"
      ? await currentDynamicToken(meeting, settings.dynamicQrSeconds)
      : { ...(await ensureStaticToken(meeting)), secondsLeft: null };
  const withImage = new URL(request.url).searchParams.get("image") === "1";
  return NextResponse.json({
    url: payload.url,
    mode: meeting.qrMode,
    secondsLeft: payload.secondsLeft,
    ...(withImage ? { image: await qrPngDataUrl(payload.url) } : {}),
  });
}
