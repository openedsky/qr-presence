"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, RefreshCw, RotateCcw, Save } from "lucide-react";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { apiFetch, confirmAction, notifyError, notifySuccess, readError } from "@/lib/alerts";

type Values = {
  title: string;
  subtitle: string;
  headerNote: string;
  footerText: string;
  accentColor: string;
  columns: string[];
  showVerificationQr: boolean;
  ctaText: string;
  steps: string[];
  showUrl: boolean;
};

const COLUMN_LABELS: Record<string, string> = {
  civility: "Civilité",
  jobTitle: "Fonction",
  organization: "Structure",
  email: "Email",
  phone: "Téléphone",
  signature: "Signature",
  time: "Heure d'émargement",
};

export function TemplateEditor({
  kind,
  label,
  allowedColumns,
  customized,
  initial,
  readOnly = false,
}: {
  kind: string;
  label: string;
  allowedColumns: string[];
  customized: boolean;
  initial: Values;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial);
  const [pending, setPending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const urlRef = useRef<string | null>(null);
  const isPoster = kind === "QR_POSTER";
  const isPublic = kind === "LISTE_PUBLIQUE";
  const isOfficial = kind === "LISTE_OFFICIELLE";

  const payload = useCallback(
    (source: Values) => ({
      ...source,
      steps: source.steps.map((step) => step.trim()).filter(Boolean),
      ...(isPoster ? { columns: undefined } : { ctaText: undefined, steps: undefined, showUrl: undefined }),
    }),
    [isPoster],
  );

  const refreshPreview = useCallback(
    async (source: Values) => {
      setPreviewing(true);
      let blob: Blob;
      try {
        const res = await fetch(`/api/pdf-templates/${kind}/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload(source)),
        });
        if (!res.ok) {
          await notifyError("Aperçu impossible", await readError(res));
          return;
        }
        blob = await res.blob();
      } catch {
        await notifyError("Aperçu impossible", "Connexion au serveur interrompue.");
        return;
      } finally {
        setPreviewing(false);
      }
      const url = URL.createObjectURL(blob);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setPreviewUrl(url);
    },
    [kind, payload],
  );

  useEffect(() => {
    const timer = setTimeout(() => void refreshPreview(initial), 0);
    return () => {
      clearTimeout(timer);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [initial, refreshPreview]);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleColumn(column: string) {
    set(
      "columns",
      values.columns.includes(column) ? values.columns.filter((c) => c !== column) : [...values.columns, column],
    );
  }

  async function save() {
    setPending(true);
    let body: { changed?: number };
    try {
      const res = await fetch(`/api/pdf-templates/${kind}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(values)),
      });
      if (!res.ok) {
        await notifyError("Enregistrement impossible", await readError(res));
        return;
      }
      body = (await res.json()) as { changed?: number };
    } catch {
      await notifyError("Enregistrement impossible", "Connexion au serveur interrompue. Réessayez.");
      return;
    } finally {
      setPending(false);
    }
    void notifySuccess(body.changed ? "Modèle enregistré" : "Aucune modification", body.changed ? "Les prochains PDF utiliseront ce modèle." : undefined);
    void refreshPreview(values);
    router.refresh();
  }

  async function reset() {
    const ok = await confirmAction({
      title: "Revenir au modèle par défaut ?",
      text: "Vos personnalisations de ce modèle seront perdues (l'opération est journalisée).",
      confirmText: "Réinitialiser",
      danger: true,
    });
    if (!ok) return;
    const res = await apiFetch(`/api/pdf-templates/${kind}`, { method: "DELETE" });
    if (!res.ok) {
      await notifyError("Réinitialisation impossible", await readError(res));
      return;
    }
    void notifySuccess("Modèle réinitialisé");
    router.refresh();
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-forest-deep">{label}</h2>
          <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-forest">
            {customized ? "Personnalisé" : "Par défaut"}
          </span>
        </div>
        <div className="grid gap-5">
          <Field label={isPoster ? "Titre au-dessus de l'objet" : "Titre du document"} required htmlFor="tpl-title">
            <Input id="tpl-title" value={values.title} maxLength={120} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label={isPoster ? "Sous-titre de l'organisation" : "Sous-titre"} htmlFor="tpl-subtitle">
              <Input id="tpl-subtitle" value={values.subtitle} maxLength={160} onChange={(e) => set("subtitle", e.target.value)} />
            </Field>
            <Field label="Mention d'en-tête" htmlFor="tpl-note" hint="Ex. : République de Côte d'Ivoire">
              <Input id="tpl-note" value={values.headerNote} maxLength={160} onChange={(e) => set("headerNote", e.target.value)} />
            </Field>
          </div>
          <Field label="Couleur d'accent" htmlFor="tpl-color" hint="Titres, filets et en-tête du tableau.">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={values.accentColor}
                onChange={(e) => set("accentColor", e.target.value)}
                className="h-11 w-14 cursor-pointer rounded-xl border border-line bg-paper p-1"
                aria-label="Couleur d'accent"
              />
              <Input id="tpl-color" value={values.accentColor} maxLength={7} className="font-mono uppercase" onChange={(e) => set("accentColor", e.target.value)} />
            </div>
          </Field>

          {isPoster ? (
            <>
              <Field label="Appel à l'action" required htmlFor="tpl-cta">
                <Input id="tpl-cta" value={values.ctaText} maxLength={60} onChange={(e) => set("ctaText", e.target.value)} />
              </Field>
              <div>
                <p className="label">Étapes affichées sous le QR code</p>
                <div className="grid gap-2 md:grid-cols-3">
                  {values.steps.map((step, index) => (
                    <Input
                      key={index}
                      value={step}
                      maxLength={40}
                      placeholder={`Étape ${index + 1}`}
                      aria-label={`Étape ${index + 1}`}
                      onChange={(e) => set("steps", values.steps.map((s, i) => (i === index ? e.target.value : s)))}
                    />
                  ))}
                </div>
              </div>
              <label className="check-tile">
                <input type="checkbox" checked={values.showUrl} onChange={(e) => set("showUrl", e.target.checked)} />
                <span>Afficher l&apos;adresse web sous le QR code (pour les participants sans lecteur QR)</span>
              </label>
            </>
          ) : (
            <>
              <div>
                <p className="label">Colonnes du tableau</p>
                <p className="mb-2 text-xs text-muted">« N° » et « Nom et prénom » sont toujours présents.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {allowedColumns.map((column) => {
                    const locked = isOfficial && column === "signature";
                    return (
                      <label key={column} className="check-tile py-2.5">
                        <input
                          type="checkbox"
                          checked={locked || values.columns.includes(column)}
                          disabled={locked}
                          onChange={() => toggleColumn(column)}
                        />
                        <span>
                          {COLUMN_LABELS[column] ?? column}
                          {locked ? <span className="ml-1 text-xs text-muted">(obligatoire)</span> : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {isPublic ? (
                  <p className="mt-2 text-xs text-muted">Email, téléphone et signature ne sont jamais publiés sur la liste publique.</p>
                ) : (
                  <p className="mt-2 text-xs text-muted">
                    Minimisation des données : n&apos;ajoutez l&apos;email ou le téléphone que si la liste l&apos;exige.
                  </p>
                )}
              </div>
              {!isPublic ? (
                <label className="check-tile">
                  <input
                    type="checkbox"
                    checked={isOfficial || values.showVerificationQr}
                    disabled={isOfficial}
                    onChange={(e) => set("showVerificationQr", e.target.checked)}
                  />
                  <span>
                    QR code de vérification d&apos;authenticité en bas de page
                    {isOfficial ? <span className="ml-1 text-xs text-muted">(obligatoire sur la liste officielle)</span> : null}
                  </span>
                </label>
              ) : null}
            </>
          )}

          <Field label="Texte de pied de page" htmlFor="tpl-footer" hint="Mention légale, contact ou référence réglementaire.">
            <Textarea id="tpl-footer" value={values.footerText} maxLength={400} className="min-h-20" onChange={(e) => set("footerText", e.target.value)} />
          </Field>
        </div>
        {readOnly ? (
          <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Modèle verrouillé : la liste officielle fait foi, seul un super administrateur peut la modifier.
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2">
          {readOnly ? null : (
            <Button onClick={save} loading={pending} disabled={pending || values.title.trim().length < 3}>
              <Save className="h-4 w-4" /> {pending ? "Enregistrement…" : "Enregistrer le modèle"}
            </Button>
          )}
          <Button variant="outline" onClick={() => refreshPreview(values)} disabled={previewing}>
            <RefreshCw className={previewing ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Actualiser l&apos;aperçu
          </Button>
          {customized && !readOnly ? (
            <Button variant="ghost" onClick={reset}>
              <RotateCcw className="h-4 w-4" /> Réinitialiser
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className="flex min-h-[640px] flex-col p-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <p className="label mb-0">Aperçu (données fictives)</p>
          {previewUrl ? (
            <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-forest hover:underline">
              <Eye className="h-3.5 w-3.5" /> Ouvrir en plein écran
            </a>
          ) : null}
        </div>
        {previewUrl ? (
          <iframe title="Aperçu du modèle PDF" src={previewUrl} className="w-full flex-1 rounded-xl border border-line bg-white" />
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">
            Génération de l&apos;aperçu…
          </div>
        )}
      </Card>
    </div>
  );
}
