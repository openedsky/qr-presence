"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, RequiredLegend } from "@/components/ui";
import { apiFetch, notifyError, notifySuccess, readError } from "@/lib/alerts";

type Values = { firstName: string; lastName: string; jobTitle: string; organization: string; phone: string };

export function ProfileForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const res = await apiFetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    setPending(false);
    if (!res.ok) {
      await notifyError("Mise à jour impossible", await readError(res));
      return;
    }
    const body = (await res.json()) as { unchanged?: boolean };
    void notifySuccess(body.unchanged ? "Aucune modification" : "Profil mis à jour");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 md:grid-cols-2">
      <RequiredLegend className="md:col-span-2" />
      <Field label="Prénom(s)" required htmlFor="firstName">
        <Input id="firstName" name="firstName" required minLength={2} maxLength={80} defaultValue={initial.firstName} autoComplete="given-name" />
      </Field>
      <Field label="Nom" required htmlFor="lastName">
        <Input id="lastName" name="lastName" required minLength={2} maxLength={80} defaultValue={initial.lastName} autoComplete="family-name" />
      </Field>
      <Field label="Fonction" htmlFor="jobTitle">
        <Input id="jobTitle" name="jobTitle" maxLength={120} defaultValue={initial.jobTitle} autoComplete="organization-title" />
      </Field>
      <Field label="Structure" htmlFor="organization">
        <Input id="organization" name="organization" maxLength={160} defaultValue={initial.organization} autoComplete="organization" />
      </Field>
      <Field label="Téléphone" htmlFor="phone" hint="Format ivoirien (07 00 00 00 00) ou international (+225…).">
        <Input id="phone" name="phone" type="tel" maxLength={30} defaultValue={initial.phone} autoComplete="tel" />
      </Field>
      <div className="flex items-end md:col-span-2">
        <Button type="submit" loading={pending}>
          {pending ? "Enregistrement…" : "Enregistrer mon profil"}
        </Button>
      </div>
    </form>
  );
}
