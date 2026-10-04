import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BrandLockup } from "@/components/logo";
import { prisma } from "@/lib/prisma";
import { resolveToken } from "@/lib/qr";
import { ipFromHeaders } from "@/lib/client-ip";
import { rateLimit } from "@/lib/rate-limit";
import { isFrozen } from "@/lib/meeting-status";
import { displayName, formatTime, msSince } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** La confirmation n'est consultable que quelques heures, pour la réunion du QR scanné. */
const CONFIRMATION_TTL_MS = 6 * 3600_000;

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4">
      <div className="w-full max-w-md text-center">
        <BrandLockup />
        <div className="card mt-8 p-8">
          <h1 className="font-display text-2xl text-forest-deep">{title}</h1>
          <p className="mt-3 text-sm text-muted">{children}</p>
        </div>
      </div>
    </div>
  );
}

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ code?: string; deja?: string }>;
}) {
  const [{ token }, { code, deja }] = await Promise.all([params, searchParams]);
  if (!code || code.length > 40) notFound();
  // Essais de codes limités par adresse : la page ne doit pas permettre de parcourir les présences.
  const ip = ipFromHeaders(await headers());
  if (!(await rateLimit(`success:${ip}`, 30, 600)).allowed) {
    return <Notice title="Trop de consultations">Réessayez dans quelques minutes.</Notice>;
  }
  const resolved = await resolveToken(token);
  if (!resolved) notFound();
  const attendance = await prisma.attendance.findUnique({
    where: { confirmationCode: code },
    select: {
      meetingId: true,
      lastName: true,
      firstNames: true,
      jobTitle: true,
      organization: true,
      checkInAt: true,
      createdAt: true,
      status: true,
    },
  });
  if (!attendance || attendance.meetingId !== resolved.record.meetingId) notFound();
  if (attendance.status !== "ACTIVE") {
    return (
      <Notice title="Présence annulée">
        Cette présence a été annulée par l&apos;organisateur. Adressez-vous à lui en cas d&apos;erreur.
      </Notice>
    );
  }
  if (msSince(attendance.createdAt) > CONFIRMATION_TTL_MS) {
    return (
      <Notice title="Confirmation expirée">
        Par confidentialité, la confirmation n&apos;est consultable que quelques heures après l&apos;émargement. Votre
        présence reste enregistrée auprès de l&apos;organisateur.
      </Notice>
    );
  }
  const meeting = resolved.record.meeting;
  const publicList = meeting.showPublicAttendance && !isFrozen(meeting.status) && !meeting.purgedAt;

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4 py-8">
      <div className="w-full max-w-md text-center">
        <BrandLockup />
        <div className="card page-enter mt-8 p-8">
          <span className="pop-in relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-mint">
            <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-leaf/20 [animation-iteration-count:2]" />
            <svg viewBox="0 0 24 24" className="check-draw relative h-10 w-10 text-forest" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="5 12.5 10 17.5 19 7" />
            </svg>
          </span>
          <h1 className="mt-4 font-display text-3xl text-forest-deep">
            {deja ? "Présence déjà enregistrée" : "Présence enregistrée"}
          </h1>
          <p className="mt-2 text-sm text-muted">{meeting.title}</p>
          {deja ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Cet appareil a déjà servi à émarger pour cette réunion : voici la confirmation délivrée.
            </p>
          ) : null}
          <p className="mt-4 text-xl font-semibold">{displayName(attendance.lastName, attendance.firstNames)}</p>
          <p className="text-muted">
            {attendance.jobTitle} – {attendance.organization}
          </p>
          <p className="mt-4 text-sm">Enregistrement effectué à {formatTime(attendance.checkInAt)}</p>
          <p className="mt-4 rounded-xl bg-sand px-3 py-2 font-mono text-sm font-semibold tracking-wide">Confirmation {code}</p>
          <p className="mt-2 text-xs text-muted">
            Conservez ce code (capture d&apos;écran) : il permet à l&apos;organisateur de retrouver votre émargement.
          </p>
          {publicList ? (
            <Link href={`/r/${token}/list`} className="mt-5 inline-block text-sm font-semibold text-forest underline">
              Voir la liste publique des participants
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
