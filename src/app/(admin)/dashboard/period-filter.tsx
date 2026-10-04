"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Spinner } from "@/components/ui";
import { APP_TIME_ZONE, cn } from "@/lib/utils";
import { DASHBOARD_PERIODS, type DashboardPeriodKey } from "@/lib/dashboard-period";

const AUTO_REFRESH_MS = 60_000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function PeriodFilter({
  current,
  fromInput,
  toInput,
  label,
  generatedAt,
}: {
  current: DashboardPeriodKey;
  fromInput: string;
  toInput: string;
  label: string;
  generatedAt: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [from, setFrom] = useState(fromInput);
  const [to, setTo] = useState(toInput);
  const [showCustom, setShowCustom] = useState(current === "custom");
  const [synced, setSynced] = useState({ current, fromInput, toInput });

  if (synced.current !== current || synced.fromInput !== fromInput || synced.toInput !== toInput) {
    setSynced({ current, fromInput, toInput });
    setFrom(fromInput);
    setTo(toInput);
    setShowCustom(current === "custom");
  }

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") startTransition(() => router.refresh());
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [router]);

  function navigate(params: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    startTransition(() => router.push(`/dashboard?${query}`, { scroll: false }));
  }

  function selectPreset(value: DashboardPeriodKey) {
    if (value === "custom") {
      setShowCustom(true);
      if (DAY_PATTERN.test(from) && DAY_PATTERN.test(to)) navigate({ p: "custom", from, to });
      return;
    }
    setShowCustom(false);
    navigate({ p: value });
  }

  function changeCustom(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    if (DAY_PATTERN.test(nextFrom) && DAY_PATTERN.test(nextTo)) navigate({ p: "custom", from: nextFrom, to: nextTo });
  }

  const updatedAt = new Date(generatedAt).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  });

  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Période du tableau de bord"
          className="flex w-fit flex-wrap gap-1 rounded-2xl border border-line bg-paper p-1 shadow-sm"
        >
          {DASHBOARD_PERIODS.map((item) => {
            const active = item.value === "custom" ? showCustom : !showCustom && item.value === current;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={active}
                onClick={() => selectPreset(item.value)}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  active ? "bg-forest text-white shadow" : "text-muted hover:bg-mint hover:text-forest",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => startTransition(() => router.refresh())}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-forest hover:bg-mint"
          aria-label="Actualiser le tableau de bord"
        >
          {pending ? <Spinner /> : <RefreshCw aria-hidden className="h-4 w-4" />}
          <span className="hidden sm:inline">Actualiser</span>
        </button>
      </div>

      {showCustom ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-ink">Du</span>
            <input
              type="date"
              className="field"
              value={from}
              max={to || undefined}
              onChange={(event) => changeCustom(event.target.value, to)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-ink">Au</span>
            <input
              type="date"
              className="field"
              value={to}
              min={from || undefined}
              onChange={(event) => changeCustom(from, event.target.value)}
            />
          </label>
        </div>
      ) : null}

      <p className="text-xs text-muted" aria-live="polite">
        Période : <strong className="text-ink">{label}</strong> · mis à jour à {updatedAt} · actualisation automatique
        chaque minute
      </p>
    </div>
  );
}
