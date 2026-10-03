import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { pdfTemplateSchema } from "@/lib/validators";
import { getTemplate, isTemplateKind } from "@/server/services/pdf-templates";
import { mergeTemplate, renderTemplatePreview } from "@/server/services/pdf-preview";
import { readJsonBody } from "@/lib/http";

/** Aperçu avec des données fictives : rien n'est enregistré ni journalisé. */
export async function POST(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const gate = await requireApiPermission("documents.manage");
  if (gate.error) return gate.error;
  const { kind } = await params;
  if (!isTemplateKind(kind)) return NextResponse.json({ error: "Modèle inconnu" }, { status: 404 });
  const base = await getTemplate(kind);
  const body = await readJsonBody(request, 256 * 1024);
  let template = base;
  if (body) {
    const parsed = pdfTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
    }
    template = mergeTemplate(base, parsed.data);
  }
  const buffer = await renderTemplatePreview(template, gate.session.user);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="apercu-${kind.toLowerCase()}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
