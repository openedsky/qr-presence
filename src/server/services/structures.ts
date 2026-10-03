import { prisma } from "@/lib/prisma";
import { invalidateMemo, memo } from "@/lib/memo-cache";

export function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function internalEmailDomains() {
  return (process.env.INTERNAL_EMAIL_DOMAINS || "sodefor.ci")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

export function internalStructureNames() {
  return memo("structures:internal", 60_000, async () => {
    const rows = await prisma.structure.findMany({
      where: { active: true, internal: true },
      orderBy: { name: "asc" },
      select: { name: true },
    });
    return rows.map((row) => row.name);
  });
}

/** Structures proposées sur le formulaire public. */
export function activeStructureNames() {
  return memo("structures:active", 60_000, async () => {
    const rows = await prisma.structure.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { name: true } });
    return rows.map((row) => row.name);
  });
}

export function invalidateStructures() {
  invalidateMemo("structures:");
}

/**
 * Interne si la structure appartient au référentiel interne ET, lorsqu'un email est saisi, s'il est sur un
 * domaine de l'organisation. Ces données restent déclaratives : sans vérification par code envoyé à
 * l'adresse professionnelle (OTP), un tiers qui connaît le nom d'une structure interne peut encore émarger.
 */
export async function isInternalParticipant(organization: string, email?: string | null) {
  const domain = email?.split("@")[1]?.trim().toLowerCase();
  if (domain && !internalEmailDomains().includes(domain)) return false;
  const target = normalizeLabel(organization);
  const names = await internalStructureNames();
  return names.some((name) => normalizeLabel(name) === target);
}
