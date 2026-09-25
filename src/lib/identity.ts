export function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const value = email.trim().toLowerCase();
  return value.length ? value : null;
}

export function normalizeNamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function nameKey(lastName: string, firstNames: string) {
  return `${normalizeNamePart(lastName)}|${normalizeNamePart(firstNames)}`;
}

export function toUpperLastName(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function toTitleFirstNames(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function genderFromCivility(civility: "M" | "MME" | "MLLE"): "M" | "F" {
  return civility === "M" ? "M" : "F";
}
