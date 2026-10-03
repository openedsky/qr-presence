import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { structurePatchSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import { invalidateStructures, normalizeLabel } from "@/server/services/structures";
import { readJsonBody } from "@/lib/http";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireApiPermission("settings.manage");
  if (gate.error) return gate.error;
  const { id } = await params;
  const parsed = structurePatchSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  const current = await prisma.structure.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Structure introuvable" }, { status: 404 });
  if (parsed.data.name) {
    const target = normalizeLabel(parsed.data.name);
    const others = await prisma.structure.findMany({ where: { id: { not: id } }, select: { name: true } });
    if (others.some((row) => normalizeLabel(row.name) === target)) {
      return NextResponse.json({ error: "Cette structure existe déjà." }, { status: 409 });
    }
  }
  const updated = await prisma.structure.update({ where: { id }, data: parsed.data });
  invalidateStructures();
  await writeAudit({
    actorId: gate.session.user.id,
    action: "structure.update",
    entity: "Structure",
    entityId: id,
    beforeData: { name: current.name, internal: current.internal, active: current.active },
    afterData: { name: updated.name, internal: updated.internal, active: updated.active },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireApiPermission("settings.manage");
  if (gate.error) return gate.error;
  const { id } = await params;
  const current = await prisma.structure.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Structure introuvable" }, { status: 404 });
  await prisma.structure.delete({ where: { id } });
  invalidateStructures();
  await writeAudit({
    actorId: gate.session.user.id,
    action: "structure.delete",
    entity: "Structure",
    entityId: id,
    beforeData: { name: current.name, internal: current.internal, active: current.active },
  });
  return NextResponse.json({ ok: true });
}
