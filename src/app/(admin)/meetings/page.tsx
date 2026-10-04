import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { meetingWhereForRole } from "@/server/services/meetings";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/meeting-status";
import { formatDateTime } from "@/lib/utils";
import { Button, Card, LinkButton, PageHeader } from "@/components/ui";
import { CalendarRange, Plus, QrCode, Search, Users } from "lucide-react";
import { MeetingStatus } from "@prisma/client";
import { listMeetingTypes } from "@/server/services/meeting-types";

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; page?: string }>;
}) {
  const session = await requirePermission("attendances.read");
  const canCreate = hasPermission(session.user.role, "meetings.create");
  const canShowQr = hasPermission(session.user.role, "qr.display");
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 100) ?? "";
  const status = (Object.values(MeetingStatus) as string[]).includes(params.status ?? "")
    ? (params.status as MeetingStatus)
    : undefined;
  const type = params.type || undefined;
  const page = Math.max(1, Math.floor(Number(params.page ?? 1)) || 1);
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
      type ? { type } : {},
    ],
  });

  const [total, meetings, types] = await Promise.all([
    prisma.meeting.count({ where }),
    prisma.meeting.findMany({
      where,
      orderBy: { startsAt: "desc" },
      skip: (page - 1) * take,
      take,
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { attendances: { where: { status: "ACTIVE" } } } },
      },
    }),
    listMeetingTypes(),
  ]);
  const typeLabels = Object.fromEntries(types.map((t) => [t.code, t]));
  const pages = Math.max(1, Math.ceil(total / take));

  return (
    <div>
      <PageHeader
        title="Réunions"
        subtitle="Recherche, filtres, statuts et actions de pilotage."
        actions={
          <div className="flex gap-2">
            <LinkButton href="/calendar" variant="outline">
              <CalendarRange className="h-4 w-4" /> Calendrier
            </LinkButton>
            {canCreate ? (
              <LinkButton href="/meetings/new">
                <Plus className="h-4 w-4" /> Créer une réunion
              </LinkButton>
            ) : null}
          </div>
        }
      />
      <Card className="mb-5 p-4">
        <form role="search" className="grid gap-3 md:grid-cols-[1fr_200px_200px_auto]">
          <div className="relative">
            <label htmlFor="meetings-q" className="sr-only">
              Rechercher une réunion
            </label>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              id="meetings-q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Rechercher un objet, un lieu, une référence…"
              className="field pl-10"
            />
          </div>
          <select name="status" defaultValue={status ?? ""} className="field" aria-label="Filtrer par statut">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select name="type" defaultValue={type ?? ""} className="field" aria-label="Filtrer par type de réunion">
            <option value="">Tous les types</option>
            {types.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline">
            Filtrer
          </Button>
        </form>
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="data-table w-full text-sm">
          <thead>
            <tr>
              <th>Objet</th>
              <th>Date</th>
              <th>Lieu</th>
              <th>Participants</th>
              <th>Statut</th>
              <th>Organisateur</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {meetings.map((meeting) => (
              <tr key={meeting.id}>
                <td>
                  <Link href={`/meetings/${meeting.id}`} className="font-semibold text-ink hover:text-forest">
                    {meeting.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {meeting.internalRef} ·{" "}
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: typeLabels[meeting.type]?.color ?? "#94a3b8" }} />
                      {typeLabels[meeting.type]?.label ?? meeting.type}
                    </span>
                  </p>
                </td>
                <td className="whitespace-nowrap">{formatDateTime(meeting.startsAt)}</td>
                <td>{meeting.location || "Distanciel"}</td>
                <td>
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Users className="h-3.5 w-3.5 text-leaf" />
                    {meeting._count.attendances}
                    {meeting.expectedParticipants ? <span className="font-normal text-muted">/ {meeting.expectedParticipants}</span> : null}
                  </span>
                </td>
                <td>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONES[meeting.status]}`}>
                    {STATUS_LABELS[meeting.status]}
                  </span>
                </td>
                <td>
                  {meeting.createdBy.firstName} {meeting.createdBy.lastName}
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    {canShowQr ? (
                      <Link
                        href={`/meetings/${meeting.id}/qr`}
                        title="QR code"
                        className="rounded-lg p-2 text-forest hover:bg-mint"
                      >
                        <QrCode className="h-4 w-4" />
                      </Link>
                    ) : null}
                    <Link
                      href={`/meetings/${meeting.id}`}
                      className="rounded-lg px-3 py-2 text-sm font-semibold text-forest hover:bg-mint"
                    >
                      Ouvrir
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {meetings.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted">
                  Aucune réunion ne correspond à votre recherche.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
      <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <p>
          {total} réunion(s) · page {page}/{pages}
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link href={`/meetings?q=${encodeURIComponent(q)}&status=${status ?? ""}&type=${encodeURIComponent(type ?? "")}&page=${page - 1}`}>Précédent</Link>
          ) : null}
          {page < pages ? (
            <Link href={`/meetings?q=${encodeURIComponent(q)}&status=${status ?? ""}&type=${encodeURIComponent(type ?? "")}&page=${page + 1}`}>Suivant</Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
