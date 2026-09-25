import { Card, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guards";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/meeting-status";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";

export default async function DashboardPage() {
  await requireSession();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);

  const [
    meetingsToday,
    meetingsLive,
    participantsToday,
    meetingsMonth,
    latestMeetings,
    upcoming,
    recentAudit,
    dailyCounts,
  ] = await Promise.all([
    prisma.meeting.count({
      where: { startsAt: { gte: startOfDay, lte: endOfDay } },
    }),
    prisma.meeting.count({ where: { status: { in: ["OUVERTE", "EN_COURS"] } } }),
    prisma.attendance.count({
      where: { status: "ACTIVE", checkInAt: { gte: startOfDay, lte: endOfDay } },
    }),
    prisma.meeting.count({ where: { startsAt: { gte: startOfMonth } } }),
    prisma.meeting.findMany({
      take: 6,
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { attendances: true } }, createdBy: true },
    }),
    prisma.meeting.findMany({
      where: { startsAt: { gte: new Date() }, status: { not: "ARCHIVEE" } },
      take: 5,
      orderBy: { startsAt: "asc" },
    }),
    prisma.auditLog.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { actor: true },
    }),
    prisma.$queryRaw<{ day: Date; total: bigint }[]>`
      SELECT DATE(checkInAt) as day, COUNT(*) as total
      FROM Attendance
      WHERE status = 'ACTIVE' AND checkInAt >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
      GROUP BY DATE(checkInAt)
      ORDER BY day ASC
    `.catch(() => []),
  ]);

  const max = Math.max(1, ...dailyCounts.map((d) => Number(d.total)));

  const kpis = [
    { label: "Réunions aujourd'hui", value: meetingsToday },
    { label: "Réunions en cours", value: meetingsLive },
    { label: "Participants aujourd'hui", value: participantsToday },
    { label: "Réunions ce mois", value: meetingsMonth },
  ];

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle="Pilotage des réunions, des émargements et de l'activité récente."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{kpi.label}</p>
            <p className="mt-3 font-display text-4xl text-forest">{kpi.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <h2 className="font-display text-xl text-forest-deep">Présences — 14 derniers jours</h2>
          <div className="mt-6 flex h-40 items-end gap-2">
            {dailyCounts.length === 0 ? (
              <p className="text-sm text-muted">Aucune donnée pour le moment.</p>
            ) : (
              dailyCounts.map((day) => (
                <div key={String(day.day)} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-lg bg-leaf"
                    style={{ height: `${(Number(day.total) / max) * 100}%` }}
                  />
                  <span className="text-[10px] text-muted">
                    {new Date(day.day).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card>
          <h2 className="font-display text-xl text-forest-deep">Réunions à venir</h2>
          <div className="mt-4 space-y-3">
            {upcoming.map((meeting) => (
              <Link key={meeting.id} href={`/meetings/${meeting.id}`} className="block rounded-xl bg-sand p-3">
                <p className="font-semibold">{meeting.title}</p>
                <p className="text-xs text-muted">{formatDateTime(meeting.startsAt)}</p>
              </Link>
            ))}
            {upcoming.length === 0 ? <p className="text-sm text-muted">Aucune réunion planifiée.</p> : null}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl text-forest-deep">Dernières réunions</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-2">Objet</th>
                  <th>Statut</th>
                  <th>Présences</th>
                </tr>
              </thead>
              <tbody>
                {latestMeetings.map((meeting) => (
                  <tr key={meeting.id} className="border-t border-line">
                    <td className="py-3">
                      <Link href={`/meetings/${meeting.id}`} className="font-semibold text-forest">
                        {meeting.title}
                      </Link>
                    </td>
                    <td>
                      <span className={`rounded-full px-2 py-1 text-xs ${STATUS_TONES[meeting.status]}`}>
                        {STATUS_LABELS[meeting.status]}
                      </span>
                    </td>
                    <td>{meeting._count.attendances}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <h2 className="font-display text-xl text-forest-deep">Activité récente</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {recentAudit.map((log) => (
              <li key={log.id} className="rounded-xl bg-sand p-3">
                <p className="font-semibold">{log.action}</p>
                <p className="text-xs text-muted">
                  {log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "Système"} · {formatDateTime(log.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
