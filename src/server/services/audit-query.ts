import type { AuditLog, Prisma, Role, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AuditFilters = {
  q?: string;
  entity?: string;
  actorId?: string;
  from?: string;
  to?: string;
  page?: string;
};

export type AuditRow = AuditLog & {
  actor: Pick<User, "id" | "firstName" | "lastName"> | null;
  target: { label: string; href?: string } | null;
};

function dayStart(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return new Date(`${value}T00:00:00.000Z`);
}

function dayEnd(value?: string) {
  const start = dayStart(value);
  return start ? new Date(start.getTime() + 86_400_000) : undefined;
}

export function auditWhere(filters: AuditFilters, scope: Prisma.AuditLogWhereInput = {}): Prisma.AuditLogWhereInput {
  const from = dayStart(filters.from);
  const to = dayEnd(filters.to);
  return {
    AND: [
      scope,
      filters.q?.trim() ? { action: { contains: filters.q.trim().slice(0, 60) } } : {},
      filters.entity ? { entity: filters.entity } : {},
      filters.actorId ? { actorId: filters.actorId } : {},
      from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {},
    ],
  };
}

/** Libellé lisible et lien de l'objet concerné par chaque entrée (réunion, participant, utilisateur…). */
async function resolveTargets(logs: AuditLog[]) {
  const ids = (entity: string) => [...new Set(logs.filter((log) => log.entity === entity).map((log) => log.entityId))];
  const [meetings, attendances, users, types, templates, documents] = await Promise.all([
    prisma.meeting.findMany({ where: { id: { in: ids("Meeting") } }, select: { id: true, title: true } }),
    prisma.attendance.findMany({
      where: { id: { in: ids("Attendance") } },
      select: { id: true, lastName: true, firstNames: true, meetingId: true, meeting: { select: { title: true } } },
    }),
    prisma.user.findMany({ where: { id: { in: ids("User") } }, select: { id: true, firstName: true, lastName: true } }),
    prisma.meetingTypeOption.findMany({ where: { id: { in: ids("MeetingTypeOption") } }, select: { id: true, label: true } }),
    prisma.pdfTemplate.findMany({ where: { id: { in: ids("PdfTemplate") } }, select: { id: true, kind: true, title: true } }),
    prisma.generatedDocument.findMany({
      where: { id: { in: ids("GeneratedDocument") } },
      select: { id: true, version: true, type: true, meetingId: true, meeting: { select: { title: true } } },
    }),
  ]);
  const map = new Map<string, { label: string; href?: string }>();
  meetings.forEach((m) => map.set(`Meeting:${m.id}`, { label: m.title, href: `/meetings/${m.id}` }));
  attendances.forEach((a) =>
    map.set(`Attendance:${a.id}`, {
      label: `${a.firstNames} ${a.lastName} — ${a.meeting.title}`,
      href: `/meetings/${a.meetingId}/participants/${a.id}`,
    }),
  );
  users.forEach((u) => map.set(`User:${u.id}`, { label: `${u.firstName} ${u.lastName}` }));
  types.forEach((t) => map.set(`MeetingTypeOption:${t.id}`, { label: t.label, href: "/settings?tab=types" }));
  templates.forEach((t) => map.set(`PdfTemplate:${t.id}`, { label: t.title, href: "/documents" }));
  documents.forEach((d) =>
    map.set(`GeneratedDocument:${d.id}`, {
      label: `${d.meeting.title}${d.type === "LISTE_OFFICIELLE" ? ` · v${d.version}` : ""}`,
      href: `/meetings/${d.meetingId}?tab=documents`,
    }),
  );
  return map;
}

function fallbackTarget(log: AuditLog) {
  const data = { ...(log.beforeData as Record<string, unknown> | null), ...(log.afterData as Record<string, unknown> | null) };
  if (typeof data.title === "string") return { label: data.title };
  if (typeof data.label === "string") return { label: data.label };
  if (typeof data.lastName === "string") return { label: `${data.firstNames ?? data.firstName ?? ""} ${data.lastName}`.trim() };
  if (log.entity === "OrganizationSetting") return { label: "Paramètres généraux", href: "/settings" };
  return null;
}

/** Au-delà, le décompte s'arrête (« 10000+ ») : ni COUNT complet ni OFFSET profond sur un journal volumineux. */
export const AUDIT_COUNT_CAP = 10_000;

/** Paramètres d'URL répétés (?q=a&q=b) : seule la première valeur compte. */
function normalizeFilters(raw: AuditFilters): AuditFilters {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? String(value[0] ?? "") : value]),
  ) as AuditFilters;
}

/** Notes internes réservées aux organisateurs et administrateurs : retirées des valeurs avant / après. */
function withoutInternalNotes(data: Prisma.JsonValue | null) {
  if (!data || typeof data !== "object" || Array.isArray(data) || !("internalNotes" in data)) return data;
  const copy: Record<string, unknown> = { ...data };
  delete copy.internalNotes;
  return copy as Prisma.JsonValue;
}

const NOTES_HIDDEN_FOR: Role[] = ["AUDITOR", "SECRETARY"];

export async function queryAudit(
  rawFilters: AuditFilters,
  scope: Prisma.AuditLogWhereInput = {},
  take = 30,
  viewerRole?: Role,
) {
  const filters = normalizeFilters(rawFilters);
  const where = auditWhere(filters, scope);
  const maxPage = Math.ceil(AUDIT_COUNT_CAP / take);
  const page = Math.min(maxPage, Math.max(1, Number(filters.page ?? 1) || 1));
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where, take: AUDIT_COUNT_CAP }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
      include: { actor: { select: { id: true, firstName: true, lastName: true } } },
    }),
  ]);
  const targets = logs.length > 0 ? await resolveTargets(logs) : new Map<string, { label: string; href?: string }>();
  const hideNotes = viewerRole !== undefined && NOTES_HIDDEN_FOR.includes(viewerRole);
  const rows: AuditRow[] = logs.map((log) => ({
    ...log,
    ...(hideNotes ? { beforeData: withoutInternalNotes(log.beforeData), afterData: withoutInternalNotes(log.afterData) } : {}),
    target: targets.get(`${log.entity}:${log.entityId}`) ?? fallbackTarget(log),
  }));
  return { rows, total, capped: total >= AUDIT_COUNT_CAP, page, pages: Math.max(1, Math.ceil(total / take)) };
}

export async function auditActors() {
  return prisma.user.findMany({
    where: { auditLogs: { some: {} } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { lastName: "asc" },
  });
}

export function queryString(filters: AuditFilters, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && key !== "page") params.set(key, value);
  }
  params.set("page", String(page));
  return `?${params.toString()}`;
}
