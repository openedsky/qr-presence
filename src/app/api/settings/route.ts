import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { appearanceSchema, settingsSchema } from "@/lib/validators";
import { diffForAudit } from "@/lib/audit-format";
import { getSettings, invalidateSettings } from "@/server/services/settings";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { readJsonBody } from "@/lib/http";

export async function PATCH(request: Request) {
  const gate = await requireApiPermission("settings.manage");
  if (gate.error) return gate.error;
  const parsed = settingsSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  return saveSettings(gate.session.user.id, parsed.data);
}

export async function PUT(request: Request) {
  const gate = await requireApiPermission("settings.manage");
  if (gate.error) return gate.error;
  const parsed = appearanceSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  return saveSettings(gate.session.user.id, parsed.data);
}

async function saveSettings(actorId: string, data: Record<string, unknown>) {
  const current = await getSettings();
  const diff = diffForAudit(current as Record<string, unknown>, data);
  if (diff.changed.length === 0) return NextResponse.json({ ok: true, unchanged: true });
  await prisma.organizationSetting.update({ where: { id: current.id }, data });
  invalidateSettings();
  await writeAudit({
    actorId,
    action: "settings.update",
    entity: "OrganizationSetting",
    entityId: current.id,
    beforeData: diff.beforeData,
    afterData: diff.afterData,
  });
  return NextResponse.json({ ok: true });
}
