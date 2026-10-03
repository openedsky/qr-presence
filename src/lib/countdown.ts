export type Remaining = { days: number; hours: number; minutes: number; seconds: number };

/** Décompose une durée (secondes, négatif ramené à 0) en jours / heures / minutes / secondes. */
export function formatRemaining(totalSeconds: number): Remaining {
  const total = Math.max(0, Math.floor(totalSeconds));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}
