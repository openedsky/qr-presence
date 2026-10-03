import { requirePermission } from "@/lib/guards";
import { PageHeader } from "@/components/ui";
import { auditActors, queryAudit, type AuditFilters } from "@/server/services/audit-query";
import { AuditFiltersBar, AuditPagination, AuditTimeline } from "@/components/audit-views";

export const metadata = { title: "Historique global" };

export default async function GlobalHistoryPage({ searchParams }: { searchParams: Promise<AuditFilters> }) {
  const session = await requirePermission("history.global");
  const filters = await searchParams;
  const [{ rows, total, capped, page, pages }, actors] = await Promise.all([
    queryAudit(filters, {}, 40, session.user.role),
    auditActors(),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Super administrateur"
        title="Historique global"
        subtitle="Toute l'activité de la plateforme, jour par jour : connexions, réunions, émargements, documents et paramétrage."
      />
      <AuditFiltersBar filters={filters} actors={actors} showSearch={false} />
      <AuditTimeline rows={rows} />
      <AuditPagination page={page} pages={pages} total={total} capped={capped} filters={filters} />
    </div>
  );
}
