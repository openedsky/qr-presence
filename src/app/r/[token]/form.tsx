"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad } from "@/components/signature-pad";
import { Button, Field, Input, Label, RequiredLegend, Select } from "@/components/ui";
import { notifyError, readError } from "@/lib/alerts";

const DEVICE_KEY = "sodefor-device-id";

function deviceId() {
  try {
    let value = localStorage.getItem(DEVICE_KEY);
    if (!value) {
      value =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID().replaceAll("-", "")
          : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(DEVICE_KEY, value);
    }
    return value;
  } catch {
    return "";
  }
}

export function AttendancePublicForm({
  token,
  session,
  emailRequired,
  signatureRequired,
  structures,
  restrictedStructures,
  privacyNotice,
  publicListEnabled,
}: {
  token: string;
  session: string | null;
  emailRequired: boolean;
  signatureRequired: boolean;
  structures: string[];
  restrictedStructures: string[] | null;
  privacyNotice: string;
  publicListEnabled: boolean;
}) {
  const restricted = restrictedStructures && restrictedStructures.length > 0 ? restrictedStructures : null;
  const router = useRouter();
  const [signature, setSignature] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    if (signatureRequired && !signature) {
      await notifyError("Signature manquante", "Merci de signer dans le cadre prévu avant de valider.");
      return;
    }
    setPending(true);
    try {
      await submit(formData);
    } catch {
      // Réseau mobile coupé : le bouton doit redevenir cliquable, les champs saisis sont conservés.
      setPending(false);
      await notifyError("Connexion interrompue", "Votre présence n'a pas pu être envoyée. Vérifiez la connexion puis réessayez.");
    }
  }

  async function submit(formData: FormData) {
    const res = await fetch(`/api/public/meetings/${token}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Device-Id": deviceId() },
      body: JSON.stringify({
        token,
        session,
        civility: formData.get("civility"),
        lastName: String(formData.get("lastName") || "").toUpperCase(),
        firstNames: formData.get("firstNames"),
        jobTitle: formData.get("jobTitle"),
        organization: formData.get("organization"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        signatureDataUrl: signature,
        publicListConsent: publicListEnabled && formData.get("publicListConsent") === "on",
      }),
    });
    if (!res.ok) {
      setPending(false);
      const title =
        res.status === 409 ? "Déjà enregistré(e)"
        : res.status === 429 ? "Trop de tentatives"
        : res.status === 410 ? "Session expirée"
        : "Enregistrement impossible";
      await notifyError(title, await readError(res, "Veuillez réessayer."));
      return;
    }
    const json = (await res.json()) as { confirmationCode: string };
    router.push(`/r/${token}/success?code=${encodeURIComponent(json.confirmationCode)}`);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget));
      }}
      className="card mt-6 grid gap-4 p-5"
    >
      <RequiredLegend />
      <Field label="Civilité" required htmlFor="civility">
        <Select id="civility" name="civility" required defaultValue="M">
          <option value="M">M.</option>
          <option value="MME">Mme</option>
          <option value="MLLE">Mlle</option>
        </Select>
      </Field>
      <Field label="Nom" required htmlFor="lastName">
        <Input id="lastName" name="lastName" required minLength={2} maxLength={80} autoComplete="family-name" className="uppercase" />
      </Field>
      <Field label="Prénom(s)" required htmlFor="firstNames">
        <Input id="firstNames" name="firstNames" required minLength={2} maxLength={120} autoComplete="given-name" />
      </Field>
      <Field label="Fonction" required htmlFor="jobTitle">
        <Input id="jobTitle" name="jobTitle" required minLength={2} maxLength={120} autoComplete="organization-title" />
      </Field>
      <Field label="Structure" required htmlFor="organization">
        {restricted ? (
          <Select id="organization" name="organization" required defaultValue="">
            <option value="" disabled>
              Choisissez votre structure
            </option>
            {restricted.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        ) : (
          <>
            <Input id="organization" name="organization" required minLength={2} maxLength={160} list="structures" autoComplete="organization" />
            <datalist id="structures">
              {structures.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </>
        )}
      </Field>
      <Field label="Email" required={emailRequired} htmlFor="email">
        <Input id="email" name="email" type="email" required={emailRequired} autoComplete="email" inputMode="email" />
      </Field>
      <Field label="Téléphone" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" placeholder="07 XX XX XX XX" autoComplete="tel" inputMode="tel" />
      </Field>
      {signatureRequired ? (
        <div>
          <Label required>Signature</Label>
          <SignaturePad onChange={setSignature} disabled={pending} />
        </div>
      ) : null}
      {publicListEnabled ? (
        <label className="flex items-start gap-3 rounded-xl border border-line bg-sand/60 p-3 text-sm">
          <input type="checkbox" name="publicListConsent" className="mt-0.5 h-4 w-4 shrink-0 accent-forest" />
          <span>
            J&apos;accepte que mes nom, fonction et structure figurent sur la <strong>liste publique</strong> de cette
            réunion. <span className="text-muted">Facultatif : sans cet accord, votre présence reste enregistrée.</span>
          </span>
        </label>
      ) : null}
      <details className="rounded-xl bg-sand/60 px-3 py-2 text-xs leading-5 text-muted">
        <summary className="cursor-pointer font-semibold text-forest">Protection de vos données personnelles</summary>
        <p className="mt-2 whitespace-pre-line">{privacyNotice}</p>
      </details>
      <Button className="w-full py-3 text-base" loading={pending}>
        {pending ? "Enregistrement…" : "Enregistrer ma présence"}
      </Button>
    </form>
  );
}
