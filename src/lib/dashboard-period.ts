/** Périodes du tableau de bord, calculées à l'heure d'Abidjan (UTC+0) : les bornes sont des jours UTC entiers. */

export const DASHBOARD_PERIODS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "month", label: "Ce mois" },
  { value: "90d", label: "3 mois" },
  { value: "365d", label: "12 mois" },
  { value: "custom", label: "Personnalisée" },
] as const;

export type DashboardPeriodKey = (typeof DASHBOARD_PERIODS)[number]["value"];

export const DEFAULT_DASHBOARD_PERIOD: DashboardPeriodKey = "30d";

const DAY_MS = 24 * 3600_000;
/** Au-delà, l'histogramme quotidien devient illisible : on passe au mois. */
const MAX_DAILY_BUCKETS = 62;
/** Borne haute d'une période personnalisée, pour garder les agrégats raisonnables. */
const MAX_CUSTOM_DAYS = 5 * 366;

export type DashboardPeriod = {
  key: DashboardPeriodKey;
  label: string;
  from: Date;
  /** Borne exclusive : minuit du lendemain du dernier jour inclus. */
  to: Date;
  bucket: "day" | "month";
  fromInput: string;
  toInput: string;
};

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDay(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || toInput(date) !== value ? null : date;
}

function formatDay(date: Date) {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function resolveDashboardPeriod(
  params: { p?: string; from?: string; to?: string },
  now = new Date(),
): DashboardPeriod {
  const today = startOfUtcDay(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const requested = DASHBOARD_PERIODS.find((item) => item.value === params.p)?.value ?? DEFAULT_DASHBOARD_PERIOD;

  let key: DashboardPeriodKey = requested;
  let from: Date;
  let to = tomorrow;

  const lastDays = (days: number) => new Date(today.getTime() - (days - 1) * DAY_MS);

  switch (requested) {
    case "today":
      from = today;
      break;
    case "7d":
      from = lastDays(7);
      break;
    case "month":
      from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      break;
    case "90d":
      from = lastDays(90);
      break;
    case "365d":
      from = lastDays(365);
      break;
    case "custom": {
      let start = parseDay(params.from);
      let end = parseDay(params.to);
      if (!start || !end) {
        key = DEFAULT_DASHBOARD_PERIOD;
        from = lastDays(30);
        break;
      }
      if (start > end) [start, end] = [end, start];
      if ((end.getTime() - start.getTime()) / DAY_MS > MAX_CUSTOM_DAYS) {
        start = new Date(end.getTime() - MAX_CUSTOM_DAYS * DAY_MS);
      }
      from = start;
      to = new Date(end.getTime() + DAY_MS);
      break;
    }
    default:
      from = lastDays(30);
  }

  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS);
  const lastDay = new Date(to.getTime() - DAY_MS);
  const preset = DASHBOARD_PERIODS.find((item) => item.value === key)!;
  const label =
    key === "custom"
      ? days === 1
        ? `Le ${formatDay(from)}`
        : `Du ${formatDay(from)} au ${formatDay(lastDay)}`
      : preset.label;

  return {
    key,
    label,
    from,
    to,
    bucket: days > MAX_DAILY_BUCKETS ? "month" : "day",
    fromInput: toInput(from),
    toInput: toInput(lastDay),
  };
}

/** Clés de l'histogramme (« AAAA-MM-JJ » ou « AAAA-MM »), y compris les jours sans présence. */
export function periodBuckets(period: Pick<DashboardPeriod, "from" | "to" | "bucket">) {
  const keys: string[] = [];
  if (period.bucket === "day") {
    for (let t = period.from.getTime(); t < period.to.getTime(); t += DAY_MS) {
      keys.push(new Date(t).toISOString().slice(0, 10));
    }
    return keys;
  }
  let year = period.from.getUTCFullYear();
  let month = period.from.getUTCMonth();
  const last = new Date(period.to.getTime() - DAY_MS);
  while (year < last.getUTCFullYear() || (year === last.getUTCFullYear() && month <= last.getUTCMonth())) {
    keys.push(`${year}-${String(month + 1).padStart(2, "0")}`);
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
  return keys;
}

export function bucketLabel(key: string) {
  const [year, month, day] = key.split("-");
  if (day) return `${day}/${month}`;
  return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleDateString("fr-FR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}
