import { requirePermission } from "@/lib/guards";
import { Card, PageHeader } from "@/components/ui";
import { ENTITY_LABELS } from "@/lib/audit-format";
import { auditActors, queryAudit, type AuditFilters } from "@/server/services/audit-query";
import {
  ActionBadge,
  AuditChanges,
  AuditFiltersBar,
  AuditPagination,
  AuditTarget,
  auditDateTime,
} from "@/components/audit-views";

export default async function AuditPage({ searchParams }: { searchParams: Promise<AuditFilters> }) {
  const session = await requirePermission("audit.read");
  const filters = await searchParams;
  const [{ rows, total, capped, page, pages }, actors] = await Promise.all([
    queryAudit(filters, {}, 30, session.user.role),
    auditActors(),
  ]);

  return (
    <div>
      <PageHeader
        title="Journal d'audit"
        subtitle="Traçabilité complète : chaque action est horodatée avec son auteur, son adresse IP et les valeurs avant / après modification."
      />
      <AuditFiltersBar filters={filters} actors={actors} />
      <Card className="overflow-x-auto p-0">
        <table className="data-table w-full text-sm">
          <thead>
            <tr>
              <th className="w-44">Date</th>
              <th>Action et modifications</th>
              <th className="w-48">Auteur</th>
              <th className="w-32">Adresse IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="align-top">
                <td className="whitespace-nowrap text-muted">{auditDateTime(row.createdAt)}</td>
                <td>
                  <div className="flex flex-wrap items-center gap-2">
                    <ActionBadge action={row.action} />
                    <span className="text-xs text-muted">{ENTITY_LABELS[row.entity] ?? row.entity}</span>
                    <AuditTarget row={row} />
                  </div>
                  <AuditChanges row={row} />
                </td>
                <td>{row.actor ? `${row.actor.firstName} ${row.actor.lastName}` : <span className="text-muted">Système</span>}</td>
                <td className="font-mono text-xs text-muted">{row.ipAddress ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-muted">
                  Aucun évènement ne correspond aux filtres.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
      <AuditPagination page={page} pages={pages} total={total} capped={capped} filters={filters} />
    </div>
  );
}
