"use client";

import { useEffect, useRef, useState } from "react";
import { QrWithLogo, type QrLogo } from "@/components/qr-with-logo";

type Frame = { image: string; secondsLeft: number };

/**
 * QR dynamique : seule l'image est renouvelée (appel léger à l'API), sans recharger la page ni renvoyer le logo.
 * À 0, puis toutes les 3 s tant que le nouveau QR n'est pas arrivé (réseau lent, serveur occupé).
 */
export function DynamicQr({
  meetingId,
  initial,
  logo,
  className,
}: {
  meetingId: string;
  initial: Frame;
  logo: QrLogo | null;
  className?: string;
}) {
  const [frame, setFrame] = useState(initial);
  const [left, setLeft] = useState(initial.secondsLeft);
  const [ended, setEnded] = useState(false);
  /** Problème visible à l'écran : un QR périmé ne doit pas rester affiché comme s'il était valable. */
  const [problem, setProblem] = useState<"session" | "network" | null>(null);
  const loading = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setLeft((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (ended || loading.current) return;
    if (!(left === 0 || (left < 0 && left % 3 === 0))) return;
    loading.current = true;
    fetch(`/api/meetings/${meetingId}/qr?image=1`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 409) {
          setEnded(true);
          return;
        }
        if (res.status === 401 || res.status === 403) {
          setProblem("session");
          return;
        }
        if (!res.ok) {
          if (left <= -9) setProblem("network");
          return;
        }
        const data = (await res.json()) as { image?: string; secondsLeft?: number | null };
        if (data.image && typeof data.secondsLeft === "number") {
          setFrame({ image: data.image, secondsLeft: data.secondsLeft });
          setLeft(data.secondsLeft);
          setProblem(null);
        }
      })
      .catch(() => {
        if (left <= -9) setProblem("network");
      })
      .finally(() => {
        loading.current = false;
      });
  }, [left, ended, meetingId]);

  if (ended) {
    return <p className="py-16 text-sm font-semibold text-muted">Réunion clôturée : l&apos;émargement est terminé.</p>;
  }
  if (problem === "session") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center" role="alert">
        <p className="max-w-xs text-sm font-semibold text-danger">Votre session a expiré : le QR n&apos;est plus renouvelé.</p>
        <a href={`/login?callbackUrl=${encodeURIComponent(`/meetings/${meetingId}/qr`)}`} className="btn-primary px-4 py-2 text-sm">
          Se reconnecter
        </a>
      </div>
    );
  }
  return (
    <div className="relative">
      <QrWithLogo src={frame.image} logo={logo} className={`${className ?? ""} ${problem ? "opacity-30" : ""}`} />
      {problem === "network" ? (
        <p role="alert" className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-4 text-center text-sm font-semibold text-danger">
          Connexion au serveur perdue : nouvelle tentative toutes les 3 s…
        </p>
      ) : null}
    </div>
  );
}

export function DynamicQrStatus({ ttl }: { ttl: number }) {
  return <p className="mt-2 text-xs text-muted">QR dynamique · renouvelé toutes les {ttl} s</p>;
}
