import type { PdfTemplate } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { invalidateMemo, memo } from "@/lib/memo-cache";
import { LIST_COLUMNS, PUBLIC_LIST_COLUMNS } from "@/lib/validators";

export const TEMPLATE_KINDS = ["LISTE_OFFICIELLE", "LISTE_PROVISOIRE", "LISTE_PUBLIQUE", "QR_POSTER"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];
export type ListColumn = (typeof LIST_COLUMNS)[number];

export type ResolvedTemplate = {
  kind: TemplateKind;
  id: string | null;
  title: string;
  subtitle: string;
  headerNote: string;
  footerText: string;
  accentColor: string;
  columns: ListColumn[];
  showVerificationQr: boolean;
  ctaText: string;
  steps: string[];
  showUrl: boolean;
  updatedAt: Date | null;
};

export const TEMPLATE_META: Record<TemplateKind, { label: string; description: string; allowedColumns: readonly ListColumn[] }> = {
  LISTE_OFFICIELLE: {
    label: "Liste officielle",
    description: "Générée à la clôture, versionnée, avec signatures et QR de vérification.",
    allowedColumns: LIST_COLUMNS,
  },
  LISTE_PROVISOIRE: {
    label: "Liste provisoire",
    description: "Éditée avant la clôture, filigrane « PROVISOIRE » : ne fait pas foi.",
    allowedColumns: LIST_COLUMNS,
  },
  LISTE_PUBLIQUE: {
    label: "Liste publique",
    description: "Publiée sans données personnelles : jamais d'email, de téléphone ni de signature.",
    allowedColumns: PUBLIC_LIST_COLUMNS,
  },
  QR_POSTER: {
    label: "Affiche QR code",
    description: "Fiche A4 imprimable à afficher en salle pour l'émargement.",
    allowedColumns: [],
  },
};

/** Minimisation des données : les coordonnées ne figurent sur les listes que si un administrateur les ajoute. */
const DEFAULT_LIST_COLUMNS: ListColumn[] = ["civility", "jobTitle", "organization", "signature", "time"];

/** Modèle de la liste officielle : modifiable par un super administrateur uniquement. */
export const LOCKED_TEMPLATE_KINDS: readonly TemplateKind[] = ["LISTE_OFFICIELLE"];

const DEFAULTS: Record<TemplateKind, Omit<ResolvedTemplate, "kind" | "id" | "updatedAt">> = {
  LISTE_OFFICIELLE: {
    title: "Liste de présence officielle",
    subtitle: "",
    headerNote: "République de Côte d'Ivoire",
    footerText: "",
    accentColor: "#14532d",
    columns: [...DEFAULT_LIST_COLUMNS],
    showVerificationQr: true,
    ctaText: "",
    steps: [],
    showUrl: false,
  },
  LISTE_PROVISOIRE: {
    title: "Liste de présence provisoire",
    subtitle: "",
    headerNote: "République de Côte d'Ivoire",
    footerText: "",
    accentColor: "#14532d",
    columns: [...DEFAULT_LIST_COLUMNS],
    showVerificationQr: true,
    ctaText: "",
    steps: [],
    showUrl: false,
  },
  LISTE_PUBLIQUE: {
    title: "Liste de présence — version publique",
    subtitle: "",
    headerNote: "République de Côte d'Ivoire",
    footerText: "",
    accentColor: "#14532d",
    columns: [...PUBLIC_LIST_COLUMNS],
    showVerificationQr: false,
    ctaText: "",
    steps: [],
    showUrl: false,
  },
  QR_POSTER: {
    title: "Liste de présence",
    subtitle: "Société de Développement des Forêts",
    headerNote: "République de Côte d'Ivoire",
    footerText: "Données traitées conformément à la politique de confidentialité SODEFOR",
    accentColor: "#14532d",
    columns: [],
    showVerificationQr: false,
    ctaText: "Scannez le QR code pour vous inscrire",
    steps: ["1. Scannez le code", "2. Complétez le formulaire", "3. Signez sur l'écran"],
    showUrl: true,
  },
};

type Options = Partial<Pick<ResolvedTemplate, "columns" | "showVerificationQr" | "ctaText" | "steps" | "showUrl">>;

/** La colonne signature ne peut pas être retirée de la liste officielle. */
function withLockedColumns(kind: TemplateKind, columns: ListColumn[]) {
  return kind === "LISTE_OFFICIELLE" && !columns.includes("signature") ? [...columns, "signature" as const] : columns;
}

export function resolveTemplate(kind: TemplateKind, record: PdfTemplate | null): ResolvedTemplate {
  const base = DEFAULTS[kind];
  const options = (record?.options ?? {}) as Options;
  const allowed = TEMPLATE_META[kind].allowedColumns;
  return {
    kind,
    id: record?.id ?? null,
    title: record?.title || base.title,
    subtitle: record ? (record.subtitle ?? "") : base.subtitle,
    headerNote: record ? (record.headerNote ?? "") : base.headerNote,
    footerText: record ? (record.footerText ?? "") : base.footerText,
    accentColor: record?.accentColor || base.accentColor,
    columns: withLockedColumns(kind, (options.columns ?? base.columns).filter((column) => allowed.includes(column))),
    showVerificationQr:
      kind === "LISTE_PUBLIQUE" ? false : kind === "LISTE_OFFICIELLE" ? true : (options.showVerificationQr ?? base.showVerificationQr),
    ctaText: options.ctaText ?? base.ctaText,
    steps: options.steps ?? base.steps,
    showUrl: options.showUrl ?? base.showUrl,
    updatedAt: record?.updatedAt ?? null,
  };
}

export function getTemplate(kind: TemplateKind) {
  return memo(`pdf-template:${kind}`, 60_000, async () =>
    resolveTemplate(kind, await prisma.pdfTemplate.findUnique({ where: { kind } })),
  );
}

export function invalidateTemplates() {
  invalidateMemo("pdf-template:");
}

export async function listTemplates() {
  const records = await prisma.pdfTemplate.findMany();
  return TEMPLATE_KINDS.map((kind) => resolveTemplate(kind, records.find((record) => record.kind === kind) ?? null));
}

export function isTemplateKind(value: string): value is TemplateKind {
  return (TEMPLATE_KINDS as readonly string[]).includes(value);
}

/** Couleur #RRGGBB -> composantes 0..1 pour pdf-lib. */
export function hexToRgb01(hex: string) {
  const clean = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#14532d";
  return [1, 3, 5].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255) as [number, number, number];
}
