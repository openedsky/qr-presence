import Link from "next/link";
import { FileBadge2, FileClock, FileLock2, QrCode } from "lucide-react";
import { requirePermission } from "@/lib/guards";
import { PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";
import { auditDateTime } from "@/components/audit-views";
import {
  isTemplateKind,
  listTemplates,
  LOCKED_TEMPLATE_KINDS,
  TEMPLATE_META,
  type TemplateKind,
} from "@/server/services/pdf-templates";
import { TemplateEditor } from "./template-editor";

const ICONS: Record<TemplateKind, typeof QrCode> = {
  LISTE_OFFICIELLE: FileBadge2,
  LISTE_PROVISOIRE: FileClock,
  LISTE_PUBLIQUE: FileLock2,
  QR_POSTER: QrCode,
};

export const metadata = { title: "Modèles PDF" };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const session = await requirePermission("documents.manage");
  const { kind: rawKind } = await searchParams;
  const templates = await listTemplates();
  const kind: TemplateKind = rawKind && isTemplateKind(rawKind) ? rawKind : "LISTE_OFFICIELLE";
  const current = templates.find((template) => template.kind === kind)!;
  const meta = TEMPLATE_META[kind];

  return (
    <div>
      <PageHeader
        title="Modèles PDF"
        subtitle="Personnalisez les documents générés : en-tête, titre, colonnes, couleur et pied de page. Chaque modification est tracée dans le journal d'audit."
      />
      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <nav className="flex flex-col gap-2">
          {templates.map((template) => {
            const Icon = ICONS[template.kind];
            const active = template.kind === kind;
            return (
              <Link
                key={template.kind}
                href={`/documents?kind=${template.kind}`}
                className={cn(
                  "card flex items-start gap-3 p-4 transition",
                  active ? "border-leaf ring-2 ring-leaf/20" : "hover:border-leaf/50",
                )}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ background: template.accentColor }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{TEMPLATE_META[template.kind].label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted">{TEMPLATE_META[template.kind].description}</p>
                  <p className="mt-1.5 text-[11px] font-semibold text-leaf">
                    {template.updatedAt ? `Personnalisé le ${auditDateTime(template.updatedAt)}` : "Modèle par défaut"}
                  </p>
                </div>
              </Link>
            );
          })}
        </nav>
        <TemplateEditor
          // Remonté après enregistrement ou réinitialisation : le formulaire reflète le modèle réellement en base.
          key={`${kind}:${current.updatedAt ? new Date(current.updatedAt).getTime() : "defaut"}`}
          kind={kind}
          label={meta.label}
          allowedColumns={[...meta.allowedColumns]}
          customized={Boolean(current.updatedAt)}
          readOnly={LOCKED_TEMPLATE_KINDS.includes(kind) && session.user.role !== "SUPER_ADMIN"}
          initial={{
            title: current.title,
            subtitle: current.subtitle,
            headerNote: current.headerNote,
            footerText: current.footerText,
            accentColor: current.accentColor,
            columns: current.columns,
            showVerificationQr: current.showVerificationQr,
            ctaText: current.ctaText,
            steps: [0, 1, 2].map((i) => current.steps[i] ?? ""),
            showUrl: current.showUrl,
          }}
        />
      </div>
    </div>
  );
}
