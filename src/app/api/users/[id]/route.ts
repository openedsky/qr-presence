import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { userPatchSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import { invalidateUserCache } from "@/lib/auth";
import { generateTemporaryPassword } from "@/lib/temp-password";
import { diffForAudit } from "@/lib/audit-format";
import { readJsonBody } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

class LastAdminError extends Error {}

export async function PATCH(request: Request, { params }: Params) {
  const gate = await requireApiPermission("users.manage");
  if (gate.error) return gate.error;
  const { id } = await params;
  const parsed = userPatchSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  const input = parsed.data;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  const self = user.id === gate.session.user.id;
  const demoted = input.role !== undefined && input.role !== user.role;
  const deactivated = input.active === false && user.active;
  if (self && (demoted || deactivated)) {
    return NextResponse.json(
      { error: "Vous ne pouvez ni changer votre propre rôle ni désactiver votre propre compte." },
      { status: 400 },
    );
  }
  const removesAdmin = user.role === "SUPER_ADMIN" && user.active && ((demoted && input.role !== "SUPER_ADMIN") || deactivated);

  const data: Prisma.UserUpdateInput = {};
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.jobTitle !== undefined) data.jobTitle = input.jobTitle || null;
  if (input.organization !== undefined) data.organization = input.organization || null;
  if (input.phone !== undefined) data.phone = input.phone || null;
  if (input.role !== undefined) data.role = input.role;
  if (input.active !== undefined) data.active = input.active;
  if (input.unlock) {
    data.failedLoginCount = 0;
    data.lastFailedLoginAt = null;
    data.lockedUntil = null;
  }

  let temporaryPassword: string | undefined;
  if (input.resetPassword) {
    const generated = generateTemporaryPassword();
    temporaryPassword = generated;
    data.passwordHash = await bcrypt.hash(generated, 12);
    data.passwordChangedAt = new Date();
    data.mustChangePassword = true;
    data.failedLoginCount = 0;
    data.lastFailedLoginAt = null;
    data.lockedUntil = null;
  }
  if (demoted || input.active !== undefined || input.resetPassword) {
    data.sessionVersion = { increment: 1 };
  }

  // Super administrateurs actifs verrouillés pendant la vérification : deux rétrogradations simultanées
  // ne peuvent pas retirer chacune « l'autre » dernier administrateur.
  const updated = await prisma.$transaction(async (tx) => {
    if (removesAdmin) {
      const admins = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM User WHERE role = 'SUPER_ADMIN' AND active = 1 FOR UPDATE`;
      if (!admins.some((admin) => admin.id !== id)) throw new LastAdminError();
    }
    return tx.user.update({ where: { id }, data });
  }).catch((error) => {
    if (error instanceof LastAdminError) return null;
    throw error;
  });
  if (!updated) {
    return NextResponse.json({ error: "Impossible : c'est le dernier super administrateur actif." }, { status: 400 });
  }
  invalidateUserCache(id);

  const tracked = ["firstName", "lastName", "jobTitle", "organization", "phone", "role", "active"] as const;
  const pick = (source: typeof user): Record<string, unknown> =>
    Object.fromEntries(tracked.map((key) => [key, source[key]]));
  const { beforeData: before, afterData: after } = diffForAudit(pick(user), pick(updated));
  const action = input.resetPassword
    ? "user.password_reset"
    : input.unlock && Object.keys(after).length === 0
      ? "user.unlock"
      : "user.update";
  await writeAudit({
    actorId: gate.session.user.id,
    action,
    entity: "User",
    entityId: id,
    beforeData: before,
    afterData: {
      ...after,
      ...(input.resetPassword ? { password: "mot de passe provisoire généré" } : {}),
      ...(input.unlock ? { verrouillage: "levé" } : {}),
    },
  });
  return NextResponse.json({ ok: true, temporaryPassword });
}
