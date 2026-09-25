import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guards";
import { Card, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export default async function AuditPage() {
  await requirePermission("audit.read");
  const logs = await prisma.auditLog.findMany({
    take: 80,
    orderBy: { createdAt: "desc" },
    include: { actor: true },
  });

  return (
    <div>
      <PageHeader title="Journal d'audit" subtitle="Création, ouverture, clôture, inscriptions, exports et corrections." />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-mint text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th>Action</th>
              <th>Entité</th>
              <th>Auteur</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-line">
                <td className="px-4 py-3">{formatDateTime(log.createdAt)}</td>
                <td className="font-semibold">{log.action}</td>
                <td>{log.entity}</td>
                <td>{log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "Système"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
