import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Heure légale de Côte d'Ivoire (UTC+0, sans heure d'été), quel que soit le fuseau du serveur ou du navigateur. */
export const APP_TIME_ZONE = "Africa/Abidjan";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 3600_000);
}

export function msSince(date: Date) {
  return Date.now() - date.getTime();
}

export function internalRef(prefix = "REU") {
  const now = new Date();
  const y = now.getUTCFullYear();
  // 6 caractères base 32 sans ambiguïté (≈ 10⁹ combinaisons) : 4 chiffres saturaient en quelques centaines de réunions.
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let seq = "";
  for (let i = 0; i < 6; i++) seq += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${prefix}-${y}-${seq}`;
}

function toDate(value: Date | string) {
  return typeof value === "string" ? new Date(value) : value;
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-CI", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE,
  }).format(toDate(value));
}

export function formatTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-CI", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(toDate(value));
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(toDate(value));
}

/** Valeur d'un champ datetime-local exprimée à l'heure d'Abidjan (UTC+0). */
export function toDateTimeLocal(value: Date | string | null | undefined) {
  if (!value) return "";
  return toDate(value).toISOString().slice(0, 16);
}

/** Champ datetime-local saisi à l'heure d'Abidjan → instant UTC, indépendamment du fuseau du navigateur. */
export function fromDateTimeLocal(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const zoned = /([zZ]|[+-]\d{2}:\d{2})$/.test(value);
  const withSeconds = /T\d{2}:\d{2}:\d{2}/.test(value);
  const date = new Date(zoned ? value : withSeconds ? `${value}Z` : `${value}:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function fullName(lastName: string, firstNames: string) {
  return `${firstNames} ${lastName}`.replace(/\s+/g, " ").trim();
}

export function displayName(lastName: string, firstNames: string) {
  return `${firstNames} ${lastName.toUpperCase()}`.trim();
}

export function initials(lastName: string, firstNames: string) {
  const a = firstNames.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase();
}
