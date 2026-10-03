"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button, Card, Field, Input, RequiredLegend, SectionTitle, Select, Textarea } from "@/components/ui";
import { apiFetch, askReason, notifyError, readError, setFlash } from "@/lib/alerts";

export function ManualAttendanceForm({
  meetingId,
  closed,
  emailRequired,
  internalOnly,
  defaultCheckIn,
  earliestCheckIn,
}: {
  meetingId: string;
  closed: boolean;
  emailRequired: boolean;
  internalOnly: boolean;
  defaultCheckIn: string;
  earliestCheckIn: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    let reason: string | null = "";
    if (closed) {
      reason = await askReason({
        title: "Motif de l'ajout",
        text: "La réunion est clôturée : cet ajout produira une nouvelle version de la liste officielle, avec ce motif.",
        placeholder: "Ex. : participant présent, émargement papier oublié",
        confirmText: "Ajouter",
        minLength: 5,
      });
      if (reason === null) return;
    }
    setPending(true);
    const res = await apiFetch(`/api/meetings/${meetingId}/attendances`, {
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
        checkInAt: formData.get("checkInAt"),
        manualReason: formData.get("manualReason"),
        reason,
      }),
    });
    if (!res.ok) {
      setPending(false);
      await notifyError("Enregistrement impossible", await readError(res, "Impossible d'enregistrer"));
      return;
    }
    const json = (await res.json()) as { suspectedDuplicate?: boolean };
    setFlash(
      json.suspectedDuplicate
        ? {
            icon: "warning",
            title: "Participant ajouté — homonyme à vérifier",
            text: "Une personne du même nom est déjà présente : vérifiez qu'il ne s'agit pas d'un doublon.",
          }
        : { icon: "success", title: "Participant ajouté", text: "La saisie est tracée et signalée sur la liste officielle." },
    );
    router.push(`/meetings/${meetingId}?tab=participants`);
  }

  return (
    <Card className="p-6">
      <SectionTitle icon={<UserPlus className="h-4 w-4" />} title="Identité du participant" />
      {closed ? (
        <p className="mb-4 rounded-xl bg-sand px-3 py-2 text-sm text-muted">
          Réunion clôturée : un motif vous sera demandé à l&apos;enregistrement.
        </p>
      ) : null}
      <p className="mb-4 rounded-xl bg-mint/60 px-3 py-2 text-sm text-forest">
        La présence sera marquée « saisie par un agent » sur la liste officielle.
        {emailRequired || internalOnly
          ? ` Cette réunion ${[emailRequired ? "exige un email" : "", internalOnly ? "est réservée aux agents SODEFOR" : ""].filter(Boolean).join(" et ")} : pour y déroger, indiquez un motif.`
          : ""}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(new FormData(event.currentTarget));
        }}
        className="grid gap-5 md:grid-cols-2"
      >
        <Field label="Civilité" required htmlFor="civility">
          <Select id="civility" name="civility" required defaultValue="M">
            <option value="M">M.</option>
            <option value="MME">Mme</option>
            <option value="MLLE">Mlle</option>
          </Select>
        </Field>
        <Field label="Heure d'arrivée" required htmlFor="checkInAt" hint="Heure réelle d'arrivée en salle (heure d'Abidjan).">
          <Input
            id="checkInAt"
            name="checkInAt"
            type="datetime-local"
            required
            defaultValue={defaultCheckIn}
            min={earliestCheckIn}
          />
        </Field>
        <Field label="Nom" required htmlFor="lastName">
          <Input id="lastName" name="lastName" required minLength={2} maxLength={80} className="uppercase" />
        </Field>
        <Field label="Prénom(s)" required htmlFor="firstNames">
          <Input id="firstNames" name="firstNames" required minLength={2} maxLength={120} />
        </Field>
        <Field label="Fonction" required htmlFor="jobTitle">
          <Input id="jobTitle" name="jobTitle" required minLength={2} maxLength={120} />
        </Field>
        <Field label="Structure" required htmlFor="organization">
          <Input id="organization" name="organization" required minLength={2} maxLength={160} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" />
        </Field>
        <Field label="Téléphone" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" />
        </Field>
        <Field
          label="Motif de dérogation"
          htmlFor="manualReason"
          className="md:col-span-2"
          hint="Obligatoire seulement si le participant n'a pas d'email alors qu'il est exigé, ou n'est pas agent SODEFOR sur une réunion interne."
        >
          <Textarea id="manualReason" name="manualReason" maxLength={400} className="min-h-16" />
        </Field>
        <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <RequiredLegend />
          <Button loading={pending}>{pending ? "Enregistrement…" : "Enregistrer la présence"}</Button>
        </div>
      </form>
    </Card>
  );
}
