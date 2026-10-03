import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { meetingTypePatchSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import { diffForAudit } from "@/lib/audit-format";
import { readJsonBody } from "@/lib/http";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireApiPermission("settings.manage");
  if (gate.error) return gate.error;
  const { id } = await params;
  const current = await prisma.meetingTypeOption.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Type introuvable" }, { status: 404 });
  const parsed = meetingTypePatchSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  if (parsed.data.active === false && current.active) {
    const remaining = await prisma.meetingTypeOption.count({ where: { active: true, id: { not: id } } });
    if (remaining === 0) {
      return NextResponse.json({ error: "Au moins un type de réunion doit rester actif." }, { status: 409 });
    }
  }
  const diff = diffForAudit(current, parsed.data);
  if (diff.changed.length === 0) return NextResponse.json(current);
  const updated = await prisma.meetingTypeOption.update({ where: { id }, data: parsed.data });
  await writeAudit({
    actorId: gate.session.user.id,
    action: "meeting_type.update",
    entity: "MeetingTypeOption",
    entityId: id,
    beforeData: { label: current.label, ...diff.beforeData },
    afterData: { label: updated.label, ...diff.afterData },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireApiPermission("settings.manage");
  if (gate.error) return gate.error;
  const { id } = await params;
  const current = await prisma.meetingTypeOption.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Type introuvable" }, { status: 404 });
  const used = await prisma.meeting.count({ where: { type: current.code } });
  if (used > 0) {
    return NextResponse.json(
      { error: `Ce type est utilisé par ${used} réunion(s) : désactivez-le plutôt que de le supprimer.` },
      { status: 409 },
    );
  }
  if (current.active && (await prisma.meetingTypeOption.count({ where: { active: true } })) <= 1) {
    return NextResponse.json({ error: "Au moins un type de réunion doit rester actif." }, { status: 409 });
  }
  await prisma.meetingTypeOption.delete({ where: { id } });
  await writeAudit({
    actorId: gate.session.user.id,
    action: "meeting_type.delete",
    entity: "MeetingTypeOption",
    entityId: id,
    beforeData: { code: current.code, label: current.label, color: current.color, active: current.active },
  });
  return NextResponse.json({ ok: true });
}
