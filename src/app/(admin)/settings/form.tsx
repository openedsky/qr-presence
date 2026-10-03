"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, RequiredLegend, Textarea } from "@/components/ui";
import { apiFetch, confirmAction, notifyError, notifySuccess, readError } from "@/lib/alerts";

export function SettingsForm({
  settings,
}: {
  settings: {
    organizationName: string;
    ministryName: string;
    appName: string;
    appTagline: string;
    publicBaseUrl: string;
    retentionMonths: number;
    emailRequiredDefault: boolean;
    signatureRequiredDefault: boolean;
    dynamicQrSeconds: number;
    rateLimitPerMinute: number;
    privacyNotice: string;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    const ok = await confirmAction({
      title: "Enregistrer les paramètres ?",
      text: "Les modifications s'appliquent immédiatement à toute la plateforme.",
      confirmText: "Enregistrer",
    });
    if (!ok) return;
    setPending(true);
    const res = await apiFetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationName: formData.get("organizationName"),
        ministryName: formData.get("ministryName"),
        appName: formData.get("appName"),
        appTagline: formData.get("appTagline"),
        retentionMonths: Number(formData.get("retentionMonths")),
        dynamicQrSeconds: Number(formData.get("dynamicQrSeconds")),
        rateLimitPerMinute: Number(formData.get("rateLimitPerMinute")),
        emailRequiredDefault: formData.get("emailRequiredDefault") === "on",
        signatureRequiredDefault: formData.get("signatureRequiredDefault") === "on",
        privacyNotice: formData.get("privacyNotice"),
      }),
    });
    setPending(false);
    if (!res.ok) {
      await notifyError("Enregistrement impossible", await readError(res));
      return;
    }
    void notifySuccess("Paramètres enregistrés");
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget));
      }}
      className="grid gap-5 md:grid-cols-2"
    >
      <RequiredLegend className="md:col-span-2" />
      <Field label="Organisation" required htmlFor="organizationName">
        <Input id="organizationName" name="organizationName" required minLength={2} defaultValue={settings.organizationName} />
      </Field>
      <Field label="Ministère de tutelle" required htmlFor="ministryName">
        <Input id="ministryName" name="ministryName" required minLength={2} defaultValue={settings.ministryName} />
      </Field>
      <Field label="Nom de l'application" required htmlFor="appName">
        <Input id="appName" name="appName" required minLength={2} defaultValue={settings.appName} />
      </Field>
      <Field label="Slogan" htmlFor="appTagline">
        <Input id="appTagline" name="appTagline" defaultValue={settings.appTagline} />
      </Field>
      <Field
        label="URL publique"
        htmlFor="publicBaseUrl"
        hint="Adresse des QR codes et des liens de vérification. Elle se règle au déploiement (variable APP_URL)."
      >
        <Input id="publicBaseUrl" readOnly value={settings.publicBaseUrl} className="bg-mint/40" />
      </Field>
      <Field
        label="Conservation des données (mois)"
        required
        htmlFor="retentionMonths"
        hint="Au-delà, après clôture, les présences sont anonymisées et les signatures supprimées automatiquement."
      >
        <Input id="retentionMonths" type="number" min={12} max={240} required name="retentionMonths" defaultValue={settings.retentionMonths} />
      </Field>
      <Field label="Renouvellement QR dynamique (secondes)" required htmlFor="dynamicQrSeconds">
        <Input id="dynamicQrSeconds" type="number" min={15} max={180} required name="dynamicQrSeconds" defaultValue={settings.dynamicQrSeconds} />
      </Field>
      <Field label="Limite de soumissions par minute" required htmlFor="rateLimitPerMinute">
        <Input id="rateLimitPerMinute" type="number" min={5} max={200} required name="rateLimitPerMinute" defaultValue={settings.rateLimitPerMinute} />
      </Field>
      <label className="check-tile">
        <input type="checkbox" name="emailRequiredDefault" defaultChecked={settings.emailRequiredDefault} />
        <span>Email obligatoire par défaut</span>
      </label>
      <label className="check-tile">
        <input type="checkbox" name="signatureRequiredDefault" defaultChecked={settings.signatureRequiredDefault} />
        <span>Signature obligatoire par défaut</span>
      </label>
      <Field label="Mention de confidentialité" required htmlFor="privacyNotice" className="md:col-span-2">
        <Textarea id="privacyNotice" name="privacyNotice" required minLength={10} defaultValue={settings.privacyNotice} />
      </Field>
      <div className="md:col-span-2">
        <Button loading={pending}>{pending ? "Enregistrement…" : "Enregistrer les paramètres"}</Button>
      </div>
    </form>
  );
}
