import { CalendarDays, CalendarRange, PlayCircle, Users } from "lucide-react";
import { Prisma } from "@prisma/client";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guards";
import { hasPermission, meetingScope } from "@/lib/rbac";
import { meetingWhereForRole } from "@/server/services/meetings";
import { STATUS_LABELS, STATUS_TONES, isLive } from "@/lib/meeting-status";
import { formatDateTime } from "@/lib/utils";
import { actionLabel } from "@/lib/audit-format";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await requireSession();
  const { role, id: userId } = session.user;
  const scope = (extra: Prisma.MeetingWhereInput = {}) => meetingWhereForRole(role, userId, extra);
  const perimeter = meetingScope(role);
  const scopeSql =
    perimeter === "own"
      ? Prisma.sql`AND m.createdById = ${userId}`
      : perimeter === "assigned"
        ? Prisma.sql`AND m.secretaryId = ${userId}`
        : Prisma.empty;
  const canReadAudit = hasPermission(role, "audit.read");
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
      where: scope({ startsAt: { gte: startOfDay, lte: endOfDay } }),
    }),
    prisma.meeting
      .findMany({
        where: scope({ status: { in: ["OUVERTE", "EN_COURS"] } }),
        select: {
          status: true,
          startsAt: true,
          endsAt: true,
          registrationOpensAt: true,
          registrationClosesAt: true,
          toleranceMinutes: true,
        },
      })
      .then((rows) => rows.filter((row) => isLive(row)).length),
    prisma.attendance.count({
      where: { status: "ACTIVE", checkInAt: { gte: startOfDay, lte: endOfDay }, meeting: scope() },
    }),
    prisma.meeting.count({ where: scope({ startsAt: { gte: startOfMonth } }) }),
    prisma.meeting.findMany({
      where: scope(),
      take: 6,
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { attendances: { where: { status: "ACTIVE" } } } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.meeting.findMany({
      where: scope({ startsAt: { gte: new Date() }, status: { not: "ARCHIVEE" } }),
      take: 5,
      orderBy: { startsAt: "asc" },
    }),
    canReadAudit
      ? prisma.auditLog.findMany({
          take: 8,
          orderBy: { createdAt: "desc" },
          include: { actor: { select: { firstName: true, lastName: true } } },
        })
      : Promise.resolve([]),
    prisma.$queryRaw<{ day: Date; total: bigint }[]>`
      SELECT DATE(a.checkInAt) as day, COUNT(*) as total
      FROM Attendance a
      JOIN Meeting m ON m.id = a.meetingId
      WHERE a.status = 'ACTIVE' AND a.checkInAt >= DATE_SUB(UTC_DATE(), INTERVAL 13 DAY)
      ${scopeSql}
      GROUP BY DATE(a.checkInAt)
      ORDER BY day ASC
    `.catch(() => []),
  ]);

  const max = Math.max(1, ...dailyCounts.map((d) => Number(d.total)));

  const kpis = [
    { label: "Réunions aujourd'hui", value: meetingsToday, icon: <CalendarDays className="h-5 w-5" />, tone: "forest" as const },
    { label: "Réunions en cours", value: meetingsLive, icon: <PlayCircle className="h-5 w-5" />, tone: "sky" as const },
    { label: "Participants aujourd'hui", value: participantsToday, icon: <Users className="h-5 w-5" />, tone: "gold" as const },
    { label: "Réunions ce mois", value: meetingsMonth, icon: <CalendarRange className="h-5 w-5" />, tone: "rose" as const },
  ];

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle="Pilotage des réunions, des émargements et de l'activité récente."
      />
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <StatCard key={kpi.label} label={kpi.label} value={kpi.value} icon={kpi.icon} tone={kpi.tone} />
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
                    className="w-full rounded-t-lg bg-gradient-to-t from-forest to-leaf"
                    style={{ height: `${(Number(day.total) / max) * 100}%` }}
                  />
                  <span className="text-[10px] text-muted">
                    {new Date(day.day).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-forest-deep">Réunions à venir</h2>
            <Link href="/calendar" className="inline-flex items-center gap-1 text-sm font-semibold text-forest hover:underline">
              <CalendarRange className="h-4 w-4" /> Calendrier
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {upcoming.map((meeting) => (
              <Link
                key={meeting.id}
                href={`/meetings/${meeting.id}`}
                className="flex items-center gap-3 rounded-xl border border-transparent bg-sand p-3 transition hover:border-leaf/40 hover:bg-mint"
              >
                <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-paper text-forest shadow-sm">
                  <span className="text-[10px] font-bold uppercase leading-none">
                    {meeting.startsAt.toLocaleDateString("fr-FR", { month: "short", timeZone: "Africa/Abidjan" })}
                  </span>
                  <span className="font-display text-lg font-semibold leading-none">{meeting.startsAt.getUTCDate()}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{meeting.title}</span>
                  <span className="block text-xs text-muted">{formatDateTime(meeting.startsAt)}</span>
                </span>
              </Link>
            ))}
            {upcoming.length === 0 ? <p className="text-sm text-muted">Aucune réunion planifiée.</p> : null}
          </div>
        </Card>
      </div>

      <div className={`mt-6 grid gap-6 ${canReadAudit ? "xl:grid-cols-2" : ""}`}>
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
        {canReadAudit ? (
          <Card>
            <h2 className="font-display text-xl text-forest-deep">Activité récente</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {recentAudit.map((log) => (
                <li key={log.id} className="rounded-xl bg-sand p-3">
                  <p className="font-semibold">{actionLabel(log.action)}</p>
                  <p className="text-xs text-muted">
                    {log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "Système"} · {formatDateTime(log.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
