import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { getSettings, invalidateSettings } from "@/server/services/settings";
import { invalidateBranding, parseLogoDataUrl } from "@/server/services/branding";
import { readJsonBody } from "@/lib/http";

const logoSchema = z.object({
  /** Absent : logo inchangé ; null : retour au logo par défaut ; chaîne : nouveau logo (data URL). */
  logoData: z.string().max(1_500_000).nullable().optional(),
  qrLogoEnabled: z.boolean(),
});

function describe(logoData: string | null) {
  if (!logoData) return "Logo SODEFOR par défaut";
  const digest = createHash("sha256").update(logoData).digest("hex").slice(0, 10);
  return `Logo personnalisé (${Math.round((logoData.length * 3) / 4 / 1024)} Ko, empreinte ${digest})`;
}

export async function PUT(request: Request) {
  const gate = await requireApiPermission("settings.manage");
  if (gate.error) return gate.error;
  const parsed = logoSchema.safeParse(await readJsonBody(request, 2 * 1024 * 1024));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  const { logoData, qrLogoEnabled } = parsed.data;
  if (typeof logoData === "string") {
    const logo = parseLogoDataUrl(logoData);
    if ("error" in logo) return NextResponse.json({ error: logo.error }, { status: 400 });
  }

  const settings = await getSettings();
  const current = await prisma.organizationSetting.findUniqueOrThrow({
    where: { id: settings.id },
    select: { logoData: true, qrLogoEnabled: true },
  });
  const nextLogo = logoData === undefined ? current.logoData : logoData;
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  if (nextLogo !== current.logoData) {
    before.logo = describe(current.logoData);
    after.logo = describe(nextLogo);
  }
  if (qrLogoEnabled !== current.qrLogoEnabled) {
    before.qrLogoEnabled = current.qrLogoEnabled;
    after.qrLogoEnabled = qrLogoEnabled;
  }
  if (Object.keys(after).length === 0) return NextResponse.json({ ok: true, unchanged: true });

  await prisma.organizationSetting.update({
    where: { id: settings.id },
    data: { logoData: nextLogo, qrLogoEnabled },
  });
  invalidateSettings();
  invalidateBranding();
  await writeAudit({
    actorId: gate.session.user.id,
    action: "settings.logo_update",
    entity: "OrganizationSetting",
    entityId: settings.id,
    beforeData: before,
    afterData: after,
  });
  return NextResponse.json({ ok: true });
}
