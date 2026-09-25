import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guards";
import { ROLE_LABELS } from "@/lib/rbac";
import { Card, PageHeader } from "@/components/ui";
import { UserForm } from "./user-form";

export default async function UsersPage() {
  await requirePermission("users.manage");
  const users = await prisma.user.findMany({ orderBy: { lastName: "asc" } });

  return (
    <div>
      <PageHeader title="Utilisateurs et rôles" subtitle="RBAC : SUPER_ADMIN, MEETING_ADMIN, ORGANIZER, SECRETARY, AUDITOR, USER." />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-mint text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-line">
                  <td className="px-4 py-3 font-semibold">{user.lastName} {user.firstName}</td>
                  <td>{user.email}</td>
                  <td>{ROLE_LABELS[user.role]}</td>
                  <td>{user.active ? "Actif" : "Inactif"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <h2 className="font-display text-xl">Créer un utilisateur</h2>
          <UserForm />
        </Card>
      </div>
    </div>
  );
}
