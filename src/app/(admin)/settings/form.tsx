"use client";

import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@/components/ui";

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

  async function onSubmit(formData: FormData) {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationName: formData.get("organizationName"),
        ministryName: formData.get("ministryName"),
        appName: formData.get("appName"),
        appTagline: formData.get("appTagline"),
        publicBaseUrl: formData.get("publicBaseUrl"),
        retentionMonths: Number(formData.get("retentionMonths")),
        dynamicQrSeconds: Number(formData.get("dynamicQrSeconds")),
        rateLimitPerMinute: Number(formData.get("rateLimitPerMinute")),
        emailRequiredDefault: formData.get("emailRequiredDefault") === "on",
        signatureRequiredDefault: formData.get("signatureRequiredDefault") === "on",
        privacyNotice: formData.get("privacyNotice"),
      }),
    });
    router.refresh();
  }

  return (
    <form action={onSubmit} className="grid gap-4 md:grid-cols-2">
      <Input name="organizationName" defaultValue={settings.organizationName} />
      <Input name="ministryName" defaultValue={settings.ministryName} />
      <Input name="appName" defaultValue={settings.appName} />
      <Input name="appTagline" defaultValue={settings.appTagline} />
      <Input name="publicBaseUrl" defaultValue={settings.publicBaseUrl} />
      <Input type="number" name="retentionMonths" defaultValue={settings.retentionMonths} />
      <Input type="number" name="dynamicQrSeconds" defaultValue={settings.dynamicQrSeconds} />
      <Input type="number" name="rateLimitPerMinute" defaultValue={settings.rateLimitPerMinute} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="emailRequiredDefault" defaultChecked={settings.emailRequiredDefault} />
        Email obligatoire par défaut
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="signatureRequiredDefault" defaultChecked={settings.signatureRequiredDefault} />
        Signature obligatoire par défaut
      </label>
      <div className="md:col-span-2">
        <Textarea name="privacyNotice" defaultValue={settings.privacyNotice} />
      </div>
      <Button>Enregistrer</Button>
    </form>
  );
}
