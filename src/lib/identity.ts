export function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const value = email.trim().toLowerCase();
  return value.length ? value : null;
}

/** « Jean-Marc », « Jean Marc » et « jean  marc » donnent la même clé ; apostrophes et accents sont ignorés. */
export function normalizeNamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-‐–—'’`.]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function nameKey(lastName: string, firstNames: string) {
  return `${normalizeNamePart(lastName)}|${normalizeNamePart(firstNames)}`;
}

export function toUpperLastName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("fr-FR");
}

/** Capitalise chaque prénom, y compris après un trait d'union ou une apostrophe (« Jean-Marc », « N'Dri »). */
export function toTitleFirstNames(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fr-FR")
    .replace(/(^|[\s\-'’])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toLocaleUpperCase("fr-FR"));
}

export function genderFromCivility(civility: "M" | "MME" | "MLLE"): "M" | "F" {
  return civility === "M" ? "M" : "F";
}
