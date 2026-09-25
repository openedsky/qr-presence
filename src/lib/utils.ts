import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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

export function hashSha256(input: string | Buffer) {
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(input).digest("hex");
}

export function randomToken(bytes = 32) {
  const { randomBytes } = require("crypto") as typeof import("crypto");
  return randomBytes(bytes).toString("base64url");
}

export function confirmationCode() {
  const { randomBytes } = require("crypto") as typeof import("crypto");
  return `SDF-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function internalRef(prefix = "REU") {
  const now = new Date();
  const y = now.getFullYear();
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${y}-${seq}`;
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fr-CI", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export function formatTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fr-CI", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
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
