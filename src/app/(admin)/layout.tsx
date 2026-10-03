import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { SIDEBAR_COOKIE } from "@/lib/ui-prefs";
import { requireSession } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { canAccessBackoffice, hasPermission, ROLE_LABELS, type Permission } from "@/lib/rbac";

// Droits utiles au menu et à la visite guidée (étapes adaptées au rôle).
const MENU_PERMISSIONS: Permission[] = [
  "stats.read",
  "users.manage",
  "audit.read",
  "history.global",
  "documents.manage",
  "settings.manage",
  "meetings.create",
  "qr.display",
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!canAccessBackoffice(session.user.role)) redirect("/login");
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";
  const permissions = MENU_PERMISSIONS.filter((permission) => hasPermission(session.user.role, permission));
  // Proposée après le changement du mot de passe provisoire, jamais par-dessus.
  const account = session.user.mustChangePassword
    ? null
    : await prisma.user.findUnique({ where: { id: session.user.id }, select: { onboardingCompletedAt: true } });
  const showOnboarding = Boolean(account && !account.onboardingCompletedAt);

  return (
    <AdminShell
      userName={`${session.user.firstName} ${session.user.lastName}`}
      role={ROLE_LABELS[session.user.role]}
      email={session.user.email}
      permissions={permissions}
      initialCollapsed={collapsed}
      showOnboarding={showOnboarding}
    >
      {children}
    </AdminShell>
  );
}
