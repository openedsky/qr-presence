import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Filter, History } from "lucide-react";
import { actionLabel, auditChanges, ENTITY_LABELS } from "@/lib/audit-format";
import type { AuditFilters, AuditRow } from "@/server/services/audit-query";
import { queryString } from "@/server/services/audit-query";
import { APP_TIME_ZONE as TIME_ZONE, cn } from "@/lib/utils";
import { Button, Card } from "./ui";

function time(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(value);
}

export function auditDateTime(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(value);
}

function dayLabel(value: Date) {
  const label = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(value);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function actionTone(action: string) {
  if (action.includes("failed") || action.includes("delete") || action.includes("cancel")) return "bg-rose-50 text-rose-700";
  if (action.startsWith("auth.")) return "bg-sky-50 text-sky-700";
  if (action.includes("post_close") || action.includes("reopen")) return "bg-amber-50 text-amber-800";
  if (action.includes("create") || action.includes("official")) return "bg-emerald-50 text-emerald-800";
  return "bg-mint text-forest";
}

export function ActionBadge({ action }: { action: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", actionTone(action))}>
      {actionLabel(action)}
    </span>
  );
}

export function AuditTarget({ row }: { row: AuditRow }) {
  if (!row.target) return <span className="text-muted">{ENTITY_LABELS[row.entity] ?? row.entity}</span>;
  return row.target.href ? (
    <Link href={row.target.href} className="font-medium text-forest hover:underline">
      {row.target.label}
    </Link>
  ) : (
    <span className="font-medium">{row.target.label}</span>
  );
}

/** Tableau « ancienne valeur → nouvelle valeur », replié par défaut. */
export function AuditChanges({ row, open = false }: { row: AuditRow; open?: boolean }) {
  const changes = auditChanges(row.beforeData, row.afterData);
  if (changes.length === 0) return null;
  const hasBefore = row.beforeData !== null && row.beforeData !== undefined;
  return (
    <details className="group mt-2" open={open}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-forest hover:bg-mint">
        <ChevronRight className="h-3.5 w-3.5 transition group-open:rotate-90" />
        {hasBefore ? `Voir les modifications (${changes.length})` : `Voir les valeurs (${changes.length})`}
      </summary>
      <div className="mt-2 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-xs">
          <thead className="bg-mint/60 text-left uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Champ</th>
              {hasBefore ? <th className="px-3 py-2 font-semibold">Ancienne valeur</th> : null}
              {hasBefore ? <th className="w-6" /> : null}
              <th className="px-3 py-2 font-semibold">{hasBefore ? "Nouvelle valeur" : "Valeur"}</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change) => (
              <tr key={change.field} className="border-t border-line align-top">
                <td className="whitespace-nowrap px-3 py-2 font-semibold text-ink">{change.label}</td>
                {hasBefore ? (
                  <td className="px-3 py-2">
                    <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-800 [overflow-wrap:anywhere]">{change.before}</span>
                  </td>
                ) : null}
                {hasBefore ? (
                  <td className="py-2 text-muted">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </td>
                ) : null}
                <td className="px-3 py-2">
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-900 [overflow-wrap:anywhere]">{change.after}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function AuditFiltersBar({
  filters,
  actors,
  showEntity = true,
  showSearch = true,
}: {
  filters: AuditFilters;
  actors?: { id: string; firstName: string; lastName: string }[];
  showEntity?: boolean;
  showSearch?: boolean;
}) {
  return (
    <Card className="mb-5 p-4">
      <form className="flex flex-wrap items-end gap-3">
        {showSearch ? (
          <label className="min-w-48 flex-1">
            <span className="label">Action</span>
            <input name="q" defaultValue={filters.q} placeholder="ex. meeting.close, auth…" className="field" />
          </label>
        ) : null}
        {showEntity ? (
          <label className="w-48">
            <span className="label">Objet</span>
            <select name="entity" defaultValue={filters.entity ?? ""} className="field">
              <option value="">Tous</option>
              {Object.entries(ENTITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {actors ? (
          <label className="w-56">
            <span className="label">Utilisateur</span>
            <select name="actorId" defaultValue={filters.actorId ?? ""} className="field">
              <option value="">Tous</option>
              {actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.lastName} {actor.firstName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="w-40">
          <span className="label">Du</span>
          <input type="date" name="from" defaultValue={filters.from} className="field" />
        </label>
        <label className="w-40">
          <span className="label">Au</span>
          <input type="date" name="to" defaultValue={filters.to} className="field" />
        </label>
        <Button type="submit">
          <Filter className="h-4 w-4" /> Filtrer
        </Button>
      </form>
    </Card>
  );
}

export function AuditPagination({
  page,
  pages,
  total,
  capped = false,
  filters,
}: {
  page: number;
  pages: number;
  total: number;
  capped?: boolean;
  filters: AuditFilters;
}) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted">
      <p>
        {capped ? `${total}+ évènements (affinez les filtres pour remonter plus loin)` : `${total} évènement(s)`} · page {page}/{pages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={queryString(filters, page - 1)} className="inline-flex items-center gap-1 rounded-lg border border-line bg-paper px-3 py-1.5 font-semibold text-ink hover:bg-mint">
            <ChevronLeft className="h-4 w-4" /> Précédent
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={queryString(filters, page + 1)} className="inline-flex items-center gap-1 rounded-lg border border-line bg-paper px-3 py-1.5 font-semibold text-ink hover:bg-mint">
            Suivant <ChevronRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function initials(row: AuditRow) {
  if (!row.actor) return "SY";
  return `${row.actor.firstName.charAt(0)}${row.actor.lastName.charAt(0)}`.toUpperCase();
}

/** Fil chronologique groupé par jour, pour les historiques (global et personnel). */
export function AuditTimeline({ rows, showActor = true }: { rows: AuditRow[]; showActor?: boolean }) {
  if (rows.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 py-14 text-center text-muted">
        <History className="h-8 w-8 text-leaf" />
        Aucune activité sur la période sélectionnée.
      </Card>
    );
  }
  const groups = new Map<string, AuditRow[]>();
  for (const row of rows) {
    const key = dayLabel(row.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([day, items]) => (
        <section key={day}>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-leaf">{day}</h2>
          <Card className="p-0">
            <ol className="divide-y divide-line">
              {items.map((row) => (
                <li key={row.id} className="flex gap-4 px-5 py-4">
                  {showActor ? (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mint text-xs font-bold text-forest">
                      {initials(row)}
                    </span>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      {showActor ? (
                        <span className="font-semibold text-ink">
                          {row.actor ? `${row.actor.firstName} ${row.actor.lastName}` : "Système"}
                        </span>
                      ) : null}
                      <ActionBadge action={row.action} />
                      <AuditTarget row={row} />
                    </div>
                    <AuditChanges row={row} />
                  </div>
                  <time className="shrink-0 text-xs font-semibold text-muted" dateTime={row.createdAt.toISOString()}>
                    {time(row.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      ))}
    </div>
  );
}
