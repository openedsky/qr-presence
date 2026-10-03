import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth, invalidateUserCache } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { passwordChangeSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/http";
import { deleteSecretFile } from "@/lib/secret-file";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const limited = await rateLimit(`password-change:${session.user.id}`, 5, 15 * 60);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, { status: 429 });
  }

  const parsed = passwordChangeSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Le mot de passe actuel est incorrect." }, { status: 400 });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.newPassword, 12),
      passwordChangedAt: new Date(),
      mustChangePassword: false,
      sessionVersion: { increment: 1 },
    },
  });
  invalidateUserCache(user.id);
  if (user.role === "SUPER_ADMIN" && user.mustChangePassword) await deleteSecretFile("admin-temporary-password.txt");
  await writeAudit({
    actorId: user.id,
    action: "profile.password_change",
    entity: "User",
    entityId: user.id,
    afterData: { sessions: "toutes les sessions ouvertes ont été fermées" },
  });
  return NextResponse.json({ ok: true, reauth: true });
}
