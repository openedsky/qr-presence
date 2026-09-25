import { resolveToken } from "@/lib/qr";
import { prisma } from "@/lib/prisma";
import { BrandLockup } from "@/components/logo";
import { formatDateTime, formatTime } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function PublicListPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveToken(token);
  if (!resolved || resolved.expired) notFound();
  const meeting = resolved.record.meeting;
  if (!meeting.showPublicAttendance) notFound();

  const rows = await prisma.attendance.findMany({
    where: { meetingId: meeting.id, status: "ACTIVE" },
    orderBy: { checkInAt: "asc" },
    select: {
      lastName: true,
      firstNames: true,
      jobTitle: true,
      organization: true,
      checkInAt: true,
    },
  });

  return (
    <div className="min-h-screen bg-sand px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <BrandLockup compact />
        <h1 className="mt-6 font-display text-3xl text-forest-deep">Liste publique</h1>
        <p className="text-sm text-muted">
          {meeting.title} · {formatDateTime(meeting.startsAt)}
        </p>
        <p className="mt-2 text-xs text-muted">
          Cette liste ne contient ni email, ni téléphone, ni signature.
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
                <tr key={`${row.lastName}-${row.checkInAt}`} className="border-t border-line">
                  <td className="px-4 py-3">{index + 1}</td>
                  <td>{row.lastName} {row.firstNames}</td>
                  <td>{row.jobTitle}</td>
                  <td>{row.organization}</td>
                  <td>{formatTime(row.checkInAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
