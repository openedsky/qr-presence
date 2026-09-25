"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad } from "@/components/signature-pad";
import { Button, Input, Select } from "@/components/ui";

export function AttendancePublicForm({
  token,
  emailRequired,
  signatureRequired,
  structures,
  privacyNotice,
}: {
  token: string;
  emailRequired: boolean;
  signatureRequired: boolean;
  structures: string[];
  privacyNotice: string;
}) {
  const router = useRouter();
  const [signature, setSignature] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    if (signatureRequired && !signature) {
      setError("La signature est obligatoire.");
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch(`/api/public/meetings/${token}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        civility: formData.get("civility"),
        lastName: String(formData.get("lastName") || "").toUpperCase(),
        firstNames: formData.get("firstNames"),
        jobTitle: formData.get("jobTitle"),
        organization: formData.get("organization"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        signatureDataUrl: signature,
      }),
    });
    const json = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(json.error ?? "Enregistrement impossible");
      return;
    }
    router.push(`/r/${token}/success?code=${json.confirmationCode}&name=${encodeURIComponent(json.displayName)}&org=${encodeURIComponent(json.organization)}&time=${encodeURIComponent(json.checkInAt)}`);
  }

  return (
    <form action={onSubmit} className="card mt-6 p-5">
      <label className="label">Civilité</label>
      <Select name="civility" defaultValue="M">
        <option value="M">M.</option>
        <option value="MME">Mme</option>
        <option value="MLLE">Mlle</option>
      </Select>
      <label className="label mt-4">Nom</label>
      <Input name="lastName" required className="uppercase" />
      <label className="label mt-4">Prénom(s)</label>
      <Input name="firstNames" required />
      <label className="label mt-4">Fonction</label>
      <Input name="jobTitle" required />
      <label className="label mt-4">Structure</label>
      <Input name="organization" required list="structures" />
      <datalist id="structures">
        {structures.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <label className="label mt-4">Email</label>
      <Input name="email" type="email" required={emailRequired} />
      <label className="label mt-4">Téléphone</label>
      <Input name="phone" placeholder="07 XX XX XX XX" />
      {signatureRequired ? (
        <div className="mt-4">
          <label className="label">Signature</label>
          <SignaturePad onChange={setSignature} disabled={pending} />
        </div>
      ) : null}
      <p className="mt-4 text-xs leading-5 text-muted">{privacyNotice}</p>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <Button className="mt-5 w-full py-3 text-base" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer ma présence"}
      </Button>
    </form>
  );
}
