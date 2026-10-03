"use client";

import { useState } from "react";

type Result = { tone: "ok" | "ko"; text: string } | null;

/** Le fichier reste sur l'appareil : l'empreinte est calculée dans le navigateur puis comparée. */
export function HashCheck({ expected }: { expected: string }) {
  const [result, setResult] = useState<Result>(null);
  const [busy, setBusy] = useState(false);

  async function check(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      setResult(
        hex === expected.toLowerCase()
          ? { tone: "ok", text: "Fichier authentique : identique au document enregistré." }
          : { tone: "ko", text: "Fichier différent du document enregistré : il a été modifié ou ne correspond pas." },
      );
    } catch {
      setResult({ tone: "ko", text: "Impossible de lire ce fichier." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-line bg-white/60 p-4">
      <p className="text-sm font-semibold text-forest-deep">Contrôler un fichier PDF</p>
      <p className="mt-1 text-xs text-muted">
        Sélectionnez le PDF reçu : son empreinte est calculée sur votre appareil (rien n&apos;est envoyé).
      </p>
      <input
        type="file"
        accept="application/pdf,.pdf"
        disabled={busy}
        onChange={(event) => check(event.target.files?.[0])}
        className="mt-3 block w-full text-xs"
      />
      {result ? (
        <p className={`mt-3 text-sm font-semibold ${result.tone === "ok" ? "text-forest" : "text-danger"}`}>
          {result.text}
        </p>
      ) : null}
    </div>
  );
}
