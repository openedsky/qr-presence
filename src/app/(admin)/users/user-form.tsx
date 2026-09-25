"use client";

import { useRouter } from "next/navigation";
import { Button, Input, Select } from "@/components/ui";

export function UserForm() {
  const router = useRouter();

  async function onSubmit(formData: FormData) {
    await fetch("/api/users", {
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
        password: formData.get("password"),
        active: true,
      }),
    });
    router.refresh();
  }

  return (
    <form action={onSubmit} className="mt-4 grid gap-3">
      <Input name="lastName" placeholder="Nom" required />
      <Input name="firstName" placeholder="Prénom" required />
      <Input name="email" type="email" placeholder="Email" required />
      <Input name="password" type="password" placeholder="Mot de passe temporaire" required />
      <Input name="jobTitle" placeholder="Fonction" />
      <Input name="organization" placeholder="Structure" defaultValue="SODEFOR" />
      <Input name="phone" placeholder="Téléphone" />
      <Select name="role" defaultValue="ORGANIZER">
        <option value="SUPER_ADMIN">Super administrateur</option>
        <option value="MEETING_ADMIN">Administrateur réunions</option>
        <option value="ORGANIZER">Organisateur</option>
        <option value="SECRETARY">Secrétaire</option>
        <option value="AUDITOR">Auditeur</option>
        <option value="USER">Utilisateur</option>
      </Select>
      <Button>Créer</Button>
    </form>
  );
}
