import { notFound } from "next/navigation";
import { BrandLockup } from "@/components/logo";
import { prisma } from "@/lib/prisma";
import { resolveToken } from "@/lib/qr";
import { displayName, formatTime, msSince } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** La confirmation n'est consultable que quelques heures, pour la réunion du QR scanné. */
const CONFIRMATION_TTL_MS = 6 * 3600_000;

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const [{ token }, { code }] = await Promise.all([params, searchParams]);
  if (!code || code.length > 40) notFound();
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
  if (
    !attendance ||
    attendance.meetingId !== resolved.record.meetingId ||
    attendance.status !== "ACTIVE" ||
    msSince(attendance.createdAt) > CONFIRMATION_TTL_MS
  ) {
    notFound();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4">
      <div className="w-full max-w-md text-center">
        <BrandLockup />
        <div className="card page-enter mt-8 p-8">
          <span className="pop-in relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-mint">
            <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-leaf/20 [animation-iteration-count:2]" />
            <svg viewBox="0 0 24 24" className="check-draw relative h-10 w-10 text-forest" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="5 12.5 10 17.5 19 7" />
            </svg>
          </span>
          <h1 className="mt-4 font-display text-3xl text-forest-deep">Présence enregistrée</h1>
          <p className="mt-2 text-sm text-muted">{resolved.record.meeting.title}</p>
          <p className="mt-4 text-xl font-semibold">{displayName(attendance.lastName, attendance.firstNames)}</p>
          <p className="text-muted">
            {attendance.jobTitle} – {attendance.organization}
          </p>
          <p className="mt-4 text-sm">Enregistrement effectué à {formatTime(attendance.checkInAt)}</p>
          <p className="mt-2 text-xs uppercase tracking-wide text-muted">Confirmation {code}</p>
        </div>
      </div>
    </div>
  );
}
