"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";

type Values = {
  title: string;
  internalRef?: string;
  description?: string;
  type: string;
  location?: string;
  videoConferenceUrl?: string;
  startsAt: string;
  endsAt?: string;
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  toleranceMinutes: number;
  qrMode: string;
  qrSecurityLevel: number;
  allowGuests: boolean;
  showPublicAttendance: boolean;
  expectedParticipants?: number;
  signatureRequired: boolean;
  emailRequired: boolean;
  internalNotes?: string;
};

function toLocal(value?: string | Date | null) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function MeetingForm({
  actionUrl,
  method = "POST",
  initial,
}: {
  actionUrl: string;
  method?: "POST" | "PATCH";
  initial?: Partial<Values>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const payload = {
      title: formData.get("title"),
      internalRef: formData.get("internalRef"),
      description: formData.get("description"),
      type: formData.get("type"),
      location: formData.get("location"),
      videoConferenceUrl: formData.get("videoConferenceUrl"),
      startsAt: formData.get("startsAt"),
      endsAt: formData.get("endsAt"),
      registrationOpensAt: formData.get("registrationOpensAt"),
      registrationClosesAt: formData.get("registrationClosesAt"),
      toleranceMinutes: Number(formData.get("toleranceMinutes") || 15),
      qrMode: formData.get("qrMode"),
      qrSecurityLevel: Number(formData.get("qrSecurityLevel") || 1),
      allowGuests: formData.get("allowGuests") === "on",
      showPublicAttendance: formData.get("showPublicAttendance") === "on",
      expectedParticipants: formData.get("expectedParticipants")
        ? Number(formData.get("expectedParticipants"))
        : undefined,
      signatureRequired: formData.get("signatureRequired") === "on",
      emailRequired: formData.get("emailRequired") === "on",
      internalNotes: formData.get("internalNotes"),
    };
    const res = await fetch(actionUrl, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(json.error ?? "Enregistrement impossible");
      return;
    }
    router.push(`/meetings/${json.id}`);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="grid gap-5">
      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label">Objet</label>
            <Input name="title" required defaultValue={initial?.title} />
          </div>
          <div>
            <label className="label">Référence interne</label>
            <Input name="internalRef" defaultValue={initial?.internalRef} placeholder="Automatique si vide" />
          </div>
          <div>
            <label className="label">Type</label>
            <Select name="type" defaultValue={initial?.type ?? "COMITE"}>
              <option value="COMITE">Comité</option>
              <option value="ATELIER">Atelier</option>
              <option value="SEMINAIRE">Séminaire</option>
              <option value="ASSEMBLEE">Assemblée</option>
              <option value="FORMATION">Formation</option>
              <option value="AUTRE">Autre</option>
            </Select>
          </div>
          <div>
            <label className="label">Lieu</label>
            <Input name="location" defaultValue={initial?.location} />
          </div>
          <div>
            <label className="label">Lien visioconférence</label>
            <Input name="videoConferenceUrl" defaultValue={initial?.videoConferenceUrl} />
          </div>
          <div>
            <label className="label">Début</label>
            <Input type="datetime-local" name="startsAt" required defaultValue={toLocal(initial?.startsAt)} />
          </div>
          <div>
            <label className="label">Fin</label>
            <Input type="datetime-local" name="endsAt" defaultValue={toLocal(initial?.endsAt)} />
          </div>
          <div>
            <label className="label">Ouverture émargement</label>
            <Input type="datetime-local" name="registrationOpensAt" defaultValue={toLocal(initial?.registrationOpensAt)} />
          </div>
          <div>
            <label className="label">Fermeture émargement</label>
            <Input type="datetime-local" name="registrationClosesAt" defaultValue={toLocal(initial?.registrationClosesAt)} />
          </div>
          <div>
            <label className="label">Tolérance (minutes)</label>
            <Input type="number" name="toleranceMinutes" defaultValue={initial?.toleranceMinutes ?? 15} />
          </div>
          <div>
            <label className="label">Participants attendus</label>
            <Input type="number" name="expectedParticipants" defaultValue={initial?.expectedParticipants} />
          </div>
          <div>
            <label className="label">Mode QR</label>
            <Select name="qrMode" defaultValue={initial?.qrMode ?? "STATIC"}>
              <option value="STATIC">Statique</option>
              <option value="DYNAMIC">Dynamique</option>
            </Select>
          </div>
          <div>
            <label className="label">Niveau de sécurité QR</label>
            <Select name="qrSecurityLevel" defaultValue={String(initial?.qrSecurityLevel ?? 1)}>
              <option value="1">1 — QR statique</option>
              <option value="2">2 — QR + fenêtre horaire</option>
              <option value="3">3 — QR dynamique</option>
              <option value="4">4 — QR dynamique + contrôle</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Description</label>
            <Textarea name="description" defaultValue={initial?.description} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Notes internes</label>
            <Textarea name="internalNotes" defaultValue={initial?.internalNotes} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allowGuests" defaultChecked={initial?.allowGuests ?? true} />
            Autoriser les invités externes
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="showPublicAttendance" defaultChecked={initial?.showPublicAttendance ?? false} />
            Afficher la liste publique
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="signatureRequired" defaultChecked={initial?.signatureRequired ?? true} />
            Signature obligatoire
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="emailRequired" defaultChecked={initial?.emailRequired ?? true} />
            Email obligatoire
          </label>
        </div>
      </Card>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer la réunion"}</Button>
    </form>
  );
}
