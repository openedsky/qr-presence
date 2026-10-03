import type { MeetingTypeOption } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const DEFAULT_MEETING_TYPES = [
  { code: "COMITE", label: "Comité", color: "#14532d" },
  { code: "ATELIER", label: "Atelier", color: "#0369a1" },
  { code: "SEMINAIRE", label: "Séminaire", color: "#7c3aed" },
  { code: "ASSEMBLEE", label: "Assemblée", color: "#b45309" },
  { code: "FORMATION", label: "Formation", color: "#0f766e" },
  { code: "AUTRE", label: "Autre", color: "#475569" },
];

export async function listMeetingTypes(options: { activeOnly?: boolean } = {}): Promise<MeetingTypeOption[]> {
  if ((await prisma.meetingTypeOption.count()) === 0) {
    await prisma.meetingTypeOption.createMany({
      data: DEFAULT_MEETING_TYPES.map((type, index) => ({ ...type, sortOrder: index * 10 })),
      skipDuplicates: true,
    });
  }
  return prisma.meetingTypeOption.findMany({
    where: options.activeOnly ? { active: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
}

export async function meetingTypeLabels() {
  const types = await listMeetingTypes();
  return Object.fromEntries(types.map((type) => [type.code, type.label])) as Record<string, string>;
}

/** Choix proposés dans un formulaire : types actifs, plus le type actuel de la réunion s'il a été désactivé. */
export async function meetingTypeChoices(current?: string) {
  const types = await listMeetingTypes();
  return types
    .filter((type) => type.active || type.code === current)
    .map((type) => ({ code: type.code, label: type.active ? type.label : `${type.label} (désactivé)` }));
}

export async function assertMeetingType(code: string, current?: string) {
  const type = await prisma.meetingTypeOption.findUnique({ where: { code } });
  if (!type) return "Type de réunion inconnu";
  if (!type.active && type.code !== current) return "Ce type de réunion est désactivé";
  return null;
}

export function meetingTypeCode(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
