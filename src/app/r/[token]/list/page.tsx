import { resolveToken } from "@/lib/qr";
import { prisma } from "@/lib/prisma";
import { BrandLockup } from "@/components/logo";
import { formatDateTime, formatTime } from "@/lib/utils";
import { isFrozen } from "@/lib/meeting-status";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Visible seulement pendant la réunion, avec un QR de la réunion non révoqué, et limitée aux participants
 * qui ont expressément accepté d'y figurer. Un QR dynamique renouvelé depuis le scan reste accepté
 * (le participant consulte la liste après avoir émargé) : les jetons dynamiques sont révoqués à la clôture.
 */
export default async function PublicListPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveToken(token);
  if (!resolved || resolved.modeMismatch) notFound();
  if (resolved.expired && resolved.record.type !== "DYNAMIC") notFound();
  const meeting = resolved.record.meeting;
  if (!meeting.showPublicAttendance || isFrozen(meeting.status) || meeting.purgedAt) notFound();

  const [rows, total] = await Promise.all([
    prisma.attendance.findMany({
      where: { meetingId: meeting.id, status: "ACTIVE", publicListConsent: true },
      orderBy: { checkInAt: "asc" },
      select: { id: true, lastName: true, firstNames: true, jobTitle: true, organization: true, checkInAt: true },
    }),
    prisma.attendance.count({ where: { meetingId: meeting.id, status: "ACTIVE" } }),
  ]);

  return (
    <div className="min-h-screen bg-sand px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <BrandLockup compact />
        <h1 className="mt-6 font-display text-3xl text-forest-deep">Liste publique</h1>
        <p className="text-sm text-muted">
          {meeting.title} · {formatDateTime(meeting.startsAt)}
        </p>
        <p className="mt-2 text-xs text-muted">
          {total} présence{total > 1 ? "s" : ""} enregistrée{total > 1 ? "s" : ""} · seuls les participants ayant accepté d&apos;y
          figurer sont listés. Ni email, ni téléphone, ni signature. Liste retirée à la clôture de la réunion.
        </p>
        <div className="card mt-6 overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-mint text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">N°</th>
                <th>Nom et prénom</th>
                <th>Fonction</th>
                <th>Structure</th>
                <th>Heure</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3">{index + 1}</td>
                  <td>
                    {row.lastName} {row.firstNames}
                  </td>
                  <td>{row.jobTitle}</td>
                  <td>{row.organization}</td>
                  <td>{formatTime(row.checkInAt)}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted">
                    Aucun participant n&apos;a encore accepté de figurer sur la liste publique.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
