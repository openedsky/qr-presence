import { AdminShell } from "@/components/admin-shell";
import { requireSession } from "@/lib/guards";
import { canAccessBackoffice, ROLE_LABELS } from "@/lib/rbac";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!canAccessBackoffice(session.user.role)) redirect("/login");

  return (
    <AdminShell
      userName={`${session.user.firstName} ${session.user.lastName}`}
      role={ROLE_LABELS[session.user.role]}
    >
      {children}
    </AdminShell>
  );
}
