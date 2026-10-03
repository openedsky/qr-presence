"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRemaining } from "@/lib/countdown";

const POLL_SECONDS = 15;

/**
 * Compte à rebours jusqu'à l'ouverture de l'émargement. À zéro, la page est rechargée ; si elle reste fermée
 * (réunion pas encore ouverte par l'organisateur, horloge du téléphone décalée), elle est revérifiée toutes les 15 s.
 */
export function RegistrationCountdown({
  opensAt,
  opensAtLabel,
  initialSeconds,
  waitingForOrganizer,
  resumeHref,
}: {
  opensAt: string;
  opensAtLabel: string;
  initialSeconds: number;
  waitingForOrganizer: boolean;
  /** QR dynamique : adresse portant la session délivrée au scan, le jeton affiché ayant expiré entre-temps. */
  resumeHref?: string;
}) {
  const router = useRouter();
  const [left, setLeft] = useState(initialSeconds);
  const [waited, setWaited] = useState(0);

  useEffect(() => {
    // Échéance ancrée sur le délai calculé par le serveur et l'horloge monotone du navigateur : ni l'heure
    // (souvent décalée) du téléphone ni la mise en arrière-plan de l'onglet ne faussent le décompte.
    const deadline = performance.now() + initialSeconds * 1000;
    const tick = () => setLeft(Math.ceil((deadline - performance.now()) / 1000));
    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [opensAt, initialSeconds]);

  const reached = left <= 0;

  // Chaque rendu serveur délivre une nouvelle adresse : elle ne doit pas relancer le cycle de rechargement.
  const resume = useRef(resumeHref);
  useEffect(() => {
    resume.current = resumeHref;
  }, [resumeHref]);

  useEffect(() => {
    if (!reached) return;
    const reload = () => (resume.current ? router.replace(resume.current, { scroll: false }) : router.refresh());
    reload();
    const timer = setInterval(() => {
      setWaited((value) => value + 1);
      reload();
    }, POLL_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [reached, router]);

  if (reached) {
    return (
      <div className="mt-6 rounded-2xl border border-line bg-paper p-5 text-center shadow-sm" aria-live="polite">
        <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-4 border-mint border-t-forest" />
        <p className="mt-3 font-semibold text-forest-deep">
          {waitingForOrganizer ? "En attente d'ouverture par l'organisateur…" : "Ouverture de l'émargement…"}
        </p>
        <p className="mt-1 text-xs text-muted">
          La page se met à jour automatiquement{waited > 0 ? ` (vérification toutes les ${POLL_SECONDS} s)` : ""}.{" "}
          {resumeHref
            ? "Votre accès reste valable 15 minutes après l'heure d'ouverture prévue ; au-delà, scannez de nouveau le QR affiché dans la salle."
            : "Inutile de rescanner le QR."}
        </p>
      </div>
    );
  }

  const { days, hours, minutes, seconds } = formatRemaining(left);
  const blocks = [
    ...(days > 0 ? [{ value: days, label: days > 1 ? "jours" : "jour" }] : []),
    { value: hours, label: "heures" },
    { value: minutes, label: "minutes" },
    { value: seconds, label: "secondes" },
  ];

  return (
    <div className="mt-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-leaf">Ouverture de l&apos;émargement dans</p>
      <div className="mt-3 grid grid-flow-col auto-cols-fr gap-2" role="timer" aria-label={`Ouverture le ${opensAtLabel}`}>
        {blocks.map((block) => (
          <div key={block.label} className="rounded-2xl border border-line bg-paper px-2 py-3 text-center shadow-sm">
            <span className="block font-display text-3xl tabular-nums text-forest-deep">
              {String(block.value).padStart(2, "0")}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{block.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">
        Ouverture prévue le {opensAtLabel} (heure d&apos;Abidjan). Gardez cette page ouverte : le formulaire apparaîtra
        automatiquement.
      </p>
    </div>
  );
}
