import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { pdfTemplateSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import type { Role } from "@prisma/client";
import { getTemplate, invalidateTemplates, isTemplateKind, LOCKED_TEMPLATE_KINDS, type TemplateKind } from "@/server/services/pdf-templates";
import { mergeTemplate } from "@/server/services/pdf-preview";
import { readJsonBody } from "@/lib/http";

const AUDITED = ["title", "subtitle", "headerNote", "footerText", "accentColor", "columns", "showVerificationQr", "ctaText", "steps", "showUrl"] as const;

function lockedTemplateError(kind: TemplateKind, role: Role) {
  if (!LOCKED_TEMPLATE_KINDS.includes(kind) || role === "SUPER_ADMIN") return null;
  return NextResponse.json(
    { error: "Le modèle de la liste officielle ne peut être modifié que par un super administrateur." },
    { status: 403 },
  );
}

function snapshot(template: Awaited<ReturnType<typeof getTemplate>>) {
  return Object.fromEntries(AUDITED.map((key) => [key, template[key]]));
}

export async function PUT(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const gate = await requireApiPermission("documents.manage");
  if (gate.error) return gate.error;
  const { kind } = await params;
  if (!isTemplateKind(kind)) return NextResponse.json({ error: "Modèle inconnu" }, { status: 404 });
  const locked = lockedTemplateError(kind, gate.session.user.role);
  if (locked) return locked;
  const parsed = pdfTemplateSchema.safeParse(await readJsonBody(request, 256 * 1024));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  const before = await getTemplate(kind);
  const next = mergeTemplate(before, parsed.data);
  if (kind !== "QR_POSTER" && next.columns.length === 0) {
    return NextResponse.json({ error: "Sélectionnez au moins une colonne en plus du nom." }, { status: 400 });
  }

  const data = {
    title: next.title,
    subtitle: next.subtitle || null,
    headerNote: next.headerNote || null,
    footerText: next.footerText || null,
    accentColor: next.accentColor,
    options: {
      columns: next.columns,
      showVerificationQr: next.showVerificationQr,
      ctaText: next.ctaText,
      steps: next.steps,
      showUrl: next.showUrl,
    },
    updatedById: gate.session.user.id,
  };
  const record = await prisma.pdfTemplate.upsert({ where: { kind }, update: data, create: { kind, ...data } });
  invalidateTemplates();

  const oldValues = snapshot(before);
  const newValues = snapshot(next);
  const changed = AUDITED.filter((key) => JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key]));
  if (changed.length > 0) {
    await writeAudit({
      actorId: gate.session.user.id,
      action: "pdf_template.update",
      entity: "PdfTemplate",
      entityId: record.id,
      beforeData: Object.fromEntries(changed.map((key) => [key, oldValues[key]])),
      afterData: Object.fromEntries(changed.map((key) => [key, newValues[key]])),
    });
  }
  return NextResponse.json({ ok: true, changed: changed.length });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const gate = await requireApiPermission("documents.manage");
  if (gate.error) return gate.error;
  const { kind } = await params;
  if (!isTemplateKind(kind)) return NextResponse.json({ error: "Modèle inconnu" }, { status: 404 });
  const locked = lockedTemplateError(kind, gate.session.user.role);
  if (locked) return locked;
  const record = await prisma.pdfTemplate.findUnique({ where: { kind } });
  if (!record) return NextResponse.json({ ok: true, unchanged: true });
  const before = await getTemplate(kind);
  await prisma.pdfTemplate.delete({ where: { kind } });
  invalidateTemplates();
  const after = await getTemplate(kind);
  const oldValues = snapshot(before);
  const newValues = snapshot(after);
  const changed = AUDITED.filter((key) => JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key]));
  await writeAudit({
    actorId: gate.session.user.id,
    action: "pdf_template.reset",
    entity: "PdfTemplate",
    entityId: record.id,
    beforeData: { kind, ...Object.fromEntries(changed.map((key) => [key, oldValues[key]])) },
    afterData: { kind, ...Object.fromEntries(changed.map((key) => [key, newValues[key]])) },
  });
  return NextResponse.json({ ok: true });
}
