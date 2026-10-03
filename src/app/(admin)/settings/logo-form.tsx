"use client";

import { useRef, useState } from "react";
import { ImageUp, RotateCcw, ShieldCheck } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { QrWithLogo, type QrLogo } from "@/components/qr-with-logo";
import { apiFetch, confirmAction, notifyError, readError, setFlash } from "@/lib/alerts";
import { cn } from "@/lib/utils";

const MAX_BYTES = 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg"];

type State = { logo: QrLogo; custom: boolean };

function loadDimensions(dataUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Image illisible"));
    image.src = dataUrl;
  });
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function LogoForm({
  initial,
  defaultLogo,
  qrLogoEnabled,
  sampleQr,
}: {
  initial: State;
  defaultLogo: QrLogo;
  qrLogoEnabled: boolean;
  sampleQr: string;
}) {
  const [state, setState] = useState<State>(initial);
  const [enabled, setEnabled] = useState(qrLogoEnabled);
  const [changedLogo, setChangedLogo] = useState<string | null | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dirty = changedLogo !== undefined || enabled !== qrLogoEnabled;

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      await notifyError("Format non pris en charge", "Utilisez une image PNG ou JPEG.");
      return;
    }
    if (file.size > MAX_BYTES) {
      await notifyError("Fichier trop lourd", "Le logo ne doit pas dépasser 1 Mo.");
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      const { width, height } = await loadDimensions(dataUrl);
      if (width < 32 || height < 32) {
        await notifyError("Image trop petite", "Le logo doit mesurer au moins 32 × 32 pixels.");
        return;
      }
      setState({ logo: { dataUrl, width, height }, custom: true });
      setChangedLogo(dataUrl);
    } catch {
      await notifyError("Image illisible", "Le fichier sélectionné n'a pas pu être lu.");
    }
  }

  function restoreDefault() {
    setState({ logo: defaultLogo, custom: false });
    setChangedLogo(initial.custom ? null : undefined);
  }

  async function save() {
    const ok = await confirmAction({
      title: "Enregistrer le logo ?",
      text: "Il s'applique immédiatement aux QR codes affichés et aux affiches PDF générées.",
      confirmText: "Enregistrer",
    });
    if (!ok) return;
    setPending(true);
    const res = await apiFetch("/api/settings/logo", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(changedLogo !== undefined ? { logoData: changedLogo } : {}), qrLogoEnabled: enabled }),
    });
    setPending(false);
    if (!res.ok) {
      await notifyError("Enregistrement impossible", await readError(res));
      return;
    }
    setFlash({ icon: "success", title: "Logo enregistré" });
    window.location.reload();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Card className="p-6">
        <p className="label">Logo de la structure</p>
        <div className="mt-2 grid gap-5 md:grid-cols-[180px_1fr]">
          <div className="flex h-44 items-center justify-center rounded-2xl border border-line bg-sand p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.logo.dataUrl} alt="Logo actuel" className="max-h-full max-w-full rounded-lg object-contain shadow-sm" />
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void pick(event.dataTransfer.files[0]);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition",
              dragging ? "border-forest bg-mint" : "border-line hover:border-forest/40 hover:bg-mint/50",
            )}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
              <ImageUp className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold text-ink">Glissez votre logo ici ou cliquez pour choisir un fichier</p>
            <p className="text-xs text-muted">PNG ou JPEG · 1 Mo maximum · fond blanc ou transparent recommandé</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(event) => {
                void pick(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          {state.custom ? "Logo personnalisé." : "Logo SODEFOR fourni avec l'application."}
        </p>

        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-paper p-4 transition hover:bg-mint/40">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">Afficher le logo au centre des QR codes</span>
            <span className="mt-0.5 block text-xs text-muted">
              Page QR code d&apos;une réunion et affiche PDF à imprimer.
            </span>
          </span>
        </label>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={save} loading={pending} disabled={pending || !dirty}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
          <Button variant="outline" onClick={restoreDefault} disabled={!state.custom}>
            <RotateCcw className="h-4 w-4" /> Logo SODEFOR par défaut
          </Button>
        </div>
      </Card>

      <Card className="h-fit p-5">
        <p className="label">Aperçu du QR code</p>
        <div className="mt-2 flex justify-center rounded-2xl bg-sand p-6">
          <div className="rounded-3xl border-[3px] border-primary bg-white p-4 shadow-sm">
            <QrWithLogo src={sampleQr} logo={enabled ? state.logo : null} alt="Aperçu" className="h-56 w-56" />
          </div>
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf" />
          Le logo couvre moins de 6 % du QR code : grâce à la correction d&apos;erreur maximale, il reste lisible par tous les
          téléphones.
        </p>
      </Card>
    </div>
  );
}
