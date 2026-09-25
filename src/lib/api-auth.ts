import { NextResponse } from "next/server";
import { auth } from "./auth";
import { hasPermission, type Permission } from "./rbac";

export async function requireApiPermission(permission: Permission) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  }
  if (!hasPermission(session.user.role, permission)) {
    return { error: NextResponse.json({ error: "Accès interdit" }, { status: 403 }) };
  }
  return { session };
}
