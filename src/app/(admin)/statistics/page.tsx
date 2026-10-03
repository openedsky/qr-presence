import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guards";
import { Card, PageHeader } from "@/components/ui";
import { AnimatedNumber } from "@/components/animated-number";
import { isOwnMeetingsOnly } from "@/lib/meeting-access";
import { meetingWhereForRole } from "@/server/services/meetings";
import { normalizeLabel } from "@/server/services/structures";
import { cn, daysAgo } from "@/lib/utils";
import { memo } from "@/lib/memo-cache";

export const metadata = { title: "Statistiques" };

const STATS_TTL_MS = 5 * 60_000;

const PERIODS = [
  { value: "30", label: "30 jours", days: 30 },
  { value: "90", label: "3 mois", days: 90 },
  { value: "365", label: "12 mois", days: 365 },
  { value: "all", label: "Tout", days: null },
] as const;

/** Seules les réunions tenues (clôturées ou archivées) comptent : brouillons et réunions futures faussent les moyennes. */
export default async function StatisticsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const session = await requirePermission("stats.read");
  const { p } = await searchParams;
  const period = PERIODS.find((item) => item.value === p) ?? PERIODS[2];
  const since = period.days ? daysAgo(period.days) : null;
  const held: Prisma.MeetingWhereInput = {
    status: { in: ["CLOTUREE", "ARCHIVEE"] },
    ...(since ? { startsAt: { gte: since } } : {}),
  };
  const meetingWhere = meetingWhereForRole(session.user.role, session.user.id, held);
  const attendanceWhere = { status: "ACTIVE" as const, meeting: meetingWhere };

  const withExpected: Prisma.MeetingWhereInput = { AND: [meetingWhere, { expectedParticipants: { gt: 0 } }] };
  // Agrégats sur toute la base : mutualisés 5 minutes par périmètre et période.
  const scopeKey = isOwnMeetingsOnly(session.user.role) ? `${session.user.role}:${session.user.id}` : "all";
  const [meetings, attendances, orgRows, expected, attendedWithExpected] = await memo(
    `stats:${scopeKey}:${period.value}`,
    STATS_TTL_MS,
    () =>
      Promise.all([
        prisma.meeting.count({ where: meetingWhere }),
        prisma.attendance.count({ where: attendanceWhere }),
        prisma.attendance.groupBy({ by: ["organization"], where: attendanceWhere, _count: { _all: true } }),
        prisma.meeting.aggregate({ where: withExpected, _sum: { expectedParticipants: true } }),
        // Numérateur et dénominateur sur les mêmes réunions : sinon les réunions sans effectif gonflent le taux.
        prisma.attendance.count({ where: { status: "ACTIVE", meeting: withExpected } }),
      ]),
  );

  // « SODEFOR », « Sodefor » et « DSI – SODEFOR » saisis différemment sont regroupés sous un même libellé.
  const grouped = new Map<string, { label: string; count: number }>();
  for (const row of orgRows) {
    const key = normalizeLabel(row.organization);
    const current = grouped.get(key);
    if (current) current.count += row._count._all;
    else grouped.set(key, { label: row.organization.trim(), count: row._count._all });
  }
  const byOrg = [...grouped.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  const average = meetings ? (attendances / meetings).toFixed(1) : "0";
  const expectedTotal = expected._sum.expectedParticipants ?? 0;

  return (
    <div>
      <PageHeader
        title="Statistiques"
        subtitle={`${isOwnMeetingsOnly(session.user.role) ? "Vos réunions" : "Ensemble des réunions"} tenues (clôturées ou archivées) · ${period.label}.`}
      />
      <div className="mb-6 flex w-fit flex-wrap gap-1 rounded-2xl border border-line bg-paper p-1 shadow-sm">
        {PERIODS.map((item) => (
          <Link
            key={item.value}
            href={`/statistics?p=${item.value}`}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-semibold transition",
              item.value === period.value ? "bg-forest text-white shadow" : "text-muted hover:bg-mint hover:text-forest",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <div className="stagger grid gap-4 md:grid-cols-4">
        <Card className="card-hover"><p className="text-xs uppercase text-muted">Réunions tenues</p><p className="mt-2 font-display text-4xl text-forest"><AnimatedNumber value={meetings} /></p></Card>
        <Card className="card-hover"><p className="text-xs uppercase text-muted">Présences</p><p className="mt-2 font-display text-4xl text-forest"><AnimatedNumber value={attendances} /></p></Card>
        <Card className="card-hover"><p className="text-xs uppercase text-muted">Moyenne / réunion</p><p className="mt-2 font-display text-4xl text-forest">{average}</p></Card>
        <Card className="card-hover">
          <p className="text-xs uppercase text-muted">Taux de présence</p>
          <p className="mt-2 font-display text-4xl text-forest">
            {expectedTotal ? `${Math.round((attendedWithExpected / expectedTotal) * 100)} %` : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">Sur les réunions avec un effectif attendu.</p>
        </Card>
      </div>
      <Card className="mt-6">
        <h2 className="font-display text-xl">Structures les plus représentées</h2>
        <ul className="stagger mt-4 space-y-2 text-sm">
          {byOrg.map((row) => (
            <li key={row.label} className="relative overflow-hidden rounded-xl bg-sand px-3 py-2">
              <span
                aria-hidden
                className="bar-grow absolute inset-y-0 left-0 bg-mint"
                style={{ width: `${(row.count / Math.max(1, byOrg[0]?.count ?? 1)) * 100}%` }}
              />
              <span className="relative flex justify-between">
                <span>{row.label}</span>
                <strong>{row.count}</strong>
              </span>
            </li>
          ))}
          {byOrg.length === 0 ? <li className="text-muted">Aucune présence sur la période.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
