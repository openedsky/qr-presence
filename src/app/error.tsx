"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/** Pages publiques (émargement, vérification, connexion) : message neutre, sans renvoi vers l'administration. */
export default function PublicError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page-enter mx-auto max-w-lg px-6 py-20 text-center">
      <span className="pop-in mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-warn">
        <AlertTriangle className="h-8 w-8" aria-hidden />
      </span>
      <h1 className="mt-6 font-display text-2xl font-semibold text-forest-deep">Cette page n&apos;a pas pu s&apos;afficher</h1>
      <p className="mt-2 text-sm text-muted">
        Une erreur temporaire est survenue (réseau ou serveur occupé). Si vous émargiez, votre présence n&apos;est enregistrée
        qu&apos;après l&apos;écran de confirmation : réessayez.
        {error.digest ? <span className="mt-1 block text-xs">Référence : {error.digest}</span> : null}
      </p>
      <button onClick={() => retry()} className="btn-primary mt-6 inline-flex items-center gap-2 px-4 py-2.5 text-sm">
        <RotateCcw className="h-4 w-4" aria-hidden /> Réessayer
      </button>
    </main>
  );
}
