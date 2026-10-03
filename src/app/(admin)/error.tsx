"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-enter mx-auto max-w-lg py-16 text-center">
      <span className="pop-in mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-warn">
        <AlertTriangle className="h-8 w-8" />
      </span>
      <h1 className="mt-6 font-display text-2xl font-semibold text-forest-deep">Cette page n&apos;a pas pu s&apos;afficher</h1>
      <p className="mt-2 text-sm text-muted">
        Une erreur temporaire est survenue (réseau ou serveur occupé). Vos données ne sont pas perdues.
        {error.digest ? <span className="mt-1 block text-xs">Référence : {error.digest}</span> : null}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={() => retry()}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm"
        >
          <RotateCcw className="h-4 w-4" /> Réessayer
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-mint"
        >
          Tableau de bord
        </Link>
      </div>
    </div>
  );
}
