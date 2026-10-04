import { BarChart3, CalendarDays, CalendarRange, PlayCircle, Users } from "lucide-react";
import { Prisma } from "@prisma/client";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guards";
import { hasPermission, meetingScope } from "@/lib/rbac";
import { meetingWhereForRole } from "@/server/services/meetings";
import { STATUS_LABELS, STATUS_TONES, isLive } from "@/lib/meeting-status";
import { APP_TIME_ZONE, formatDateTime } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { memo } from "@/lib/memo-cache";
import { actionLabel } from "@/lib/audit-format";
import { bucketLabel, periodBuckets, resolveDashboardPeriod } from "@/lib/dashboard-period";
import { PeriodFilter } from "./period-filter";
import Link from "next/link";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; from?: string; to?: string }>;
}) {
  const session = await requireSession();
  const { role, id: userId } = session.user;
  const period = resolveDashboardPeriod(await searchParams);
  const scope = (extra: Prisma.MeetingWhereInput = {}) => meetingWhereForRole(role, userId, extra);
  const perimeter = meetingScope(role);
  const scopeSql =
    perimeter === "own"
      ? Prisma.sql`AND m.createdById = ${userId}`
      : perimeter === "assigned"
        ? Prisma.sql`AND m.secretaryId = ${userId}`
        : Prisma.empty;
  const canReadAudit = hasPermission(role, "audit.read");
  const inPeriod = { gte: period.from, lt: period.to };
  const bucketFormat = period.bucket === "day" ? "%Y-%m-%d" : "%Y-%m";
  const now = new Date();
  const live = period.to > now;
  // Périmètre « all » : pas de jointure inutile sur Meeting pour les comptages de présences.
  const attendanceScope = perimeter === "all" ? {} : { meeting: scope() };
  const held: Prisma.MeetingWhereInput = { startsAt: inPeriod, status: { in: ["CLOTUREE", "ARCHIVEE"] } };
  const scopeKey = perimeter === "all" ? "all" : `${perimeter}:${userId}`;

  // Agrégats mutualisés par périmètre et période (actualisation automatique de chaque onglet ouvert) ;
  // une période terminée ne change plus, d'où une durée plus longue.
  const aggregates = memo(
    `dashboard:${scopeKey}:${period.fromInput}:${period.toInput}:${period.bucket}`,
    live ? 30_000 : 5 * 60_000,
    () =>
      Promise.all([
        prisma.meeting.count({ where: scope({ startsAt: inPeriod }) }),
        prisma.attendance.count({ where: { status: "ACTIVE", checkInAt: inPeriod, ...attendanceScope } }),
        prisma.meeting.count({ where: scope(held) }),
        prisma.attendance.count({ where: { status: "ACTIVE", meeting: scope(held) } }),
        prisma.$queryRaw<{ bucket: string; total: bigint }[]>`
          SELECT DATE_FORMAT(a.checkInAt, ${bucketFormat}) as bucket, COUNT(*) as total
          FROM Attendance a
          JOIN Meeting m ON m.id = a.meetingId
          WHERE a.status = 'ACTIVE' AND a.checkInAt >= ${period.from} AND a.checkInAt < ${period.to}
          ${scopeSql}
          GROUP BY bucket
        `
          .then((rows) => rows.map((row) => ({ bucket: row.bucket, total: Number(row.total) })))
          .catch((error) => {
            logger.error("dashboard.chart_failed", error);
            return null;
          }),
      ]),
  );

  const [
    [meetingsInPeriod, participantsInPeriod, heldMeetings, heldAttendances, bucketCounts],
    meetingsLive,
    latestMeetings,
    upcoming,
    recentAudit,
  ] = await Promise.all([
    aggregates,
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
    prisma.meeting.findMany({
      where: scope({ startsAt: inPeriod }),
      take: 6,
      orderBy: { startsAt: "desc" },
      include: {
        _count: { select: { attendances: { where: { status: "ACTIVE" } } } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.meeting.findMany({
      where: scope({ startsAt: { gte: now }, status: { not: "ARCHIVEE" } }),
      take: 5,
      orderBy: { startsAt: "asc" },
    }),
    canReadAudit
      ? prisma.auditLog.findMany({
          where: { createdAt: inPeriod },
          take: 8,
          orderBy: { createdAt: "desc" },
          include: { actor: { select: { firstName: true, lastName: true } } },
        })
      : Promise.resolve([]),
  ]);

  const totals = new Map((bucketCounts ?? []).map((row) => [row.bucket, row.total]));
  const chart = periodBuckets(period).map((key) => ({ key, total: totals.get(key) ?? 0 }));
  const max = Math.max(1, ...chart.map((item) => item.total));
  const labelEvery = Math.max(1, Math.ceil(chart.length / 14));
  const peak = chart.reduce((best, item) => (item.total > best.total ? item : best), chart[0] ?? { key: "", total: 0 });
  const plural = (n: number) => (n > 1 ? "s" : "");
  const chartSummary = `${participantsInPeriod} présence${plural(participantsInPeriod)} sur la période${
    peak.total ? `, maximum ${peak.total} le ${bucketLabel(peak.key)}` : ""
  }.`;
  // Même définition que la page Statistiques : réunions tenues (clôturées ou archivées) de la période.
  const average = heldMeetings ? (heldAttendances / heldMeetings).toFixed(1) : "0";

  const kpis = [
    { label: "Réunions sur la période", value: meetingsInPeriod, icon: <CalendarDays className="h-5 w-5" />, tone: "forest" as const },
    { label: "Réunions en cours", value: meetingsLive, icon: <PlayCircle className="h-5 w-5" />, tone: "sky" as const, hint: "En ce moment" },
    { label: "Présences sur la période", value: participantsInPeriod, icon: <Users className="h-5 w-5" />, tone: "gold" as const, hint: "Par date d'émargement" },
    { label: "Moyenne par réunion", value: average, icon: <BarChart3 className="h-5 w-5" />, tone: "rose" as const, hint: "Réunions tenues de la période" },
  ];

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle="Pilotage des réunions, des émargements et de l'activité récente."
      />
      <PeriodFilter
        current={period.key}
        fromInput={period.fromInput}
        toInput={period.toInput}
        label={period.label}
        generatedAt={now.toISOString()}
        live={live}
      />
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <StatCard key={kpi.label} label={kpi.label} value={kpi.value} icon={kpi.icon} tone={kpi.tone} hint={kpi.hint} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <h2 className="font-display text-xl text-forest-deep">
            Présences {period.bucket === "day" ? "par jour" : "par mois"} — {period.label.toLowerCase()}
          </h2>
          {bucketCounts && participantsInPeriod > 0 ? (
            <table className="sr-only">
              <caption>{chartSummary}</caption>
              <thead>
                <tr>
                  <th scope="col">{period.bucket === "day" ? "Jour" : "Mois"}</th>
                  <th scope="col">Présences</th>
                </tr>
              </thead>
              <tbody>
                {chart.map((item) => (
                  <tr key={item.key}>
                    <td>{bucketLabel(item.key)}</td>
                    <td>{item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <div className="mt-6 flex h-40 items-end gap-1" aria-hidden={Boolean(bucketCounts && participantsInPeriod > 0)}>
            {!bucketCounts ? (
              <p className="text-sm text-muted">Graphique momentanément indisponible.</p>
            ) : participantsInPeriod === 0 ? (
              <p className="text-sm text-muted">Aucune présence sur la période.</p>
            ) : (
              chart.map((item, index) => (
                <div
                  key={item.key}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                  title={`${bucketLabel(item.key)} : ${item.total} présence${plural(item.total)}`}
                >
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-forest to-leaf"
                      style={{ height: `${(item.total / max) * 100}%`, minHeight: item.total ? 4 : 0 }}
                    />
                  </div>
                  <span className={`h-4 whitespace-nowrap text-[11px] text-muted ${index % labelEvery === 0 ? "" : "invisible"}`}>
                    {bucketLabel(item.key)}
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
                    {meeting.startsAt.toLocaleDateString("fr-FR", { month: "short", timeZone: APP_TIME_ZONE })}
                  </span>
                  <span className="font-display text-lg font-semibold leading-none">
                    {meeting.startsAt.toLocaleDateString("fr-FR", { day: "numeric", timeZone: APP_TIME_ZONE })}
                  </span>
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
          <h2 className="font-display text-xl text-forest-deep">Réunions de la période</h2>
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
            {latestMeetings.length === 0 ? <p className="py-3 text-sm text-muted">Aucune réunion sur la période.</p> : null}
          </div>
        </Card>
        {canReadAudit ? (
          <Card>
            <h2 className="font-display text-xl text-forest-deep">Activité sur la période</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {recentAudit.map((log) => (
                <li key={log.id} className="rounded-xl bg-sand p-3">
                  <p className="font-semibold">{actionLabel(log.action)}</p>
                  <p className="text-xs text-muted">
                    {log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "Système"} · {formatDateTime(log.createdAt)}
                  </p>
                </li>
              ))}
              {recentAudit.length === 0 ? <li className="text-muted">Aucune activité sur la période.</li> : null}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
