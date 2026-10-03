"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { apiFetch, confirmAction, notifyError, readError, setFlash } from "@/lib/alerts";

type Colors = { backgroundColor: string; cardColor: string; sidebarColor: string; primaryColor: string };

const DEFAULTS: Colors = {
  backgroundColor: "#f4f6f1",
  cardColor: "#ffffff",
  sidebarColor: "#0b3d24",
  primaryColor: "#14532d",
};

const FIELDS: { key: keyof Colors; label: string; hint: string }[] = [
  { key: "backgroundColor", label: "Fond de l'application", hint: "Arrière-plan général des pages." },
  { key: "cardColor", label: "Fond des cartes", hint: "Blocs, tableaux et formulaires." },
  { key: "sidebarColor", label: "Fond du menu", hint: "Menu de gauche et panneau de connexion. Textes en blanc : préférez une teinte foncée." },
  { key: "primaryColor", label: "Fond des boutons", hint: "Boutons principaux et onglets actifs. Textes en blanc : préférez une teinte foncée." },
];

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste du texte blanc sur la couleur (WCAG : 4,5 minimum pour un texte courant). */
function whiteContrast(hex: string) {
  return 1.05 / (luminance(hex) + 0.05);
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function AppearanceForm({ initial }: { initial: Colors }) {
  const [colors, setColors] = useState<Colors>(initial);
  const [pending, setPending] = useState(false);
  const valid = Object.values(colors).every((value) => HEX.test(value));

  function update(key: keyof Colors, value: string) {
    setColors((current) => ({ ...current, [key]: value.startsWith("#") ? value : `#${value}` }));
  }

  async function save() {
    const ok = await confirmAction({
      title: "Appliquer ces couleurs ?",
      text: "Elles s'appliquent immédiatement à tous les utilisateurs.",
      confirmText: "Appliquer",
    });
    if (!ok) return;
    setPending(true);
    const res = await apiFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(colors),
    });
    setPending(false);
    if (!res.ok) {
      await notifyError("Enregistrement impossible", await readError(res));
      return;
    }
    setFlash({ icon: "success", title: "Couleurs appliquées" });
    window.location.reload();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <Card className="p-6">
        <div className="grid gap-5 md:grid-cols-2">
          {FIELDS.map(({ key, label, hint }) => {
            const contrast = HEX.test(colors[key]) ? whiteContrast(colors[key]) : 0;
            const needsContrast = key === "sidebarColor" || key === "primaryColor";
            return (
              <div key={key}>
                <label className="label" htmlFor={key}>
                  {label}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label={label}
                    value={HEX.test(colors[key]) ? colors[key] : "#000000"}
                    onChange={(event) => update(key, event.target.value)}
                    className="h-11 w-14 cursor-pointer rounded-xl border border-line bg-paper p-1"
                  />
                  <input
                    id={key}
                    value={colors[key]}
                    onChange={(event) => update(key, event.target.value.trim())}
                    maxLength={7}
                    className="field font-mono uppercase"
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted">{hint}</p>
                {needsContrast && contrast > 0 && contrast < 4.5 ? (
                  <p className="mt-1 text-xs font-semibold text-warn">
                    Contraste du texte blanc insuffisant ({contrast.toFixed(1)} : 1) — choisissez une teinte plus foncée.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={save} loading={pending} disabled={pending || !valid}>
            {pending ? "Application…" : "Appliquer les couleurs"}
          </Button>
          <Button variant="outline" onClick={() => setColors(DEFAULTS)}>
            <RotateCcw className="h-4 w-4" /> Couleurs SODEFOR par défaut
          </Button>
        </div>
      </Card>

      <Card className="h-fit p-4">
        <p className="label">Aperçu</p>
        <div className="flex h-64 overflow-hidden rounded-xl border border-line" style={{ background: colors.backgroundColor }}>
          <div className="flex w-20 flex-col gap-2 p-3" style={{ background: colors.sidebarColor }}>
            <span className="h-7 w-7 rounded-lg bg-white/90" />
            <span className="mt-2 h-2 w-12 rounded bg-white/60" />
            <span className="h-2 w-10 rounded bg-white/35" />
            <span className="h-2 w-12 rounded bg-white/35" />
            <span className="h-2 w-9 rounded bg-white/35" />
          </div>
          <div className="flex-1 space-y-3 p-4">
            <span className="block h-3 w-32 rounded bg-black/15" />
            <div className="rounded-lg border border-black/10 p-3 shadow-sm" style={{ background: colors.cardColor }}>
              <span className="block h-2 w-40 rounded bg-black/15" />
              <span className="mt-2 block h-2 w-28 rounded bg-black/10" />
              <span
                className="mt-4 inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: colors.primaryColor }}
              >
                Bouton principal
              </span>
            </div>
            <div className="rounded-lg border border-black/10 p-3 shadow-sm" style={{ background: colors.cardColor }}>
              <span className="block h-2 w-36 rounded bg-black/15" />
              <span className="mt-2 block h-2 w-24 rounded bg-black/10" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
