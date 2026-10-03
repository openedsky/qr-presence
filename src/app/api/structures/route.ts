import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { structureSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import { invalidateStructures, normalizeLabel } from "@/server/services/structures";
import { readJsonBody } from "@/lib/http";

export async function GET() {
  const gate = await requireApiPermission("settings.manage");
  if (gate.error) return gate.error;
  return NextResponse.json(await prisma.structure.findMany({ orderBy: { name: "asc" } }));
}

export async function POST(request: Request) {
  const gate = await requireApiPermission("settings.manage");
  if (gate.error) return gate.error;
  const parsed = structureSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  const existing = await prisma.structure.findMany({ select: { name: true } });
  const target = normalizeLabel(parsed.data.name);
  if (existing.some((row) => normalizeLabel(row.name) === target)) {
    return NextResponse.json({ error: "Cette structure existe déjà." }, { status: 409 });
  }
  const structure = await prisma.structure.create({ data: parsed.data });
  invalidateStructures();
  await writeAudit({
    actorId: gate.session.user.id,
    action: "structure.create",
    entity: "Structure",
    entityId: structure.id,
    afterData: parsed.data,
  });
  return NextResponse.json(structure);
}
