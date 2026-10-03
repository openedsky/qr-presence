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

export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export function parseMonth(value?: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  const now = new Date();
  if (!match) return new Date(now.getFullYear(), now.getMonth(), 1);
  const month = Math.min(12, Math.max(1, Number(match[2])));
  return new Date(Number(match[1]), month - 1, 1);
}

/** Monday-first grid covering the whole month, in full weeks. */
export function monthGrid(monthStart: Date) {
  const first = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - offset);
  const last = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const trailing = 6 - ((last.getDay() + 6) % 7);
  const gridEnd = new Date(last);
  gridEnd.setDate(last.getDate() + trailing);
  gridEnd.setHours(23, 59, 59, 999);

  const days: Date[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return { gridStart, gridEnd, days };
}
