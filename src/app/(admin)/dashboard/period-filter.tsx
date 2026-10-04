"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { APP_TIME_ZONE, cn } from "@/lib/utils";
import { DASHBOARD_PERIODS, customRangeError, type DashboardPeriodKey } from "@/lib/dashboard-period";

const AUTO_REFRESH_MS = 60_000;

export function PeriodFilter({
  current,
  fromInput,
  toInput,
  label,
  generatedAt,
  live,
}: {
  current: DashboardPeriodKey;
  fromInput: string;
  toInput: string;
  label: string;
  generatedAt: string;
  /** La période inclut aujourd'hui : seules ces données peuvent encore changer. */
  live: boolean;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const [, startBackgroundRefresh] = useTransition();
  const [from, setFrom] = useState(fromInput);
  const [to, setTo] = useState(toInput);
  const [showCustom, setShowCustom] = useState(current === "custom");
  const [submitted, setSubmitted] = useState(false);
  const [synced, setSynced] = useState({ current, fromInput, toInput });
  const containerRef = useRef<HTMLDivElement>(null);
  const fromRef = useRef<HTMLInputElement>(null);

  if (synced.current !== current || synced.fromInput !== fromInput || synced.toInput !== toInput) {
    setSynced({ current, fromInput, toInput });
    setFrom(fromInput);
    setTo(toInput);
    setShowCustom(current === "custom");
    setSubmitted(false);
  }

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      // Pas d'actualisation pendant une saisie dans le filtre.
      if (containerRef.current?.contains(document.activeElement) && document.activeElement instanceof HTMLInputElement) return;
      startBackgroundRefresh(() => router.refresh());
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [router, live]);

  function navigate(params: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    startNavigation(() => router.replace(`/dashboard?${query}`, { scroll: false }));
  }

  function selectPreset(value: DashboardPeriodKey) {
    if (value === "custom") {
      setShowCustom(true);
      requestAnimationFrame(() => fromRef.current?.focus());
      return;
    }
    setShowCustom(false);
    if (value !== current) navigate({ p: value });
  }

  const error = customRangeError(from, to);

  function applyCustom(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (error) return;
    if (current === "custom" && from === fromInput && to === toInput) return;
    navigate({ p: "custom", from, to });
  }

  const updatedAt = new Date(generatedAt).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  });

  return (
    <div ref={containerRef} className="mb-6 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Période du tableau de bord"
          className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-line bg-paper p-1 shadow-sm"
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
                  "shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition sm:px-4",
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
          onClick={() => startRefresh(() => router.refresh())}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-forest hover:bg-mint"
          aria-label="Actualiser le tableau de bord"
        >
          {refreshing ? <Spinner /> : <RefreshCw aria-hidden className="h-4 w-4" />}
          <span className="hidden sm:inline">Actualiser</span>
        </button>
        {navigating ? <Spinner className="text-forest" /> : null}
      </div>

      {showCustom ? (
        <form onSubmit={applyCustom} className="flex flex-wrap items-end gap-3" noValidate>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-ink">Du</span>
            <input
              ref={fromRef}
              type="date"
              className="field"
              value={from}
              min="2000-01-01"
              max={to || undefined}
              aria-invalid={submitted && Boolean(error)}
              aria-describedby={submitted && error ? "period-error" : undefined}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-ink">Au</span>
            <input
              type="date"
              className="field"
              value={to}
              min={from || "2000-01-01"}
              aria-invalid={submitted && Boolean(error)}
              aria-describedby={submitted && error ? "period-error" : undefined}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <Button type="submit" variant="outline" loading={navigating}>
            Appliquer
          </Button>
          {submitted && error ? (
            <p id="period-error" role="alert" className="w-full text-sm text-danger">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}

      <p className="text-xs text-muted">
        <span aria-live="polite">
          Période : <strong className="text-ink">{label}</strong>
        </span>
        {" · "}mis à jour à {updatedAt}
        {live ? " · actualisation automatique chaque minute" : null}
      </p>
    </div>
  );
}
