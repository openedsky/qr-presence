import { redirect } from "next/navigation";
import { auth } from "./auth";
import { hasPermission, type Permission } from "./rbac";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, permission)) {
    redirect("/dashboard?interdit=1");
  }
  return session;
}
