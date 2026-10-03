import { requireSession } from "@/lib/guards";
import { PageHeader } from "@/components/ui";
import { queryAudit, type AuditFilters } from "@/server/services/audit-query";
import { AuditFiltersBar, AuditPagination, AuditTimeline } from "@/components/audit-views";
import { AccountTabs } from "../account-tabs";

export const metadata = { title: "Mon historique" };

export default async function PersonalHistoryPage({ searchParams }: { searchParams: Promise<AuditFilters> }) {
  const session = await requireSession();
  const filters = await searchParams;
  const userId = session.user.id;
  // Mes actions, plus les tentatives de connexion échouées sur mon compte.
  const scope = {
    OR: [{ actorId: userId }, { entity: "User", entityId: userId, action: "auth.login_failed" }],
  };
  const { rows, total, capped, page, pages } = await queryAudit({ ...filters, actorId: undefined }, scope, 40);

  return (
    <div>
      <PageHeader eyebrow="Mon compte" title="Mon historique" subtitle="Vos connexions et toutes les actions réalisées avec votre compte." />
      <AccountTabs active="history" />
      <AuditFiltersBar filters={filters} showSearch={false} />
      <AuditTimeline rows={rows} showActor={false} />
      <AuditPagination page={page} pages={pages} total={total} capped={capped} filters={filters} />
    </div>
  );
}
