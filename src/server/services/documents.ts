import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont } from "pdf-lib";
import QRCode from "qrcode";
import ExcelJS from "exceljs";
import { createHash, randomUUID } from "crypto";
import { type Attendance, type GeneratedDocument, type Meeting, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteObject, getObjectBuffer, meetingObjectKey, putObject } from "@/lib/storage";
import { cacheDelIfEquals, cacheGet, cacheSet, cacheSetNx } from "@/lib/redis";
import { writeAudit } from "@/lib/audit";
import { mapWithLimit } from "@/lib/concurrency";
import { imageWithinLimits, SIGNATURE_LIMITS } from "@/lib/image-size";
import { logger } from "@/lib/logger";
import { isFrozen } from "@/lib/meeting-status";
import { formatDate, formatDateTime, formatTime } from "@/lib/utils";
import { verifyDocumentUrl } from "@/lib/tokens";
import { getSettings } from "./settings";
import { getTemplate, hexToRgb01, type ListColumn, type ResolvedTemplate, type TemplateKind } from "./pdf-templates";
import { LIST_COLUMNS } from "@/lib/validators";
import { ATTENDANCE_ORDER } from "./attendances";

const LIST_ORDER = LIST_COLUMNS;

export type ListKind = "official" | "provisional" | "public";

const INK = rgb(0.11, 0.14, 0.12);
const MUTED = rgb(0.35, 0.4, 0.36);
const DANGER = rgb(0.72, 0.11, 0.11);

// Actions qui modifient le contenu d'une liste : elles rendent la version officielle courante périmée.
const CONTENT_ACTIONS = [
  "attendance.create",
  "attendance.update",
  "attendance.cancel",
  "attendance.post_close_create",
  "attendance.post_close_update",
  "attendance.post_close_cancel",
];

const TYPE_BY_KIND = {
  official: "LISTE_OFFICIELLE",
  provisional: "LISTE_PROVISOIRE",
  public: "LISTE_PUBLIQUE",
} as const;

/** Les polices PDF standard ne couvrent que WinAnsi. */
function pdfText(value: string) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u202F\u2009]/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF\u2013\u2014\u2026\u20AC\u0152\u0153]/g, "");
}

function civilityLabel(value: string) {
  return value === "M" ? "M." : value === "MME" ? "Mme" : "Mlle";
}

const SIGNATURE_FETCH_CONCURRENCY = 8;

/** Lecture des signatures en parallèle (stockage objet) avant le rendu, qui reste séquentiel. */
async function fetchSignatures(keys: (string | null)[]) {
  const unique = [...new Set(keys.filter((key): key is string => Boolean(key)))];
  const buffers = await mapWithLimit(unique, SIGNATURE_FETCH_CONCURRENCY, (key) => getObjectBuffer(key).catch(() => null));
  return new Map(unique.map((key, index) => [key, buffers[index]]));
}

async function embedSignature(pdf: PDFDocument, buffer: Buffer | null | undefined) {
  // Signatures enregistrées avant le contrôle des dimensions : ignorées plutôt que décodées.
  if (!buffer || !imageWithinLimits(buffer, SIGNATURE_LIMITS)) return null;
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  try {
    return jpeg ? await pdf.embedJpg(buffer) : await pdf.embedPng(buffer);
  } catch {
    return null;
  }
}

/** Découpe un texte en lignes tenant dans la largeur donnée (au plus `maxLines`, la dernière tronquée). */
export function wrapText(text: string, maxWidth: number, size: number, f: PDFFont, maxLines: number) {
  const words = pdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (f.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = `${kept[maxLines - 1]} ${lines.slice(maxLines).join(" ")}`;
  while (last.length > 1 && f.widthOfTextAtSize(`${last}…`, size) > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

const COLUMN_DEFS: Record<ListColumn | "n" | "name", { label: string; w: number }> = {
  n: { label: "N°", w: 24 },
  name: { label: "Nom et prénom", w: 140 },
  civility: { label: "Civ.", w: 30 },
  jobTitle: { label: "Fonction", w: 110 },
  organization: { label: "Structure", w: 110 },
  email: { label: "Email", w: 120 },
  phone: { label: "Contact", w: 82 },
  signature: { label: "Signature", w: 86 },
  time: { label: "Heure", w: 52 },
};

const TEMPLATE_BY_KIND: Record<ListKind, TemplateKind> = {
  official: "LISTE_OFFICIELLE",
  provisional: "LISTE_PROVISOIRE",
  public: "LISTE_PUBLIQUE",
};

/** La liste officielle fait foi : signatures et QR de vérification y figurent toujours, quel que soit le modèle. */
export function lockOfficialTemplate(kind: ListKind, template: ResolvedTemplate): ResolvedTemplate {
  if (kind !== "official") return template;
  const columns: ListColumn[] = template.columns.includes("signature") ? template.columns : [...template.columns, "signature"];
  return { ...template, columns, showVerificationQr: true };
}

export async function renderList(input: {
  meeting: Meeting;
  attendances: Attendance[];
  actor?: Pick<User, "firstName" | "lastName"> | null;
  kind: ListKind;
  documentUuid: string;
  version: number;
  supersedes?: Pick<GeneratedDocument, "version" | "generatedAt"> | null;
  correctionNote?: string | null;
  template?: ResolvedTemplate;
}) {
  const settings = await getSettings();
  const template = lockOfficialTemplate(input.kind, input.template ?? (await getTemplate(TEMPLATE_BY_KIND[input.kind])));
  const ACCENT = rgb(...hexToRgb01(template.accentColor));
  const [ar, ag, ab] = hexToRgb01(template.accentColor);
  const ACCENT_TINT = rgb(ar + (1 - ar) * 0.88, ag + (1 - ag) * 0.88, ab + (1 - ab) * 0.88);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 36;
  const isPublic = input.kind === "public";
  const provisional = input.kind === "provisional" || (isPublic && !isFrozen(input.meeting.status));
  let page = pdf.addPage([841.89, 595.28]);
  let { width, height } = page.getSize();
  let y = height - 32;
  const generatedAt = new Date();
  const verifyUrl = verifyDocumentUrl(input.documentUuid);
  const title = pdfText(template.title.toUpperCase());

  const fit = (text: string, maxWidth: number, size: number, f = font) => {
    let value = pdfText(text);
    if (f.widthOfTextAtSize(value, size) <= maxWidth) return value;
    while (value.length > 1 && f.widthOfTextAtSize(`${value}…`, size) > maxWidth) value = value.slice(0, -1);
    return `${value}…`;
  };

  const drawWatermark = () => {
    if (!provisional) return;
    page.drawText("PROVISOIRE", {
      x: width / 2 - 230,
      y: height / 2 - 120,
      size: 110,
      font: fontBold,
      color: DANGER,
      opacity: 0.08,
      rotate: degrees(20),
    });
  };

  const drawHeader = () => {
    drawWatermark();
    page.drawText(pdfText(settings.ministryName.toUpperCase()), { x: margin, y, size: 9, font: fontBold, color: ACCENT });
    const org = pdfText(settings.organizationName);
    page.drawText(org, { x: width - margin - fontBold.widthOfTextAtSize(org, 11), y, size: 11, font: fontBold, color: ACCENT });
    if (template.headerNote) {
      y -= 11;
      page.drawText(pdfText(template.headerNote), { x: margin, y, size: 7.5, font, color: MUTED });
    }
    y -= 18;
    page.drawText(title, { x: margin, y, size: 16, font: fontBold, color: INK });
    if (input.kind === "official") {
      const version = pdfText(`Version ${input.version}`);
      page.drawText(version, { x: width - margin - fontBold.widthOfTextAtSize(version, 11), y, size: 11, font: fontBold, color: ACCENT });
    }
    if (template.subtitle) {
      y -= 13;
      page.drawText(fit(template.subtitle, width - margin * 2, 9), { x: margin, y, size: 9, font, color: MUTED });
    }
    y -= 16;
    page.drawText(fit(input.meeting.title, width - margin * 2, 11), { x: margin, y, size: 11, font, color: INK });
    y -= 13;
    page.drawText(
      pdfText(`${formatDate(input.meeting.startsAt)}  •  ${input.meeting.location || "Réunion à distance"}  •  ${input.meeting.internalRef}`),
      { x: margin, y, size: 9, font, color: MUTED },
    );
    y -= 13;
    if (provisional) {
      page.drawText(
        pdfText("Document provisoire établi avant la clôture de la réunion : il ne fait pas foi."),
        { x: margin, y, size: 8, font: fontBold, color: DANGER },
      );
      y -= 12;
    }
    if (input.kind === "official" && input.supersedes) {
      page.drawText(
        pdfText(`Annule et remplace la version ${input.supersedes.version} du ${formatDateTime(input.supersedes.generatedAt)}.`),
        { x: margin, y, size: 8, font: fontBold, color: DANGER },
      );
      y -= 11;
      if (input.correctionNote) {
        for (const line of wrapText(`Motif(s) : ${input.correctionNote}`, width - margin * 2, 7, font, 3)) {
          page.drawText(line, { x: margin, y, size: 7, font, color: MUTED });
          y -= 9;
        }
        y -= 2;
      }
    }
    y -= 6;
  };

  drawHeader();

  // Colonnes retenues par le modèle, élargies proportionnellement pour occuper toute la largeur utile.
  const keys: (ListColumn | "n" | "name")[] = ["n", "name", ...LIST_ORDER.filter((key) => template.columns.includes(key))];
  const baseWidth = keys.reduce((sum, key) => sum + COLUMN_DEFS[key].w, 0);
  const scale = (width - margin * 2) / baseWidth;
  const cols = keys.map((key) => ({ key, label: COLUMN_DEFS[key].label, w: COLUMN_DEFS[key].w * scale }));
  const tableWidth = cols.reduce((sum, col) => sum + col.w, 0);

  const drawTableHeader = () => {
    let x = margin;
    page.drawRectangle({ x: margin, y: y - 4, width: tableWidth, height: 16, color: ACCENT_TINT });
    for (const col of cols) {
      page.drawText(pdfText(col.label), { x: x + 3, y, size: 7, font: fontBold, color: ACCENT });
      x += col.w;
    }
    y -= 16;
  };

  drawTableHeader();

  const rows = input.attendances.filter((a) => a.status === "ACTIVE");
  const showSignatures = !isPublic && cols.some((col) => col.key === "signature");
  const signatures = showSignatures ? await fetchSignatures(rows.map((row) => row.signatureObjectKey)) : new Map<string, Buffer | null>();
  const hasManual = !isPublic && rows.some((row) => row.checkInMethod === "ADMIN_MANUAL");

  const footer = (count: number) =>
    pdfText(
      `Réf. ${input.meeting.internalRef}  •  ${count} participant(s)  •  Édité le ${formatDateTime(generatedAt)}  •  ${input.actor ? `${input.actor.firstName} ${input.actor.lastName}` : "Système"}  •  ${input.documentUuid}`,
    );
  const drawFooter = (count: number) => {
    page.drawText(footer(count), { x: margin, y: 28, size: 7, font, color: MUTED });
    const notes = [
      hasManual ? "* Présence saisie par un agent habilité (participant sans smartphone ou saisie dérogatoire tracée)." : "",
      template.footerText ?? "",
    ]
      .filter(Boolean)
      .join("  •  ");
    if (notes) {
      page.drawText(fit(notes, width - margin * 2 - 170, 6.5), { x: margin, y: 17, size: 6.5, font, color: MUTED });
    }
  };
  let index = 1;
  for (const row of rows) {
    if (y < 76) {
      drawFooter(rows.length);
      page = pdf.addPage([841.89, 595.28]);
      ({ width, height } = page.getSize());
      y = height - 32;
      drawHeader();
      drawTableHeader();
    }

    const values: Record<string, string> = {
      n: !isPublic && row.checkInMethod === "ADMIN_MANUAL" ? `${index}*` : String(index),
      name: `${row.lastName} ${row.firstNames}`,
      civility: civilityLabel(row.civility),
      jobTitle: row.jobTitle,
      organization: row.organization,
      email: row.email ?? "",
      phone: row.phone ?? "",
      signature: "",
      time: formatTime(row.checkInAt),
    };

    let x = margin;
    for (const col of cols) {
      if (col.key === "signature") {
        if (showSignatures && row.signatureObjectKey) {
          const img = await embedSignature(pdf, signatures.get(row.signatureObjectKey));
          if (img) page.drawImage(img, { x: x + 4, y: y - 4, width: Math.min(70, col.w - 8), height: 16 });
        }
      } else {
        page.drawText(fit(values[col.key], col.w - 6, 7), { x: x + 3, y, size: 7, font, color: INK });
      }
      x += col.w;
    }

    page.drawLine({
      start: { x: margin, y: y - 7 },
      end: { x: margin + tableWidth, y: y - 7 },
      thickness: 0.3,
      color: rgb(0.86, 0.89, 0.86),
    });
    y -= 18;
    index += 1;
  }

  drawFooter(rows.length);

  if (template.showVerificationQr && !isPublic) {
    const qr = await pdf.embedPng(await QRCode.toBuffer(verifyUrl, { margin: 0, width: 160 }));
    page.drawImage(qr, { x: width - margin - 46, y: 14, width: 46, height: 46 });
    const label = pdfText("Vérifier l'authenticité");
    page.drawText(label, { x: width - margin - 54 - fontBold.widthOfTextAtSize(label, 7), y: 34, size: 7, font: fontBold, color: ACCENT });
  }

  return Buffer.from(await pdf.save());
}

/** Informations de la réunion imprimées sur les listes : seules elles périment la liste officielle. */
export const PRINTED_MEETING_FIELDS = new Set(["title", "internalRef", "startsAt", "location"]);

type ChangeLog = { entity: string; action: string; afterData: unknown };

/** Un changement des informations imprimées de la réunion (objet, date, lieu…) périme aussi la liste. */
function isListRelevantMeetingUpdate(log: ChangeLog) {
  if (log.entity !== "Meeting") return false;
  const after = log.afterData;
  if (!after || typeof after !== "object" || Array.isArray(after)) return true;
  return Object.keys(after).some((field) => PRINTED_MEETING_FIELDS.has(field));
}

/** Modifications du contenu d'une liste depuis `since` (journal indexé par réunion). */
async function contentChangesSince(meetingId: string, since: Date): Promise<ChangeLog[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      meetingId,
      createdAt: { gt: since },
      OR: [
        { entity: "Attendance", action: { in: CONTENT_ACTIONS } },
        { entity: "Meeting", action: "meeting.update" },
      ],
    },
    select: { entity: true, action: true, afterData: true },
    orderBy: { createdAt: "asc" },
  });
  return logs.filter((log) => log.entity === "Attendance" || isListRelevantMeetingUpdate(log));
}

export async function contentChangedSince(meetingId: string, since: Date) {
  return (await contentChangesSince(meetingId, since)).length > 0;
}

function correctionReasons(changes: ChangeLog[]) {
  const reasons = changes
    .filter((log) => log.action.startsWith("attendance.post_close_"))
    .map((log) => (log.afterData as { reason?: string } | null)?.reason)
    .filter((reason): reason is string => Boolean(reason));
  if (changes.some((log) => log.entity === "Attendance" && !log.action.startsWith("attendance.post_close_"))) {
    reasons.push("présences enregistrées ou modifiées pendant la réouverture de la réunion");
  }
  if (changes.some(isListRelevantMeetingUpdate)) reasons.push("informations de la réunion modifiées");
  if (reasons.length === 0) return "corrections tracées dans le journal de la réunion";
  return [...new Set(reasons)].join(" ; ");
}

/** La réunion a été anonymisée : aucune nouvelle liste ne peut être établie à partir des données purgées. */
export class DocumentUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentUnavailableError";
  }
}

/** Une génération officielle est déjà en cours pour cette réunion (verrou partagé non obtenu). */
export class DocumentBusyError extends Error {
  constructor() {
    super("Une liste officielle est en cours d'établissement pour cette réunion : réessayez dans un instant.");
    this.name = "DocumentBusyError";
  }
}

type VersionedDocument = Pick<GeneratedDocument, "meetingId" | "generatedAt" | "contentVersion">;

/** Le contenu de la réunion a changé depuis ce document (version de contenu, journal pour les listes antérieures). */
async function isDocumentStale(document: VersionedDocument, meetingContentVersion: number) {
  if (meetingContentVersion > document.contentVersion) return true;
  if (document.contentVersion === 0 && meetingContentVersion === 0) {
    return contentChangedSince(document.meetingId, document.generatedAt);
  }
  return false;
}

/** Liste officielle en vigueur, mais des corrections postérieures attendent la version suivante. */
export async function isOfficialListOutdated(
  document: Pick<GeneratedDocument, "meetingId" | "generatedAt" | "supersededAt" | "type" | "contentVersion">,
) {
  if (document.type !== "LISTE_OFFICIELLE" || document.supersededAt) return false;
  const meeting = await prisma.meeting.findUnique({ where: { id: document.meetingId }, select: { contentVersion: true } });
  return meeting ? isDocumentStale(document, meeting.contentVersion) : false;
}

/** Rendus PDF simultanés par instance : au-delà, la boucle d'événements et la mémoire saturent (clôtures en rafale). */
const MAX_CONCURRENT_RENDERS = 2;
let activeRenders = 0;
const renderWaiters: (() => void)[] = [];

async function withRenderSlot<T>(job: () => Promise<T>): Promise<T> {
  if (activeRenders >= MAX_CONCURRENT_RENDERS) await new Promise<void>((resolve) => renderWaiters.push(resolve));
  activeRenders += 1;
  try {
    return await job();
  } finally {
    activeRenders -= 1;
    renderWaiters.shift()?.();
  }
}

/** Après un échec, la réunion est mise de côté une heure : des échecs répétés ne monopolisent pas chaque passe. */
const RECONCILE_BACKOFF_SECONDS = 3600;

/**
 * Réunions clôturées ou archivées dont la liste officielle ne reflète plus le contenu (minuteur perdu au
 * redémarrage, échec de génération…) : la liste est rétablie. Appelé périodiquement.
 */
export async function reconcileOfficialLists(limit = 10) {
  // Sans liste officielle : seules les clôtures récentes (les réunions héritées n'en ont jamais eu).
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT m.id FROM Meeting m
    LEFT JOIN (
      SELECT meetingId, MAX(contentVersion) AS v FROM GeneratedDocument
      WHERE type = 'LISTE_OFFICIELLE' GROUP BY meetingId
    ) d ON d.meetingId = m.id
    WHERE m.status IN ('CLOTUREE', 'ARCHIVEE') AND m.purgedAt IS NULL
      AND ((d.v IS NOT NULL AND m.contentVersion > d.v) OR (d.v IS NULL AND m.closedAt > UTC_TIMESTAMP() - INTERVAL 30 DAY))
    ORDER BY m.updatedAt ASC
    LIMIT ${limit * 5}`;
  let refreshed = 0;
  let attempted = 0;
  for (const { id } of rows) {
    if (attempted >= limit) break;
    if (refreshTimers.has(id) || (await cacheGet(`reconcile-backoff:${id}`))) continue;
    attempted += 1;
    const outcome = await establishOfficialList(id);
    if (outcome === "refreshed") refreshed += 1;
    if (outcome === "failed") await cacheSet(`reconcile-backoff:${id}`, "1", RECONCILE_BACKOFF_SECONDS);
  }
  return refreshed;
}

/**
 * Établit (ou confirme) la liste officielle à jour d'une réunion gelée, y compris sans liste antérieure.
 * Utilisé avant la purge : les données ne doivent disparaître qu'une fois la liste probante archivée.
 */
export async function establishOfficialList(meetingId: string): Promise<"reused" | "refreshed" | "failed"> {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting || !isFrozen(meeting.status)) return "failed";
  try {
    const result = await generateListDocument({ meeting, actor: null, kind: "official" });
    return result.reused ? "reused" : "refreshed";
  } catch (error) {
    if (!(error instanceof DocumentBusyError)) {
      logger.error("document.reconcile_failed", { meetingId, error: error instanceof Error ? error.message : String(error) });
    }
    return "failed";
  }
}

const REFRESH_DELAY_MS = 20_000;
const globalForRefresh = globalThis as unknown as { sodeforOfficialRefresh?: Map<string, NodeJS.Timeout> };
const refreshTimers = (globalForRefresh.sodeforOfficialRefresh ??= new Map());

/**
 * Correction après clôture : la version suivante de la liste officielle est établie peu après la dernière
 * correction (plusieurs corrections successives ne produisent qu'une version).
 */
export function scheduleOfficialRefresh(meetingId: string, actorId: string | null) {
  clearTimeout(refreshTimers.get(meetingId));
  const timer = setTimeout(() => {
    refreshTimers.delete(meetingId);
    void (async () => {
      const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
      if (!meeting || meeting.status !== "CLOTUREE" || meeting.purgedAt) return;
      const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId } }) : null;
      await generateListDocument({ meeting, actor, kind: "official" });
    })().catch((error) =>
      logger.error("document.official_refresh_failed", { meetingId, error: error instanceof Error ? error.message : String(error) }),
    );
  }, REFRESH_DELAY_MS);
  timer.unref?.();
  refreshTimers.set(meetingId, timer);
}

/**
 * Liste officielle : générée à la clôture, puis réutilisée telle quelle tant que rien ne change.
 * Toute correction ultérieure produit une version n+1 qui annule et remplace la précédente.
 */
export async function generateListDocument(input: { meeting: Meeting; actor?: User | null; kind: ListKind }) {
  if (input.kind !== "official") return buildListDocument(input);
  // Une seule génération officielle à la fois par réunion : sinon deux exports simultanés
  // (ou clôture + export) produiraient deux « version n+1 ».
  const key = input.meeting.id;
  const run = (officialQueue.get(key) ?? Promise.resolve()).catch(() => undefined).then(() => withOfficialLock(key, () => buildListDocument(input)));
  officialQueue.set(key, run);
  try {
    return await run;
  } finally {
    if (officialQueue.get(key) === run) officialQueue.delete(key);
  }
}

const officialQueue = new Map<string, Promise<unknown>>();

/** Verrou partagé entre instances (Redis) ; en son absence, la file locale ci-dessus suffit. */
async function withOfficialLock<T>(meetingId: string, job: () => Promise<T>): Promise<T> {
  const lockKey = `lock:official-list:${meetingId}`;
  const owner = randomUUID();
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await cacheSetNx(lockKey, owner, 180)) {
      try {
        return await job();
      } finally {
        await cacheDelIfEquals(lockKey, owner);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new DocumentBusyError();
}

async function buildListDocument(input: { meeting: Meeting; actor?: User | null; kind: ListKind }) {
  const { actor, kind } = input;
  // Relue ici : la réunion passée par l'appelant peut dater d'avant une correction ou une purge.
  const meeting = (await prisma.meeting.findUnique({ where: { id: input.meeting.id } })) ?? input.meeting;
  let previous: GeneratedDocument | null = null;
  let correctionNote: string | null = null;

  if (meeting.purgedAt) {
    // Données anonymisées : seule la dernière liste officielle archivée (établie avant la purge) fait foi.
    const archived =
      kind === "official"
        ? await prisma.generatedDocument.findFirst({
            where: { meetingId: meeting.id, type: "LISTE_OFFICIELLE", supersededAt: null },
            orderBy: [{ version: "desc" }, { generatedAt: "desc" }],
          })
        : null;
    const stored = archived ? await getObjectBuffer(archived.objectKey) : null;
    if (archived && stored) return { buffer: stored, document: archived, reused: true };
    throw new DocumentUnavailableError(
      "Données anonymisées (durée de conservation écoulée) : aucune nouvelle liste ne peut être établie.",
    );
  }

  if (kind === "official" && !isFrozen(meeting.status)) {
    // Rouverte entre la demande et la génération : une liste « officielle » sans filigrane serait trompeuse.
    throw new DocumentUnavailableError("La réunion a été rouverte : la liste officielle sera établie à sa clôture.");
  }

  if (kind === "official") {
    previous = await prisma.generatedDocument.findFirst({
      where: { meetingId: meeting.id, type: "LISTE_OFFICIELLE", supersededAt: null },
      orderBy: [{ version: "desc" }, { generatedAt: "desc" }],
    });
    if (previous) {
      if (!(await isDocumentStale(previous, meeting.contentVersion))) {
        const stored = await getObjectBuffer(previous.objectKey);
        if (stored) return { buffer: stored, document: previous, reused: true };
      } else {
        correctionNote = correctionReasons(await contentChangesSince(meeting.id, previous.generatedAt));
      }
    }
  } else {
    // Liste provisoire ou publique : la dernière éditée par le même agent est resservie si rien n'a changé.
    const last = await prisma.generatedDocument.findFirst({
      where: { meetingId: meeting.id, type: TYPE_BY_KIND[kind], generatedById: actor?.id ?? null },
      orderBy: { generatedAt: "desc" },
    });
    const template = await getTemplate(TEMPLATE_BY_KIND[kind]);
    const templateChanged = Boolean(last && template.updatedAt && template.updatedAt > last.generatedAt);
    // updatedAt suit aussi chaque émargement (version de contenu incrémentée sur la ligne de la réunion).
    const meetingStateChanged = Boolean(last && meeting.updatedAt > last.generatedAt);
    if (last && !templateChanged && !meetingStateChanged && last.contentVersion === meeting.contentVersion) {
      const stored = await getObjectBuffer(last.objectKey);
      if (stored) return { buffer: stored, document: last, reused: true };
    }
  }

  // Version de contenu et présences lues dans la même transaction (lecture cohérente) : le document
  // correspond exactement à la version qu'il porte, une présence ultérieure le rend périmé.
  const snapshotAt = new Date();
  const [contentVersion, attendances] = await prisma.$transaction(async (tx) => {
    const current = await tx.meeting.findUniqueOrThrow({ where: { id: meeting.id }, select: { contentVersion: true } });
    const rows = await tx.attendance.findMany({
      // Liste publique : seules les personnes ayant accepté d'y figurer.
      where: { meetingId: meeting.id, status: "ACTIVE", ...(kind === "public" ? { publicListConsent: true } : {}) },
      orderBy: ATTENDANCE_ORDER,
    });
    return [current.contentVersion, rows] as const;
  });
  const documentUuid = randomUUID();
  const version = kind === "official" ? (previous?.version ?? 0) + 1 : 1;
  const buffer = await withRenderSlot(() =>
    renderList({
      meeting,
      attendances,
      actor,
      kind,
      documentUuid,
      version,
      supersedes: previous,
      correctionNote,
    }),
  );
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const prefix = kind === "official" ? `liste-officielle-v${version}` : kind === "provisional" ? "liste-provisoire" : "liste-publique";
  const objectKey = meetingObjectKey(meeting.uuid, "exports", `${prefix}-${documentUuid}.pdf`);
  await putObject(objectKey, buffer, "application/pdf");

  let document: GeneratedDocument;
  try {
    document = await prisma.$transaction(async (tx) => {
      const created = await tx.generatedDocument.create({
        data: {
          meetingId: meeting.id,
          type: TYPE_BY_KIND[kind],
          uuid: documentUuid,
          version,
          officialVersion: kind === "official" ? version : null,
          contentVersion,
          objectKey,
          sha256,
          generatedById: actor?.id,
          generatedAt: snapshotAt,
          participantCount: attendances.length,
          correctionNote,
        },
      });
      if (kind === "official") {
        await tx.generatedDocument.updateMany({
          where: { meetingId: meeting.id, type: "LISTE_OFFICIELLE", supersededAt: null, id: { not: created.id } },
          data: { supersededAt: new Date() },
        });
      }
      return created;
    });
  } catch (error) {
    await deleteObject(objectKey).catch(() => undefined);
    // Numéro de version déjà pris par une génération concurrente : c'est elle qui fait foi.
    if (kind === "official" && (error as { code?: string }).code === "P2002") throw new DocumentBusyError();
    throw error;
  }

  await writeAudit({
    actorId: actor?.id,
    action: kind === "official" ? "document.official_list" : "document.pdf",
    entity: "GeneratedDocument",
    entityId: document.id,
    afterData: { meetingId: meeting.id, kind, version, ...(previous ? { supersedes: previous.id } : {}) },
  });

  return { buffer, document, reused: false };
}

export function listFilename(meeting: Meeting, document: GeneratedDocument) {
  if (document.type === "LISTE_OFFICIELLE") return `${meeting.slug}-officielle-v${document.version}.pdf`;
  if (document.type === "LISTE_PROVISOIRE") return `${meeting.slug}-provisoire.pdf`;
  return `${meeting.slug}-publique.pdf`;
}

const METHOD_TEXT: Record<Attendance["checkInMethod"], string> = {
  QR_CODE: "QR code",
  ADMIN_MANUAL: "Saisie agent",
  KIOSK: "Borne",
};

/** Les présences actives sont numérotées ; les annulations sont tenues à part (traçabilité). */
function splitByStatus(attendances: Attendance[]) {
  return {
    active: attendances.filter((row) => row.status === "ACTIVE"),
    cancelled: attendances.filter((row) => row.status !== "ACTIVE"),
  };
}

/** Neutralise les formules (=, +, -, @, tabulation, retour chariot) à l'ouverture dans un tableur. */
export function spreadsheetSafe(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export async function buildExcel(meeting: Meeting, attendances: Attendance[], actorId?: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SODEFOR Présences";
  const { active, cancelled } = splitByStatus(attendances);
  const columns = [
    { header: "N°", key: "n", width: 6 },
    { header: "Civilité", key: "civility", width: 10 },
    { header: "Nom", key: "lastName", width: 20 },
    { header: "Prénoms", key: "firstNames", width: 22 },
    { header: "Genre", key: "gender", width: 8 },
    { header: "Fonction", key: "jobTitle", width: 24 },
    { header: "Structure", key: "organization", width: 24 },
    { header: "Email", key: "email", width: 28 },
    { header: "Contact", key: "phone", width: 18 },
    { header: "Heure", key: "checkInAt", width: 22 },
    { header: "Mode", key: "method", width: 16 },
    { header: "Motif dérogation", key: "manualReason", width: 28 },
    { header: "Confirmation", key: "code", width: 20 },
  ];
  const fill = (sheet: ExcelJS.Worksheet, rows: Attendance[], extra?: (row: Attendance) => Record<string, string>) => {
    rows.forEach((row, i) => {
      sheet.addRow({
        n: i + 1,
        civility: row.civility,
        lastName: spreadsheetSafe(row.lastName),
        firstNames: spreadsheetSafe(row.firstNames),
        gender: row.gender,
        jobTitle: spreadsheetSafe(row.jobTitle),
        organization: spreadsheetSafe(row.organization),
        email: spreadsheetSafe(row.email),
        phone: spreadsheetSafe(row.phone),
        checkInAt: formatDateTime(row.checkInAt),
        method: METHOD_TEXT[row.checkInMethod],
        manualReason: spreadsheetSafe(row.manualReason),
        code: row.confirmationCode,
        ...extra?.(row),
      });
    });
    sheet.getRow(1).font = { bold: true, color: { argb: "FF14532D" } };
  };

  const sheet = workbook.addWorksheet("Présences");
  sheet.columns = columns;
  fill(sheet, active);
  if (cancelled.length > 0) {
    const cancelledSheet = workbook.addWorksheet("Annulations");
    cancelledSheet.columns = [
      ...columns,
      { header: "Annulée le", key: "cancelledAt", width: 22 },
      { header: "Motif d'annulation", key: "cancelReason", width: 32 },
    ];
    fill(cancelledSheet, cancelled, (row) => ({
      cancelledAt: formatDateTime(row.cancelledAt),
      cancelReason: spreadsheetSafe(row.cancelReason),
    }));
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  if (actorId) {
    await writeAudit({
      actorId,
      action: "export.xlsx",
      entity: "Meeting",
      entityId: meeting.id,
    });
  }
  return buffer;
}

/** CSV pour Excel (séparateur « ; », BOM UTF-8 pour les accents) ; présences actives puis annulations. */
export function buildCsv(attendances: Attendance[]) {
  const header = ["N°", "Civilité", "Nom", "Prénoms", "Fonction", "Structure", "Email", "Contact", "Heure", "Mode", "Statut", "Motif"];
  const { active, cancelled } = splitByStatus(attendances);
  const line = (row: Attendance, n: string, status: string, reason: string | null) =>
    [
      n,
      row.civility,
      row.lastName,
      row.firstNames,
      row.jobTitle,
      row.organization,
      row.email,
      row.phone,
      formatDateTime(row.checkInAt),
      METHOD_TEXT[row.checkInMethod],
      status,
      reason,
    ]
      .map((value) => `"${spreadsheetSafe(value).replaceAll('"', '""')}"`)
      .join(";");
  const lines = [
    ...active.map((row, i) => line(row, String(i + 1), "Présent", row.manualReason)),
    ...cancelled.map((row) => line(row, "", "Annulé", row.cancelReason)),
  ];
  return `\uFEFF${[header.join(";"), ...lines].join("\r\n")}`;
}
