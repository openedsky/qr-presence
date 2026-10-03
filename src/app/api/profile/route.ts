import { NextResponse } from "next/server";
import { auth, invalidateUserCache } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileSchema } from "@/lib/validators";
import { isValidPhone } from "@/lib/phone";
import { diffForAudit } from "@/lib/audit-format";
import { writeAudit } from "@/lib/audit";
import { readJsonBody } from "@/lib/http";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const parsed = profileSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  if (parsed.data.phone && !isValidPhone(parsed.data.phone)) {
    return NextResponse.json({ error: "Numéro de téléphone invalide" }, { status: 400 });
  }
  const current = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!current) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  const next = {
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName.toUpperCase(),
    jobTitle: parsed.data.jobTitle || null,
    organization: parsed.data.organization || null,
    phone: parsed.data.phone || null,
  };
  const diff = diffForAudit(current, next);
  if (diff.changed.length === 0) return NextResponse.json({ ok: true, unchanged: true });

  await prisma.user.update({ where: { id: current.id }, data: next });
  invalidateUserCache(current.id);
  await writeAudit({
    actorId: current.id,
    action: "profile.update",
    entity: "User",
    entityId: current.id,
    beforeData: diff.beforeData,
    afterData: diff.afterData,
  });
  return NextResponse.json({ ok: true });
}
