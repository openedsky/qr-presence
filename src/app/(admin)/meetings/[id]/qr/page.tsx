import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { requireMeetingPage } from "@/lib/meeting-access";
import { currentDynamicToken, ensureStaticToken, qrPngDataUrl } from "@/lib/qr";
import { getSettings } from "@/server/services/settings";
import { getTemplate } from "@/server/services/pdf-templates";
import { formatDateTime } from "@/lib/utils";
import { QrMark } from "@/components/logo";
import { QrWithLogo } from "@/components/qr-with-logo";
import { getQrLogo } from "@/server/services/branding";
import { isFrozen } from "@/lib/meeting-status";
import { DynamicQr, DynamicQrStatus } from "./qr-refresh";
import { QrTools } from "./qr-tools";

export default async function QrDisplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { meeting } = await requireMeetingPage(id, "qr");
  const [settings, template] = await Promise.all([getSettings(), getTemplate("QR_POSTER")]);
  const ttl = settings.dynamicQrSeconds;
  const dynamic = meeting.qrMode === "DYNAMIC";
  if (meeting.purgedAt || (dynamic && isFrozen(meeting.status))) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href={`/meetings/${meeting.id}?tab=qr`} className="inline-flex items-center gap-2 text-sm font-semibold text-forest">
          <ArrowLeft className="h-4 w-4" /> Retour à la réunion
        </Link>
        <div className="card mt-6 p-8 text-center text-muted">
          {meeting.purgedAt
            ? "Données anonymisées : le QR code de cette réunion a été révoqué."
            : "Réunion clôturée : l'émargement est terminé, aucun QR n'est émis."}
        </div>
      </div>
    );
  }
  const dynamicToken = dynamic ? await currentDynamicToken(meeting, ttl) : null;
  const payload = dynamicToken ?? (await ensureStaticToken(meeting));
  const [image, logo] = await Promise.all([qrPngDataUrl(payload.url), getQrLogo()]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href={`/meetings/${meeting.id}?tab=qr`} className="inline-flex items-center gap-2 text-sm font-semibold text-forest">
          <ArrowLeft className="h-4 w-4" /> Retour à la réunion
        </Link>
        <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-forest">
          {dynamic ? `QR dynamique · ${ttl}s` : "QR statique · imprimable"}
        </span>
      </div>

      <div className="print-sheet card overflow-hidden p-0">
        <div className="flex items-center justify-between gap-4 bg-white px-8 pb-5 pt-6">
          <div className="flex items-center gap-4">
            <QrMark className="h-14 w-14" />
            <div>
              <p className="font-display text-2xl font-semibold uppercase text-forest-deep">{settings.organizationName}</p>
              {template.subtitle ? <p className="text-xs text-muted">{template.subtitle}</p> : null}
            </div>
          </div>
          <div className="max-w-[16rem] text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: template.accentColor }}>
              {settings.ministryName}
            </p>
            {template.headerNote ? <p className="mt-1 text-xs text-muted">{template.headerNote}</p> : null}
          </div>
        </div>
        <div className="mx-8 border-t-2" style={{ borderColor: template.accentColor }} />

        <div className="bg-white px-8 py-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: template.accentColor }}>
            {template.title}
          </p>
          <h1 className="mx-auto mt-3 max-w-2xl font-display text-xl font-semibold uppercase leading-snug sm:text-2xl text-forest-deep">
            {meeting.title}
          </h1>
          <div className="mx-auto mt-6 grid max-w-xl gap-3 rounded-2xl bg-mint p-4 text-sm sm:grid-cols-2">
            <p className="flex items-center justify-center gap-2 font-semibold">
              <MapPin className="h-4 w-4 text-leaf" /> {meeting.location || "Réunion à distance"}
            </p>
            <p className="flex items-center justify-center gap-2 font-semibold">
              <CalendarDays className="h-4 w-4 text-leaf" /> {formatDateTime(meeting.startsAt)}
            </p>
          </div>

          <div className="relative mx-auto mt-10 w-fit rounded-[28px] border-[3px] bg-white p-5" style={{ borderColor: template.accentColor }}>
            <span className="absolute -left-3 -top-3 h-10 w-10 rounded-tl-2xl border-l-[6px] border-t-[6px] border-gold" />
            <span className="absolute -right-3 -top-3 h-10 w-10 rounded-tr-2xl border-r-[6px] border-t-[6px] border-gold" />
            <span className="absolute -bottom-3 -left-3 h-10 w-10 rounded-bl-2xl border-b-[6px] border-l-[6px] border-gold" />
            <span className="absolute -bottom-3 -right-3 h-10 w-10 rounded-br-2xl border-b-[6px] border-r-[6px] border-gold" />
            {dynamicToken ? (
              <DynamicQr
                meetingId={meeting.id}
                initial={{ image, secondsLeft: dynamicToken.secondsLeft }}
                logo={logo ? { dataUrl: logo.url, width: logo.width, height: logo.height } : null}
                className="h-58 w-58 sm:h-64 sm:w-64 print:h-45 print:w-45"
              />
            ) : (
              <QrWithLogo
                src={image}
                logo={logo ? { dataUrl: logo.url, width: logo.width, height: logo.height } : null}
                className="h-58 w-58 sm:h-64 sm:w-64 print:h-45 print:w-45" />
            )}
          </div>

          <p
            className="mx-auto mt-8 w-fit rounded-full px-8 py-3 text-lg font-bold uppercase tracking-wide text-white"
            style={{ background: template.accentColor }}
          >
            {template.ctaText}
          </p>
          {dynamicToken ? <DynamicQrStatus ttl={ttl} /> : null}
          {template.showUrl && !dynamic ? <p className="mt-4 break-all text-xs text-muted">{payload.url}</p> : null}
        </div>
      </div>

      <div className="mt-6">
        <QrTools meetingId={meeting.id} url={payload.url} printable={!dynamic} />
      </div>
    </div>
  );
}
