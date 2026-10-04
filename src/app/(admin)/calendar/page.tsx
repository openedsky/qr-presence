import Link from "next/link";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, MapPin, PlayCircle, Plus, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { meetingWhereForRole } from "@/server/services/meetings";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/meeting-status";
import { Card, LinkButton, PageHeader, StatCard } from "@/components/ui";
import {
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  WEEKDAYS,
  categorize,
  dayKey,
  monthGrid,
  monthKey,
  parseMonth,
  shiftMonth,
  type CalendarCategory,
} from "@/lib/calendar";
import { APP_TIME_ZONE, cn } from "@/lib/utils";

export const metadata = { title: "Calendrier des réunions" };

const FILTERS: { value: "all" | CalendarCategory; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "prevue", label: "Prévues" },
  { value: "en_cours", label: "En cours" },
  { value: "achevee", label: "Achevées" },
];

const MAX_PER_CELL = 3;

const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: APP_TIME_ZONE });

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; d?: string; f?: string }>;
}) {
  const session = await requirePermission("attendances.read");
  const params = await searchParams;
  const month = parseMonth(params.m);
  const filter = (FILTERS.some((f) => f.value === params.f) ? params.f : "all") as "all" | CalendarCategory;
  const { gridStart, gridEnd, days } = monthGrid(month);
  const now = new Date();
  const todayKey = dayKey(now);

  const meetings = await prisma.meeting.findMany({
    where: meetingWhereForRole(session.user.role, session.user.id, {
      startsAt: { gte: gridStart, lte: gridEnd },
    }),
    orderBy: { startsAt: "asc" },
    include: { _count: { select: { attendances: { where: { status: "ACTIVE" } } } } },
  });

  const enriched = meetings.map((m) => ({ ...m, category: categorize(m.status, m.startsAt, now) }));
  const visible = filter === "all" ? enriched : enriched.filter((m) => m.category === filter);
  const byDay = new Map<string, typeof visible>();
  for (const m of visible) {
    const key = dayKey(m.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), m]);
  }

  const inMonth = enriched.filter((m) => monthKey(m.startsAt) === monthKey(month));
  const counts = {
    total: inMonth.length,
    prevue: inMonth.filter((m) => m.category === "prevue").length,
    en_cours: inMonth.filter((m) => m.category === "en_cours").length,
    achevee: inMonth.filter((m) => m.category === "achevee").length,
  };

  const selectedKey =
    // « 2026-13-45 » passe l'expression mais donne une date invalide (le formatage lèverait une erreur 500).
    params.d && /^\d{4}-\d{2}-\d{2}$/.test(params.d) && !Number.isNaN(new Date(`${params.d}T12:00:00Z`).getTime())
      ? params.d
      : monthKey(now) === monthKey(month)
        ? todayKey
        : dayKey(month);
  const selectedMeetings = byDay.get(selectedKey) ?? [];
  const selectedDate = new Date(`${selectedKey}T12:00:00Z`);

  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const qs = (overrides: Record<string, string | undefined>) => {
    const values = { m: monthKey(month), f: filter === "all" ? undefined : filter, ...overrides };
    const search = new URLSearchParams(
      Object.entries(values).filter((e): e is [string, string] => Boolean(e[1])),
    ).toString();
    return `/calendar${search ? `?${search}` : ""}`;
  };
  const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(month);
  const canCreate = hasPermission(session.user.role, "meetings.create");

  return (
    <div>
      <PageHeader
        title="Calendrier des réunions"
        subtitle="Vue mensuelle des réunions prévues, en cours et achevées."
        actions={
          canCreate ? (
            <LinkButton href="/meetings/new">
              <Plus className="h-4 w-4" /> Nouvelle réunion
            </LinkButton>
          ) : null
        }
      />

      <div className="stagger mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Réunions du mois" value={counts.total} icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label="Prévues" value={counts.prevue} tone="sky" icon={<Clock className="h-5 w-5" />} />
        <StatCard label="En cours" value={counts.en_cours} icon={<PlayCircle className="h-5 w-5" />} />
        <StatCard label="Achevées" value={counts.achevee} tone="gold" icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Link href={qs({ m: monthKey(prev), d: undefined })} aria-label="Mois précédent" className="rounded-xl border border-line p-2 hover:bg-mint">
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <Link href={qs({ m: monthKey(next), d: undefined })} aria-label="Mois suivant" className="rounded-xl border border-line p-2 hover:bg-mint">
                <ChevronRight className="h-4 w-4" />
              </Link>
              <h2 className="ml-2 font-display text-2xl font-semibold capitalize text-forest-deep">{monthLabel}</h2>
              <Link href={qs({ m: monthKey(now), d: todayKey })} className="ml-2 rounded-xl bg-mint px-3 py-1.5 text-sm font-semibold text-forest hover:brightness-95">
                Aujourd&apos;hui
              </Link>
            </div>
            <div className="flex flex-wrap gap-1 rounded-xl bg-sand p-1">
              {FILTERS.map((f) => (
                <Link
                  key={f.value}
                  href={qs({ f: f.value === "all" ? undefined : f.value })}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                    filter === f.value ? "bg-paper text-forest shadow-sm" : "text-muted hover:text-ink",
                  )}
                >
                  {f.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="calendar-grid border-b border-line bg-mint/50">
            {WEEKDAYS.map((day, i) => (
              <div key={day} className={cn("px-2 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-muted", i >= 5 && "text-leaf")}>
                {day}
              </div>
            ))}
          </div>
          <div className="calendar-grid">
            {days.map((day) => {
              const key = dayKey(day);
              const items = byDay.get(key) ?? [];
              const outside = monthKey(day) !== monthKey(month);
              const isToday = key === todayKey;
              const isSelected = key === selectedKey;
              const weekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
              return (
                <div
                  key={key}
                  className={cn(
                    "calendar-cell relative",
                    outside ? "bg-sand/60" : weekend ? "bg-[#fafbf8]" : "bg-paper",
                    isSelected && "ring-2 ring-inset ring-leaf/60",
                  )}
                >
                  <Link href={qs({ d: key, m: monthKey(day) })} className="flex items-center justify-between" aria-label={`Voir le ${key}`}>
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                        isToday ? "bg-forest text-white" : outside ? "text-muted/50" : "text-ink hover:bg-mint",
                      )}
                    >
                      {day.getUTCDate()}
                    </span>
                    {items.length > 0 ? (
                      <span className="text-[10px] font-semibold text-muted md:hidden">{items.length}</span>
                    ) : null}
                  </Link>
                  <div className="hidden flex-col gap-1 md:flex">
                    {items.slice(0, MAX_PER_CELL).map((m) => (
                      <Link
                        key={m.id}
                        href={`/meetings/${m.id}`}
                        title={`${m.title} — ${STATUS_LABELS[m.status]}`}
                        className={cn(
                          "block truncate rounded-lg border px-2 py-1 text-xs font-medium transition",
                          CATEGORY_STYLES[m.category].chip,
                          m.status === "BROUILLON" && "border-dashed",
                        )}
                      >
                        <span className="font-bold">{timeFmt.format(m.startsAt)}</span> {m.title}
                      </Link>
                    ))}
                    {items.length > MAX_PER_CELL ? (
                      <Link href={qs({ d: key, m: monthKey(day) })} className="px-1 text-xs font-semibold text-forest hover:underline">
                        + {items.length - MAX_PER_CELL} {items.length - MAX_PER_CELL > 1 ? "autres" : "autre"}
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1 md:hidden">
                    {items.slice(0, 4).map((m) => (
                      <span key={m.id} className={cn("h-1.5 w-1.5 rounded-full", CATEGORY_STYLES[m.category].dot)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 px-5 py-3 text-xs text-muted">
            {(Object.keys(CATEGORY_LABELS) as CalendarCategory[]).map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5">
                <span className={cn("h-2.5 w-2.5 rounded-full", CATEGORY_STYLES[c].dot)} />
                {CATEGORY_LABELS[c]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded border border-dashed border-sky-400" /> Brouillon
            </span>
          </div>
        </Card>

        <Card className="h-fit p-0">
          <div className="border-b border-line px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-leaf">Journée sélectionnée</p>
            <h3 className="mt-1 font-display text-xl font-semibold capitalize text-forest-deep">
              {new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(selectedDate)}
            </h3>
          </div>
          <div className="space-y-3 p-5">
            {selectedMeetings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
                Aucune réunion ce jour.
                {canCreate ? (
                  <Link href="/meetings/new" className="mt-2 block font-semibold text-forest">
                    Planifier une réunion
                  </Link>
                ) : null}
              </div>
            ) : (
              selectedMeetings.map((m) => (
                <Link
                  key={m.id}
                  href={`/meetings/${m.id}`}
                  className="group block rounded-2xl border border-line p-4 transition hover:border-leaf/50 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-forest">
                      <Clock className="h-3.5 w-3.5" />
                      {timeFmt.format(m.startsAt)}
                      {m.endsAt ? ` – ${timeFmt.format(m.endsAt)}` : ""}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_TONES[m.status])}>
                      {STATUS_LABELS[m.status]}
                    </span>
                  </div>
                  <p className="mt-2 font-semibold text-ink group-hover:text-forest">{m.title}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {m.location || "Distanciel"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {m._count.attendances}
                      {m.expectedParticipants ? ` / ${m.expectedParticipants}` : ""} présent(s)
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
