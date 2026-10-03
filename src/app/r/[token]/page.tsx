import { resolveToken } from "@/lib/qr";
import { prisma } from "@/lib/prisma";
import { registrationWindow, selfRegistrationState } from "@/lib/meeting-status";
import { headers } from "next/headers";
import { issueCheckinSession, verifyCheckinSession } from "@/lib/checkin-session";
import { ipFromHeaders } from "@/lib/client-ip";
import { rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/server/services/settings";
import { activeStructureNames, internalStructureNames } from "@/server/services/structures";
import { formatDateTime, msSince } from "@/lib/utils";
import { AttendancePublicForm } from "./form";
import { RegistrationCountdown } from "./countdown";
import { BrandLockup } from "@/components/logo";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Un QR dynamique photographié et diffusé hors de la salle ne doit pas ouvrir des sessions sans limite :
 * plafond par jeton (dimensionné sur l'effectif attendu) et par adresse IP.
 */
async function allowCheckinSession(qrTokenId: string, meetingId: string, expected: number | null) {
  const ip = ipFromHeaders(await headers());
  const [byToken, byIp] = await Promise.all([
    rateLimit(`checkin:issue:${qrTokenId}`, Math.max(30, expected ?? 0), 15 * 60),
    rateLimit(`checkin:issue-ip:${meetingId}:${ip}`, Math.max(60, expected ?? 0), 60),
  ]);
  return byToken.allowed && byIp.allowed;
}

export default async function PublicAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { token } = await params;
  const { s } = await searchParams;
  const resolved = await resolveToken(token);
  if (!resolved) {
    return (
      <Notice title="QR invalide">
        Ce code ne correspond à aucune réunion. Vérifiez que vous scannez bien le QR de la salle.
      </Notice>
    );
  }
  if (resolved.modeMismatch) {
    return (
      <Notice title="QR non valable">
        Ce QR n&apos;est pas valable pour cette réunion. Scannez le QR affiché à l&apos;écran de la salle.
      </Notice>
    );
  }
  const meeting = resolved.record.meeting;
  // QR dynamique scanné avant l'ouverture : la session délivrée au scan reste valable une fois le jeton expiré.
  const carried =
    resolved.record.type === "DYNAMIC" && s && verifyCheckinSession(s, meeting.id)?.q === resolved.record.id ? s : null;
  if (resolved.expired && !carried) {
    return (
      <Notice title="QR expiré">
        Ce code n&apos;est plus valable. Scannez le QR actuellement affiché dans la salle.
      </Notice>
    );
  }

  const state = selfRegistrationState(meeting);

  if (state === "closed") {
    return (
      <Notice title={meeting.title}>
        Cette réunion est clôturée
        {meeting.closedAt ? ` depuis le ${formatDateTime(meeting.closedAt)}` : ""}. L&apos;émargement est terminé.
      </Notice>
    );
  }
  if (state === "not_open" || state === "before") {
    const { opensAt } = registrationWindow(meeting);
    let resumeHref: string | undefined;
    if (resolved.record.type === "DYNAMIC") {
      const waiting =
        carried ??
        ((await allowCheckinSession(resolved.record.id, meeting.id, meeting.expectedParticipants))
          ? issueCheckinSession(meeting.id, resolved.record.id, opensAt)
          : null);
      if (waiting) resumeHref = `/r/${encodeURIComponent(token)}?s=${encodeURIComponent(waiting)}`;
    }
    return (
      <Notice title={meeting.title}>
        L&apos;émargement n&apos;est pas encore ouvert.
        <RegistrationCountdown
          opensAt={opensAt.toISOString()}
          opensAtLabel={formatDateTime(opensAt)}
          initialSeconds={Math.ceil(-msSince(opensAt) / 1000)}
          waitingForOrganizer={state === "not_open"}
          resumeHref={resumeHref}
        />
      </Notice>
    );
  }
  if (state === "after") {
    return (
      <Notice title={meeting.title}>
        L&apos;émargement est terminé pour cette réunion.
      </Notice>
    );
  }

  const [settings, count, structures, internalNames] = await Promise.all([
    getSettings(),
    prisma.attendance.count({ where: { meetingId: meeting.id, status: "ACTIVE" } }),
    activeStructureNames(),
    meeting.allowGuests ? Promise.resolve([]) : internalStructureNames(),
  ]);
  let session: string | null = carried;
  if (resolved.record.type === "DYNAMIC" && !session) {
    if (!(await allowCheckinSession(resolved.record.id, meeting.id, meeting.expectedParticipants))) {
      return (
        <Notice title={meeting.title}>
          Trop de sessions d&apos;émargement ont été ouvertes avec ce QR. Scannez le QR actuellement affiché dans la salle.
        </Notice>
      );
    }
    session = issueCheckinSession(meeting.id, resolved.record.id);
  }

  return (
    <PublicShell>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-leaf">{settings.ministryName}</p>
      <h1 className="mt-2 font-display text-4xl leading-tight text-forest-deep">{meeting.title}</h1>
      <p className="mt-2 text-muted">
        {formatDateTime(meeting.startsAt)}
        <br />
        {meeting.location || "Réunion à distance"}
      </p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1 text-sm font-semibold text-forest">
        <span className="h-2 w-2 rounded-full bg-leaf" />
        Inscriptions ouvertes
      </div>
      <p className="mt-3 text-sm text-muted">
        {count} participant{count > 1 ? "s" : ""} enregistré{count > 1 ? "s" : ""}
      </p>
      {session ? (
        <p className="mt-2 text-xs text-muted">Vous disposez de 15 minutes pour remplir et signer le formulaire.</p>
      ) : null}
      {!meeting.allowGuests ? (
        <p className="mt-2 text-xs font-semibold text-forest">Réunion réservée aux agents SODEFOR.</p>
      ) : null}
      <AttendancePublicForm
        token={token}
        session={session}
        emailRequired={meeting.emailRequired}
        signatureRequired={meeting.signatureRequired}
        structures={structures}
        restrictedStructures={meeting.allowGuests ? null : internalNames}
        privacyNotice={settings.privacyNotice}
        publicListEnabled={meeting.showPublicAttendance}
      />
      {meeting.showPublicAttendance ? (
        <Link href={`/r/${token}/list`} className="mt-6 inline-block text-sm font-semibold text-forest">
          Liste de présence publique
        </Link>
      ) : null}
    </PublicShell>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <PublicShell>
      <h1 className="font-display text-3xl text-forest-deep">{title}</h1>
      <div className="mt-3 text-muted">{children}</div>
    </PublicShell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#e7f3ea_0%,#f5f7f3_28%,#f5f7f3_100%)] px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <BrandLockup compact />
        <div className="page-enter mt-8">{children}</div>
      </div>
    </div>
  );
}
