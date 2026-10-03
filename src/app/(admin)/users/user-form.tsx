"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, RequiredLegend, Select } from "@/components/ui";
import { apiFetch, notifyError, readError, showSecret } from "@/lib/alerts";

export const ROLE_OPTIONS = [
  { value: "SUPER_ADMIN", label: "Super administrateur" },
  { value: "MEETING_ADMIN", label: "Administrateur réunions" },
  { value: "ORGANIZER", label: "Organisateur" },
  { value: "SECRETARY", label: "Secrétaire" },
  { value: "AUDITOR", label: "Auditeur" },
  { value: "USER", label: "Utilisateur" },
];

export function UserForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const res = await apiFetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        firstName: formData.get("firstName"),
        lastName: formData.get("lastName"),
        jobTitle: formData.get("jobTitle"),
        organization: formData.get("organization"),
        phone: formData.get("phone"),
        role: formData.get("role"),
        active: true,
      }),
    });
    setPending(false);
    if (!res.ok) {
      await notifyError("Création impossible", await readError(res, "Vérifiez les informations saisies."));
      return;
    }
    const { temporaryPassword } = (await res.json()) as { temporaryPassword: string };
    const email = String(formData.get("email"));
    formRef.current?.reset();
    router.refresh();
    await showSecret({
      title: "Compte créé",
      text: `Mot de passe provisoire de ${email} :`,
      secret: temporaryPassword,
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget));
      }}
      className="mt-4 grid gap-4"
    >
      <RequiredLegend />
      <Field label="Nom" required htmlFor="u-lastName">
        <Input id="u-lastName" name="lastName" required minLength={2} maxLength={80} />
      </Field>
      <Field label="Prénom" required htmlFor="u-firstName">
        <Input id="u-firstName" name="firstName" required minLength={2} maxLength={80} />
      </Field>
      <Field label="Email" required htmlFor="u-email" hint="Un mot de passe provisoire sera généré et affiché une seule fois.">
        <Input id="u-email" name="email" type="email" required autoComplete="off" />
      </Field>
      <Field label="Rôle" required htmlFor="u-role">
        <Select id="u-role" name="role" required defaultValue="ORGANIZER">
          {ROLE_OPTIONS.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Fonction" htmlFor="u-jobTitle">
        <Input id="u-jobTitle" name="jobTitle" maxLength={120} />
      </Field>
      <Field label="Structure" htmlFor="u-organization">
        <Input id="u-organization" name="organization" maxLength={160} defaultValue="SODEFOR" />
      </Field>
      <Field label="Téléphone" htmlFor="u-phone">
        <Input id="u-phone" name="phone" type="tel" />
      </Field>
      <Button loading={pending}>{pending ? "Création…" : "Créer l'utilisateur"}</Button>
    </form>
  );
}
