import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guards";
import { Card, PageHeader } from "@/components/ui";
import { UserForm } from "./user-form";
import { UsersTable, type UserRow } from "./users-table";

export default async function UsersPage() {
  const session = await requirePermission("users.manage");
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { lastName: "asc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      organization: true,
      phone: true,
      role: true,
      active: true,
      lockedUntil: true,
      mustChangePassword: true,
      lastLoginAt: true,
    },
  });
  const now = new Date();
  const rows: UserRow[] = users.map(({ lockedUntil, lastLoginAt, ...user }) => ({
    ...user,
    locked: Boolean(lockedUntil && lockedUntil > now),
    lastLoginAt: lastLoginAt?.toISOString() ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="Utilisateurs et rôles"
        subtitle="Créez les comptes, ajustez les rôles, réinitialisez un mot de passe ou désactivez un accès. Toute action est tracée."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-x-auto p-0">
          <UsersTable users={rows} currentUserId={session.user.id} />
        </Card>
        <Card>
          <h2 className="font-display text-xl">Créer un utilisateur</h2>
          <UserForm />
        </Card>
      </div>
    </div>
  );
}
