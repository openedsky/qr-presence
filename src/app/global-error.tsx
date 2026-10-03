"use client";

/** Erreur dans la mise en page racine : document autonome (les styles globaux ne sont pas chargés). */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", background: "#f6f8f5", color: "#14281d" }}>
        <title>Erreur — SODEFOR Présences</title>
        <main style={{ maxWidth: "28rem", margin: "15vh auto 0", padding: "0 1.5rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Le service est momentanément indisponible</h1>
          <p style={{ color: "#4b5d52", lineHeight: 1.5 }}>
            Une erreur inattendue est survenue. Réessayez dans quelques instants ; si vous émargiez, votre saisie n&apos;a pas
            été enregistrée tant qu&apos;aucune confirmation ne s&apos;est affichée.
          </p>
          {error.digest ? <p style={{ fontSize: "0.75rem", color: "#6b7a70" }}>Référence : {error.digest}</p> : null}
          <button
            onClick={() => retry()}
            style={{
              marginTop: "1rem",
              padding: "0.7rem 1.4rem",
              border: 0,
              borderRadius: "0.75rem",
              background: "#14532d",
              color: "#fff",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
