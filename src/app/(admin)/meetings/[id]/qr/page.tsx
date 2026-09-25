import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guards";
import { currentDynamicToken, ensureStaticToken, qrPngDataUrl } from "@/lib/qr";
import { getSettings } from "@/server/services/settings";
import { formatDateTime } from "@/lib/utils";
import { notFound } from "next/navigation";
import { QrRefresh } from "./qr-refresh";

export default async function QrDisplayPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting) notFound();
  const settings = await getSettings();
  const ttl = settings.dynamicQrSeconds;
  const payload =
    meeting.qrMode === "DYNAMIC"
      ? await currentDynamicToken(meeting, ttl)
      : await ensureStaticToken(meeting);
  const image = await qrPngDataUrl(payload.url);

  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-leaf">{settings.ministryName}</p>
      <h1 className="mt-2 font-display text-4xl text-forest-deep">{meeting.title}</h1>
      <p className="mt-2 text-muted">
        {formatDateTime(meeting.startsAt)} · {meeting.location || "Réunion distante"}
      </p>
      <div className="card mx-auto mt-8 max-w-md p-6">
        <img src={image} alt="QR Code de présence" className="mx-auto w-72" />
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-forest">
          Scannez le QR code pour vous inscrire
        </p>
        {meeting.qrMode === "DYNAMIC" ? <QrRefresh meetingId={meeting.id} seconds={ttl} /> : null}
      </div>
    </div>
  );
}
