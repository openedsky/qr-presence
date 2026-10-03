"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 700;

/**
 * Affiche directement la valeur (rendu serveur et lecteurs d'écran corrects), puis anime
 * de l'ancienne vers la nouvelle valeur à chaque changement, avec ralentissement final.
 */
export function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const origin = from.current;
    if (origin === value) return;
    from.current = value;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(origin + (value - origin) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      setShown(value);
    };
  }, [value]);

  return <span className="tabular-nums">{shown.toLocaleString("fr-FR")}</span>;
}
