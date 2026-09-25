import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guards";
import { Card, PageHeader } from "@/components/ui";

export default async function StatisticsPage() {
  await requirePermission("stats.read");
  const [meetings, attendances, byOrg] = await Promise.all([
    prisma.meeting.count(),
    prisma.attendance.count({ where: { status: "ACTIVE" } }),
    prisma.attendance.groupBy({
      by: ["organization"],
      where: { status: "ACTIVE" },
      _count: { _all: true },
      orderBy: { _count: { organization: "desc" } },
      take: 8,
    }),
  ]);
  const average = meetings ? (attendances / meetings).toFixed(1) : "0";

  return (
    <div>
      <PageHeader title="Statistiques" subtitle="Synthèse par période, structure et réunion." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card><p className="text-xs uppercase text-muted">Réunions</p><p className="mt-2 font-display text-4xl text-forest">{meetings}</p></Card>
        <Card><p className="text-xs uppercase text-muted">Présences</p><p className="mt-2 font-display text-4xl text-forest">{attendances}</p></Card>
        <Card><p className="text-xs uppercase text-muted">Moyenne / réunion</p><p className="mt-2 font-display text-4xl text-forest">{average}</p></Card>
      </div>
      <Card className="mt-6">
        <h2 className="font-display text-xl">Structures les plus représentées</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {byOrg.map((row) => (
            <li key={row.organization} className="flex justify-between rounded-xl bg-sand px-3 py-2">
              <span>{row.organization}</span>
              <strong>{row._count._all}</strong>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
