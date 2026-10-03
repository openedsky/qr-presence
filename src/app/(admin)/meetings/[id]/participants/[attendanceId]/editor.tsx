"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban, PenLine } from "lucide-react";
import { Button, Card, Field, Input, RequiredLegend, SectionTitle } from "@/components/ui";
import { apiFetch, askReason, confirmAction, notifyError, notifySuccess, readError } from "@/lib/alerts";

export function AttendanceEditor({
  meetingId,
  meetingStatus,
  emailRequired,
  attendance,
}: {
  meetingId: string;
  meetingStatus: string;
  emailRequired: boolean;
  attendance: {
    id: string;
    lastName: string;
    firstNames: string;
    jobTitle: string;
    organization: string;
    email: string | null;
    phone: string | null;
    status: string;
    hasSignature: boolean;
    suspectedDuplicate: boolean;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const active = attendance.status === "ACTIVE";
  const closed = meetingStatus === "CLOTUREE";
  const readOnly = meetingStatus === "ARCHIVEE";

  /** Après clôture, la liste officielle fait foi : chaque correction est motivée. */
  async function correctionReason() {
    if (!closed) return "";
    return askReason({
      title: "Motif de la correction",
      text: "La réunion est clôturée : la correction produira une nouvelle version de la liste officielle, avec ce motif.",
      placeholder: "Ex. : erreur de saisie du nom signalée par l'intéressé",
      confirmText: "Valider la correction",
      minLength: 5,
    });
  }

  async function send(body: Record<string, unknown>) {
    setPending(true);
    const res = await apiFetch(`/api/meetings/${meetingId}/attendances/${attendance.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    return res;
  }

  async function patch(formData: FormData) {
    if (!closed) {
      const ok = await confirmAction({
        title: "Enregistrer la correction ?",
        text: "La valeur précédente est conservée dans l'historique des modifications.",
        confirmText: "Enregistrer",
      });
      if (!ok) return;
    }
    const reason = await correctionReason();
    if (reason === null) return;
    const res = await send({ ...Object.fromEntries(formData.entries()), reason });
    if (!res.ok) {
      await notifyError("Correction impossible", await readError(res));
      return;
    }
    void notifySuccess("Présence corrigée");
    router.refresh();
  }

  async function resolveDuplicate() {
    const ok = await confirmAction({
      title: "Confirmer deux personnes distinctes ?",
      text: "Ce participant porte le même nom qu'une autre personne présente. Confirmez qu'il ne s'agit pas d'un doublon.",
      confirmText: "Ce sont deux personnes",
    });
    if (!ok) return;
    const reason = await correctionReason();
    if (reason === null) return;
    const res = await send({ resolveDuplicate: true, reason });
    if (!res.ok) {
      await notifyError("Action impossible", await readError(res));
      return;
    }
    void notifySuccess("Homonyme confirmé");
    router.refresh();
  }

  async function cancel() {
    const reason = await askReason({
      title: "Annuler cette présence ?",
      text: closed
        ? "La réunion est clôturée : l'annulation produira une nouvelle version de la liste officielle. Indiquez le motif."
        : "La donnée est conservée et marquée ANNULÉE. Indiquez le motif.",
      placeholder: "Motif d'annulation",
      confirmText: "Annuler la présence",
      minLength: 5,
    });
    if (!reason) return;
    const res = await apiFetch(`/api/meetings/${meetingId}/attendances/${attendance.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      await notifyError("Annulation impossible", await readError(res));
      return;
    }
    void notifySuccess("Présence annulée");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      {attendance.suspectedDuplicate && active ? (
        <Card className="flex flex-col gap-3 border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
          <p className="flex items-start gap-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Doublon probable : une autre personne présente porte le même nom, avec un email et un téléphone différents.
            Vérifiez puis confirmez, ou annulez cette présence s&apos;il s&apos;agit d&apos;un doublon.
          </p>
          {!readOnly ? (
            <Button variant="outline" loading={pending} onClick={resolveDuplicate}>
              Ce sont deux personnes
            </Button>
          ) : null}
        </Card>
      ) : null}
      <Card className="p-6">
        <SectionTitle icon={<PenLine className="h-4 w-4" />} title="Corriger la présence" />
        {readOnly ? (
          <p className="mb-4 rounded-xl bg-sand px-3 py-2 text-sm text-muted">Réunion archivée : consultation seule.</p>
        ) : closed ? (
          <p className="mb-4 rounded-xl bg-sand px-3 py-2 text-sm text-muted">
            Réunion clôturée : un motif vous sera demandé à l&apos;enregistrement.
          </p>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void patch(new FormData(event.currentTarget));
          }}
          className="grid gap-4 md:grid-cols-2"
        >
          <fieldset disabled={readOnly || pending} className="contents">
            <Field label="Nom" required htmlFor="lastName">
              <Input id="lastName" name="lastName" required minLength={2} defaultValue={attendance.lastName} />
            </Field>
            <Field label="Prénom(s)" required htmlFor="firstNames">
              <Input id="firstNames" name="firstNames" required minLength={2} defaultValue={attendance.firstNames} />
            </Field>
            <Field label="Fonction" required htmlFor="jobTitle">
              <Input id="jobTitle" name="jobTitle" required minLength={2} defaultValue={attendance.jobTitle} />
            </Field>
            <Field label="Structure" required htmlFor="organization">
              <Input id="organization" name="organization" required minLength={2} defaultValue={attendance.organization} />
            </Field>
            <Field label="Email" htmlFor="email" required={emailRequired && Boolean(attendance.email)}>
              <Input id="email" name="email" type="email" required={emailRequired && Boolean(attendance.email)} defaultValue={attendance.email ?? ""} />
            </Field>
            <Field label="Téléphone" htmlFor="phone">
              <Input id="phone" name="phone" type="tel" defaultValue={attendance.phone ?? ""} />
            </Field>
          </fieldset>
          <p className="text-xs text-muted md:col-span-2">
            La signature originale ne peut pas être remplacée silencieusement.
            {attendance.hasSignature ? " Une signature est déjà archivée." : ""}
          </p>
          <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <RequiredLegend />
            <Button loading={pending} disabled={pending || readOnly}>Enregistrer la correction</Button>
          </div>
        </form>
      </Card>
      <Card className="h-fit p-6">
        <SectionTitle icon={<Ban className="h-4 w-4" />} title="Annuler la présence" subtitle="Suppression logique : la donnée est conservée et marquée ANNULÉE." />
        <Button variant="danger" className="w-full" disabled={!active || readOnly} onClick={cancel}>
          {active ? "Annuler la présence…" : "Présence déjà annulée"}
        </Button>
      </Card>
    </div>
  );
}
