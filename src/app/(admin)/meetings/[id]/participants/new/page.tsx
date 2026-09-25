"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, Input, PageHeader, Select } from "@/components/ui";

export default function ManualAttendancePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    const res = await fetch(`/api/meetings/${id}/attendances`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        civility: formData.get("civility"),
        lastName: formData.get("lastName"),
        firstNames: formData.get("firstNames"),
        jobTitle: formData.get("jobTitle"),
        organization: formData.get("organization"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        method: "ADMIN_MANUAL",
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Impossible d'enregistrer");
      return;
    }
    router.push(`/meetings/${id}?tab=participants`);
  }

  return (
    <div>
      <PageHeader title="Ajout manuel" subtitle="Pour un participant sans smartphone ou hors connexion." />
      <Card>
        <form action={onSubmit} className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Civilité</label>
            <Select name="civility" defaultValue="M">
              <option value="M">M.</option>
              <option value="MME">Mme</option>
              <option value="MLLE">Mlle</option>
            </Select>
          </div>
          <div>
            <label className="label">Nom</label>
            <Input name="lastName" required />
          </div>
          <div>
            <label className="label">Prénom(s)</label>
            <Input name="firstNames" required />
          </div>
          <div>
            <label className="label">Fonction</label>
            <Input name="jobTitle" required />
          </div>
          <div>
            <label className="label">Structure</label>
            <Input name="organization" required />
          </div>
          <div>
            <label className="label">Email</label>
            <Input name="email" type="email" />
          </div>
          <div>
            <label className="label">Téléphone</label>
            <Input name="phone" />
          </div>
          {error ? <p className="md:col-span-2 text-sm text-danger">{error}</p> : null}
          <div className="md:col-span-2">
            <Button>Enregistrer en saisie administrateur</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
