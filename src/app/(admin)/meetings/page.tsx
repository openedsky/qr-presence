import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guards";
import { meetingWhereForRole } from "@/server/services/meetings";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/meeting-status";
import { formatDateTime } from "@/lib/utils";
import { Button, Card, PageHeader } from "@/components/ui";
import { MeetingType, MeetingStatus } from "@prisma/client";

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status as MeetingStatus | undefined;
  const page = Math.max(1, Number(params.page ?? 1));
  const take = 12;
  const where = meetingWhereForRole(session.user.role, session.user.id, {
    AND: [
      q
        ? {
            OR: [
              { title: { contains: q } },
              { location: { contains: q } },
              { internalRef: { contains: q } },
            ],
          }
        : {},
      status ? { status } : {},
    ],
  });

  const [total, meetings] = await Promise.all([
    prisma.meeting.count({ where }),
    prisma.meeting.findMany({
      where,
      orderBy: { startsAt: "desc" },
      skip: (page - 1) * take,
      take,
      include: {
        createdBy: true,
        _count: { select: { attendances: { where: { status: "ACTIVE" } } } },
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / take));

  return (
    <div>
      <PageHeader
        title="Réunions"
        subtitle="Recherche, filtres, statuts et actions de pilotage."
        actions={
          <Link href="/meetings/new">
            <Button>Créer une réunion</Button>
          </Link>
        }
      />
      <Card className="mb-5">
        <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <input name="q" defaultValue={q} placeholder="Rechercher un objet, un lieu, une référence…" className="field" />
          <select name="status" defaultValue={status ?? ""} className="field">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline">
            Filtrer
          </Button>
        </form>
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-mint/60 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Objet</th>
              <th>Date</th>
              <th>Lieu</th>
              <th>Participants</th>
              <th>Statut</th>
              <th>Organisateur</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {meetings.map((meeting) => (
              <tr key={meeting.id} className="border-t border-line">
                <td className="px-4 py-4">
                  <p className="font-semibold">{meeting.title}</p>
                  <p className="text-xs text-muted">{meeting.internalRef} · {meeting.type as MeetingType}</p>
                </td>
                <td>{formatDateTime(meeting.startsAt)}</td>
                <td>{meeting.location || "Distanciel"}</td>
                <td>{meeting._count.attendances}</td>
                <td>
                  <span className={`rounded-full px-2 py-1 text-xs ${STATUS_TONES[meeting.status]}`}>
                    {STATUS_LABELS[meeting.status]}
                  </span>
                </td>
                <td>
                  {meeting.createdBy.firstName} {meeting.createdBy.lastName}
                </td>
                <td className="pr-4 text-right">
                  <Link href={`/meetings/${meeting.id}`} className="font-semibold text-forest">
                    Ouvrir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <p>
          {total} réunion(s) · page {page}/{pages}
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link href={`/meetings?q=${q}&status=${status ?? ""}&page=${page - 1}`}>Précédent</Link>
          ) : null}
          {page < pages ? (
            <Link href={`/meetings?q=${q}&status=${status ?? ""}&page=${page + 1}`}>Suivant</Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
