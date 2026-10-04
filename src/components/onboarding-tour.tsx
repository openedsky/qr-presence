"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, GraduationCap, X } from "lucide-react";
import { apiFetch } from "@/lib/alerts";
import { START_TOUR_EVENT, type TourStep } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

const BUBBLE_WIDTH = 340;
const GAP = 14;
const PADDING = 6;

type Rect = { top: number; left: number; width: number; height: number };

/** Premier élément visible portant l'attribut `data-tour` (le menu mobile replié n'a pas de dimensions). */
function findTarget(target?: string) {
  if (!target) return null;
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(target)}"]`);
  for (const node of nodes) {
    const box = node.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) return node;
  }
  return null;
}

function bubblePosition(rect: Rect | null, bubbleHeight: number) {
  if (!rect) return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(BUBBLE_WIDTH, vw - 24);
  const clampTop = (top: number) => Math.max(12, Math.min(top, vh - bubbleHeight - 12));
  const clampLeft = (left: number) => Math.max(12, Math.min(left, vw - width - 12));
  if (rect.left + rect.width + GAP + width <= vw - 12) {
    return { top: clampTop(rect.top + rect.height / 2 - bubbleHeight / 2), left: rect.left + rect.width + GAP, width };
  }
  if (rect.top + rect.height + GAP + bubbleHeight <= vh - 12) {
    return { top: rect.top + rect.height + GAP, left: clampLeft(rect.left + rect.width - width), width };
  }
  return { top: clampTop(rect.top - GAP - bubbleHeight), left: clampLeft(rect.left + rect.width - width), width };
}

export function OnboardingTour({ steps, autoStart }: { steps: TourStep[]; autoStart: boolean }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [bubbleHeight, setBubbleHeight] = useState(220);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  useEffect(() => {
    if (!autoStart || steps.length === 0) return;
    const timer = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(timer);
  }, [autoStart, steps.length]);

  useEffect(() => {
    const start = () => {
      setIndex(0);
      setOpen(true);
    };
    window.addEventListener(START_TOUR_EVENT, start);
    return () => window.removeEventListener(START_TOUR_EVENT, start);
  }, []);

  // Position de la cible : recalculée à chaque étape, au redimensionnement et au défilement.
  useEffect(() => {
    if (!open || !step) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const node = findTarget(step.target);
        if (!node) return setRect(null);
        const box = node.getBoundingClientRect();
        setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
        if (bubbleRef.current) setBubbleHeight(bubbleRef.current.offsetHeight);
      });
    };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    findTarget(step.target)?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    measure();
    const settle = setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step]);

  useEffect(() => {
    if (open) bubbleRef.current?.focus();
  }, [open, index]);

  // Focus rendu à l'élément actif avant la visite (ex. bouton « Revoir la visite »).
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setIndex(0);
    // Idempotent côté serveur ; une coupure réseau n'empêche pas de fermer (la visite sera reproposée).
    void apiFetch("/api/profile/onboarding", { method: "POST" });
  }, []);

  const next = useCallback(() => {
    if (last) close();
    else setIndex((value) => Math.min(value + 1, steps.length - 1));
  }, [close, last, steps.length]);

  const previous = useCallback(() => setIndex((value) => Math.max(value - 1, 0)), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") previous();
      else if (event.key === "Tab" && bubbleRef.current) {
        // Focus maintenu dans la bulle tant que la visite est affichée.
        const focusables = bubbleRef.current.querySelectorAll<HTMLElement>("button");
        if (focusables.length === 0) return;
        const first = focusables[0];
        const lastFocusable = focusables[focusables.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === bubbleRef.current)) {
          event.preventDefault();
          lastFocusable.focus();
        } else if (!event.shiftKey && document.activeElement === lastFocusable) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close, next, previous]);

  if (!open || !step) return null;

  const anchored = step.target ? rect : null;
  const position = bubblePosition(anchored, bubbleHeight);

  return (
    <div className="no-print fixed inset-0 z-[60]">
      {anchored ? (
        <>
          <div className="absolute inset-0" aria-hidden />
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-xl ring-2 ring-gold motion-safe:transition-all motion-safe:duration-300"
            style={{
              top: anchored.top - PADDING,
              left: anchored.left - PADDING,
              width: anchored.width + PADDING * 2,
              height: anchored.height + PADDING * 2,
              boxShadow: "0 0 0 9999px rgba(6, 28, 17, 0.58)",
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-[rgba(6,28,17,0.58)] backdrop-blur-[2px]" aria-hidden />
      )}

      <div
        ref={bubbleRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        tabIndex={-1}
        className={cn(
          "absolute rounded-2xl border border-line bg-paper p-5 shadow-2xl shadow-black/30 outline-none motion-safe:transition-all motion-safe:duration-300",
          !position && "left-1/2 top-1/2 w-[min(26rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2",
        )}
        style={position ? { top: position.top, left: position.left, width: position.width } : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mint text-forest">
            <GraduationCap className="h-5 w-5" />
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Passer la visite"
            className="rounded-lg p-1.5 text-muted transition hover:bg-sand hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-leaf">
          Visite guidée · {index + 1} / {steps.length}
        </p>
        <h2 id="tour-title" className="mt-1 font-display text-xl text-forest-deep">
          {step.title}
        </h2>
        <p id="tour-text" className="mt-2 text-sm leading-6 text-muted">
          {step.text}
        </p>

        <div className="mt-4 flex gap-1.5" aria-hidden>
          {steps.map((item, i) => (
            <span key={item.id} className={cn("h-1.5 flex-1 rounded-full", i <= index ? "bg-forest" : "bg-line")} />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button type="button" onClick={close} className="text-sm font-semibold text-muted transition hover:text-ink">
            {last ? "Fermer" : "Passer"}
          </button>
          <div className="flex gap-2">
            {index > 0 ? (
              <button
                type="button"
                onClick={previous}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink transition hover:bg-sand"
              >
                <ArrowLeft className="h-4 w-4" /> Précédent
              </button>
            ) : null}
            <button type="button" onClick={next} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm">
              {last ? (
                <>
                  <Check className="h-4 w-4" /> Terminer
                </>
              ) : (
                <>
                  Suivant <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
