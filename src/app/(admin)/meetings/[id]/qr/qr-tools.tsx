"use client";

import { useState } from "react";
import { Copy, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { notifyError, notifySuccess, readError } from "@/lib/alerts";

export function QrTools({
  meetingId,
  url,
  printable,
}: {
  meetingId: string;
  url: string;
  printable: boolean;
}) {
  const [downloading, setDownloading] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      void notifySuccess("Lien copié", "Vous pouvez le coller dans une convocation.");
    } catch {
      await notifyError("Copie impossible", url);
    }
  }

  async function download() {
    if (!printable) {
      await notifyError(
        "QR dynamique",
        "Ce QR se renouvelle automatiquement : affichez-le à l'écran de la salle. Passez la réunion en mode statique pour l'imprimer.",
      );
      return;
    }
    setDownloading(true);
    let res: Response;
    let blob: Blob;
    try {
      res = await fetch(`/api/meetings/${meetingId}/qr/poster`);
      if (!res.ok) {
        await notifyError("Téléchargement impossible", await readError(res));
        return;
      }
      blob = await res.blob();
    } catch {
      await notifyError("Téléchargement impossible", "Connexion au serveur interrompue. Réessayez.");
      return;
    } finally {
      setDownloading(false);
    }
    const filename =
      /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "qrcode-reunion.pdf";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    void notifySuccess("Affiche téléchargée", "Format A4, prête à imprimer.");
  }

  return (
    <div className="no-print flex flex-wrap justify-center gap-2">
      <Button onClick={download} disabled={downloading}>
        <Download className="h-4 w-4" />
        {downloading ? "Génération…" : "Télécharger pour impression (A4)"}
      </Button>
      <Button variant="outline" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Imprimer cette page
      </Button>
      {printable ? (
        <Button variant="outline" onClick={copy}>
          <Copy className="h-4 w-4" /> Copier le lien
        </Button>
      ) : null}
    </div>
  );
}
