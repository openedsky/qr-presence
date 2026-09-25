import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { settingsSchema } from "@/lib/validators";
import { getSettings } from "@/server/services/settings";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

export async function PATCH(request: Request) {
  const gate = await requireApiPermission("settings.manage");
  if (gate.error) return gate.error;
  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  const current = await getSettings();
  await prisma.organizationSetting.update({
    where: { id: current.id },
    data: parsed.data,
  });
  await writeAudit({
    actorId: gate.session.user.id,
    action: "settings.update",
    entity: "OrganizationSetting",
    entityId: current.id,
    beforeData: current,
    afterData: parsed.data,
  });
  return NextResponse.json({ ok: true });
}
