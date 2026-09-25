import { resolveToken } from "@/lib/qr";
import { prisma } from "@/lib/prisma";
import { isRegistrationOpen } from "@/lib/meeting-status";
import { getSettings } from "@/server/services/settings";
import { formatDateTime } from "@/lib/utils";
import { AttendancePublicForm } from "./form";
import { BrandLockup } from "@/components/logo";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function PublicAttendancePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveToken(token);
  if (!resolved) notFound();
  if (resolved.expired) {
    return (
      <PublicShell>
        <h1 className="font-display text-3xl text-forest-deep">QR expiré</h1>
        <p className="mt-3 text-muted">
          Ce code n'est plus valable. Demandez à l'organisateur d'afficher le QR actuel de la salle.
        </p>
      </PublicShell>
    );
  }

  const meeting = resolved.record.meeting;
  if (["CLOTUREE", "ARCHIVEE"].includes(meeting.status) || !isRegistrationOpen(meeting.status)) {
    return (
      <PublicShell>
        <h1 className="font-display text-3xl text-forest-deep">{meeting.title}</h1>
        <p className="mt-3 text-muted">Cette réunion est fermée. Les inscriptions ne sont plus acceptées.</p>
        {meeting.showPublicAttendance ? (
          <Link href={`/r/${token}/list`} className="mt-6 inline-block font-semibold text-forest">
            Consulter la liste publique
          </Link>
        ) : null}
      </PublicShell>
    );
  }

  const [settings, count, structures] = await Promise.all([
    getSettings(),
    prisma.attendance.count({ where: { meetingId: meeting.id, status: "ACTIVE" } }),
    prisma.structure.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <PublicShell>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-leaf">{settings.ministryName}</p>
      <h1 className="mt-2 font-display text-4xl leading-tight text-forest-deep">{meeting.title}</h1>
      <p className="mt-2 text-muted">
        {formatDateTime(meeting.startsAt)}
        <br />
        {meeting.location || "Réunion distante"}
      </p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1 text-sm font-semibold text-forest">
        <span className="h-2 w-2 rounded-full bg-leaf" />
        Inscriptions ouvertes
      </div>
      <p className="mt-3 text-sm text-muted">{count} participants enregistrés</p>
      <AttendancePublicForm
        token={token}
        emailRequired={meeting.emailRequired}
        signatureRequired={meeting.signatureRequired}
        structures={structures.map((s) => s.name)}
        privacyNotice={settings.privacyNotice}
      />
      {meeting.showPublicAttendance ? (
        <Link href={`/r/${token}/list`} className="mt-6 inline-block text-sm font-semibold text-forest">
          Liste de présence publique
        </Link>
      ) : null}
    </PublicShell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#e7f3ea_0%,#f5f7f3_28%,#f5f7f3_100%)] px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <BrandLockup compact />
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
