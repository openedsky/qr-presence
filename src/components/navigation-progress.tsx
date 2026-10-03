"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Lien interne qui déclenche une navigation côté client (ni nouvel onglet, ni téléchargement, ni ancre, ni API). */
function isClientNavigation(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  const anchor = (event.target as Element | null)?.closest?.("a");
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return false;
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

/**
 * Barre fine en haut de l'écran pendant les navigations : elle avance vite puis ralentit,
 * et se complète quand la nouvelle page est affichée. Invisible si la navigation est instantanée.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<number[]>([]);
  const active = useRef(false);

  useEffect(() => {
    const clear = () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
    const start = () => {
      clear();
      active.current = true;
      setProgress(0);
      // Pas de barre pour une navigation déjà en cache (< 120 ms).
      timers.current.push(
        window.setTimeout(() => {
          if (!active.current) return;
          setVisible(true);
          setProgress(0.25);
          let value = 0.25;
          const tick = () => {
            if (!active.current) return;
            value += (0.9 - value) * 0.12;
            setProgress(value);
            timers.current.push(window.setTimeout(tick, 280));
          };
          timers.current.push(window.setTimeout(tick, 280));
        }, 120),
        // Navigation annulée ou sans changement d'URL : la barre ne doit pas rester bloquée.
        window.setTimeout(() => {
          if (!active.current) return;
          active.current = false;
          clear();
          setProgress(1);
          timers.current.push(
            window.setTimeout(() => {
              setVisible(false);
              setProgress(0);
            }, 350),
          );
        }, 15000),
      );
    };
    const onClick = (event: MouseEvent) => {
      if (isClientNavigation(event)) start();
    };
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (form && form.method.toLowerCase() === "get" && !event.defaultPrevented) start();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit);
    return () => {
      clear();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit);
    };
  }, []);

  useEffect(() => {
    if (!active.current) return;
    active.current = false;
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    setProgress(1);
    const hide = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 350);
    timers.current.push(hide);
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden
      className="nav-progress no-print"
      style={{ transform: `scaleX(${progress})`, opacity: visible ? 1 : 0 }}
    />
  );
}
