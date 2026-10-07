"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad } from "@/components/signature-pad";
import { Button, Field, Input, Label, RequiredLegend, Select } from "@/components/ui";
import { notifyError } from "@/lib/alerts";

const DEVICE_KEY = "sodefor-device-id";
const DRAFT_KEY = "sodefor-attendance-draft";
/** Brouillon conservé le temps de rescanner le QR après une session expirée, pas au-delà (appareil partagé). */
const DRAFT_TTL_MS = 30 * 60 * 1000;
const SUBMIT_TIMEOUT_MS = 20_000;
const DRAFT_FIELDS = ["civility", "lastName", "firstNames", "jobTitle", "organization", "email", "phone"] as const;

type FieldName = (typeof DRAFT_FIELDS)[number] | "signatureDataUrl";

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

function saveDraft(formData: FormData) {
  try {
    const values = Object.fromEntries(DRAFT_FIELDS.map((name) => [name, String(formData.get(name) ?? "")]));
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), values }));
  } catch {
    // Stockage indisponible (navigation privée) : rien à conserver.
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // idem
  }
}

function readDraft(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as { savedAt?: number; values?: Record<string, string> };
    if (!draft.savedAt || Date.now() - draft.savedAt > DRAFT_TTL_MS || !draft.values) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return draft.values;
  } catch {
    return null;
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
  const formRef = useRef<HTMLFormElement>(null);
  const signatureRef = useRef<HTMLDivElement>(null);
  const [signature, setSignature] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [restored, setRestored] = useState<"draft" | "profile" | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    // Ne remplit que les champs encore vides : la saisie déjà commencée n'est jamais écrasée.
    function apply(values: Partial<Record<string, string>>) {
      const form = formRef.current;
      if (!form) return false;
      let applied = false;
      for (const name of DRAFT_FIELDS) {
        const element = form.elements.namedItem(name);
        const value = values[name];
        if (!value || !(element instanceof HTMLInputElement || element instanceof HTMLSelectElement) || element.value) continue;
        element.value = value;
        // Liste de structures imposée : une valeur absente de la liste reste non sélectionnée.
        if (element.value === value) applied = true;
      }
      return applied;
    }

    const draft = readDraft();
    if (draft) {
      if (apply(draft)) setRestored("draft");
      return;
    }
    const controller = new AbortController();
    fetch("/api/public/participant-profile", { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ profile?: Record<string, string> | null }>) : null))
      .then((json) => {
        if (json?.profile && apply(json.profile)) setRestored("profile");
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  async function forgetProfile() {
    await fetch("/api/public/participant-profile", { method: "DELETE", credentials: "same-origin" }).catch(() => undefined);
    clearDraft();
    formRef.current?.reset();
    setErrors({});
    setRestored(null);
    setRememberMe(false);
  }

  function focusField(name: FieldName) {
    if (name === "signatureDataUrl") {
      signatureRef.current?.scrollIntoView({ block: "center" });
      signatureRef.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
      return;
    }
    const element = formRef.current?.elements.namedItem(name);
    if (element instanceof HTMLElement) element.focus();
  }

  function clearError(name: FieldName) {
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  async function onSubmit(formData: FormData) {
    if (signatureRequired && !signature) {
      setErrors({ signatureDataUrl: "Merci de signer dans le cadre prévu avant de valider." });
      focusField("signatureDataUrl");
      return;
    }
    setErrors({});
    setPending(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
    try {
      await submit(formData, controller.signal);
    } catch (error) {
      // Réseau mobile coupé ou trop lent : le bouton redevient cliquable, les champs saisis sont conservés.
      setPending(false);
      const timedOut = error instanceof DOMException && error.name === "AbortError";
      await notifyError(
        timedOut ? "Connexion trop lente" : "Connexion interrompue",
        timedOut
          ? "Le serveur n'a pas répondu à temps. Votre présence a peut-être été enregistrée : réessayez, un doublon vous sera signalé."
          : "Votre présence n'a pas pu être envoyée. Vérifiez la connexion puis réessayez.",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async function submit(formData: FormData, signal: AbortSignal) {
    const res = await fetch(`/api/public/meetings/${token}/attendance`, {
      method: "POST",
      signal,
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
        rememberMe,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      field?: string;
      confirmationCode?: string;
    };
    if (res.ok && json.confirmationCode) {
      clearDraft();
      router.push(`/r/${token}/success?code=${encodeURIComponent(json.confirmationCode)}`);
      return;
    }
    if (res.status === 409 && json.confirmationCode) {
      clearDraft();
      router.push(`/r/${token}/success?code=${encodeURIComponent(json.confirmationCode)}&deja=1`);
      return;
    }
    setPending(false);
    const message = json.error ?? "Veuillez réessayer.";
    if (res.status === 400 && json.field && (DRAFT_FIELDS as readonly string[]).concat("signatureDataUrl").includes(json.field)) {
      const field = json.field as FieldName;
      setErrors({ [field]: message });
      focusField(field);
      return;
    }
    if (res.status === 410) saveDraft(formData);
    const title =
      res.status === 409 ? "Déjà enregistré(e)"
      : res.status === 429 ? "Trop de tentatives"
      : res.status === 410 ? "Session expirée"
      : "Enregistrement impossible";
    await notifyError(
      title,
      res.status === 410 ? `${message} Vos informations seront préremplies après le nouveau scan.` : message,
    );
  }

  return (
    <form
      ref={formRef}
      autoComplete="on"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget));
      }}
      className="card mt-6 grid gap-4 p-5"
    >
      <RequiredLegend />
      {restored ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          <span>Vos informations précédentes ont été préremplies : vérifiez-les avant de valider.</span>
          {restored === "profile" ? (
            <button
              type="button"
              onClick={() => void forgetProfile()}
              className="font-semibold underline underline-offset-2 hover:text-emerald-950"
            >
              Ce n&apos;est pas moi
            </button>
          ) : null}
        </div>
      ) : null}
      <Field label="Civilité" required htmlFor="civility" error={errors.civility}>
        <Select
          id="civility"
          name="civility"
          required
          defaultValue=""
          autoComplete="honorific-prefix"
          onChange={() => clearError("civility")}
        >
          <option value="" disabled>
            Choisissez
          </option>
          <option value="M">M.</option>
          <option value="MME">Mme</option>
          <option value="MLLE">Mlle</option>
        </Select>
      </Field>
      <Field label="Nom" required htmlFor="lastName" error={errors.lastName}>
        <Input
          id="lastName"
          name="lastName"
          required
          minLength={2}
          maxLength={80}
          autoComplete="family-name"
          className="uppercase"
          onChange={() => clearError("lastName")}
        />
      </Field>
      <Field label="Prénom(s)" required htmlFor="firstNames" error={errors.firstNames}>
        <Input
          id="firstNames"
          name="firstNames"
          required
          minLength={2}
          maxLength={120}
          autoComplete="given-name"
          onChange={() => clearError("firstNames")}
        />
      </Field>
      <Field label="Fonction" required htmlFor="jobTitle" error={errors.jobTitle}>
        <Input
          id="jobTitle"
          name="jobTitle"
          required
          minLength={2}
          maxLength={120}
          autoComplete="organization-title"
          onChange={() => clearError("jobTitle")}
        />
      </Field>
      <Field label="Structure" required htmlFor="organization" error={errors.organization}>
        {restricted ? (
          <Select id="organization" name="organization" required defaultValue="" onChange={() => clearError("organization")}>
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
          <Input
            id="organization"
            name="organization"
            required
            minLength={2}
            maxLength={160}
            list="structures"
            autoComplete="organization"
            onChange={() => clearError("organization")}
          />
        )}
      </Field>
      {!restricted ? (
        <datalist id="structures">
          {structures.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      ) : null}
      <Field label="Email" required={emailRequired} htmlFor="email" error={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          required={emailRequired}
          autoComplete="email"
          inputMode="email"
          onChange={() => clearError("email")}
        />
      </Field>
      <Field label="Téléphone" htmlFor="phone" error={errors.phone}>
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder="07 XX XX XX XX"
          autoComplete="tel"
          inputMode="tel"
          onChange={() => clearError("phone")}
        />
      </Field>
      {signatureRequired ? (
        <div
          ref={signatureRef}
          role="group"
          aria-labelledby="signature-label"
          aria-describedby={errors.signatureDataUrl ? "signature-error" : undefined}
        >
          <Label required>
            <span id="signature-label">Signature</span>
          </Label>
          <SignaturePad
            onChange={(value) => {
              setSignature(value);
              if (value) clearError("signatureDataUrl");
            }}
            disabled={pending}
          />
          {errors.signatureDataUrl ? (
            <p id="signature-error" role="alert" className="mt-1.5 text-xs font-semibold text-danger">
              {errors.signatureDataUrl}
            </p>
          ) : null}
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
      <label className="flex items-start gap-3 rounded-xl border border-line bg-sand/60 p-3 text-sm">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(event) => setRememberMe(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-forest"
        />
        <span>
          Mémoriser mes informations sur cet appareil pour mes prochains émargements.{" "}
          <span className="text-muted">
            La signature n&apos;est jamais mémorisée. Décochez sur un appareil partagé.
          </span>
        </span>
      </label>
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
