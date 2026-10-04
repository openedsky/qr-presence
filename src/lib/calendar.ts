import type { MeetingStatus } from "@prisma/client";

export type CalendarCategory = "prevue" | "en_cours" | "achevee";

export const CATEGORY_LABELS: Record<CalendarCategory, string> = {
  prevue: "Prévue",
  en_cours: "En cours",
  achevee: "Achevée",
};

export const CATEGORY_STYLES: Record<CalendarCategory, { chip: string; dot: string }> = {
  prevue: { chip: "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100", dot: "bg-sky-500" },
  en_cours: { chip: "border-emerald-300 bg-emerald-100 text-emerald-950 hover:bg-emerald-200", dot: "bg-emerald-600" },
  achevee: { chip: "border-stone-200 bg-stone-100 text-stone-700 hover:bg-stone-200", dot: "bg-stone-400" },
};

export function categorize(status: MeetingStatus, startsAt: Date, now = new Date()): CalendarCategory {
  if (status === "CLOTUREE" || status === "ARCHIVEE") return "achevee";
  if (status === "EN_COURS") return "en_cours";
  if (status === "OUVERTE" && startsAt <= now) return "en_cours";
  return "prevue";
}

export const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const pad = (n: number) => String(n).padStart(2, "0");

/*
 * Toutes les dates du calendrier sont en UTC : l'heure d'Abidjan (APP_TIME_ZONE) est UTC+0 sans heure d'été,
 * et le résultat ne dépend plus du fuseau du serveur ou du poste de développement.
 */
export const dayKey = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;

export function parseMonth(value?: string, now = new Date()) {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const month = Math.min(12, Math.max(1, Number(match[2])));
  return new Date(Date.UTC(Number(match[1]), month - 1, 1));
}

/** Mois précédent (-1) ou suivant (+1), au premier jour, en UTC. */
export function shiftMonth(monthStart: Date, delta: number) {
  return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + delta, 1));
}

/** Monday-first grid covering the whole month, in full weeks. */
export function monthGrid(monthStart: Date) {
  const year = monthStart.getUTCFullYear();
  const monthIndex = monthStart.getUTCMonth();
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(Date.UTC(year, monthIndex, 1 - offset));
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  const trailing = 6 - ((last.getUTCDay() + 6) % 7);
  const gridEnd = new Date(Date.UTC(year, monthIndex + 1, trailing + 1) - 1);

  const days: Date[] = [];
  for (let d = gridStart.getTime(); d <= gridEnd.getTime(); d += 86_400_000) {
    days.push(new Date(d));
  }
  return { gridStart, gridEnd, days };
}
