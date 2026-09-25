"use client";

import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";

export function AttendanceEditor({
  meetingId,
  attendance,
}: {
  meetingId: string;
  attendance: {
    id: string;
    lastName: string;
    firstNames: string;
    jobTitle: string;
    organization: string;
    email: string | null;
    phone: string | null;
    status: string;
    signatureObjectKey: string | null;
  };
}) {
  const router = useRouter();

  async function patch(formData: FormData) {
    await fetch(`/api/meetings/${meetingId}/attendances/${attendance.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    router.refresh();
  }

  async function cancel(formData: FormData) {
    await fetch(`/api/meetings/${meetingId}/attendances/${attendance.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: formData.get("reason") }),
    });
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <form action={patch} className="grid gap-3">
          <label className="label">Nom</label>
          <Input name="lastName" defaultValue={attendance.lastName} />
          <label className="label">Prénom(s)</label>
          <Input name="firstNames" defaultValue={attendance.firstNames} />
          <label className="label">Fonction</label>
          <Input name="jobTitle" defaultValue={attendance.jobTitle} />
          <label className="label">Structure</label>
          <Input name="organization" defaultValue={attendance.organization} />
          <label className="label">Email</label>
          <Input name="email" defaultValue={attendance.email ?? ""} />
          <label className="label">Contact</label>
          <Input name="phone" defaultValue={attendance.phone ?? ""} />
          <p className="text-xs text-muted">
            La signature originale ne peut pas être remplacée silencieusement.
            {attendance.signatureObjectKey ? " Une signature est déjà archivée." : ""}
          </p>
          <Button>Enregistrer la correction</Button>
        </form>
      </Card>
      <Card>
        <h2 className="font-display text-xl">Annuler la présence</h2>
        <p className="mt-2 text-sm text-muted">
          Soft delete : la donnée est conservée et marquée ANNULÉE.
        </p>
        <form action={cancel} className="mt-4 grid gap-3">
          <Input name="reason" placeholder="Motif d'annulation" required disabled={attendance.status !== "ACTIVE"} />
          <Button variant="danger" disabled={attendance.status !== "ACTIVE"}>
            Annuler la présence
          </Button>
        </form>
      </Card>
    </div>
  );
}
