"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button, Field, Input, RequiredLegend } from "@/components/ui";
import { apiFetch, notifyError, notifySuccess, readError } from "@/lib/alerts";
import { PASSWORD_RULES } from "@/lib/validators";
import { cn } from "@/lib/utils";

function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={id}
        type={visible ? "text" : "password"}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        className="pr-11!"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-mint hover:text-forest"
        aria-label={visible ? "Masquer" : "Afficher"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const rulesOk = PASSWORD_RULES.every((rule) => rule.test(next));
  const matches = next.length > 0 && next === confirm;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const res = await apiFetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next, confirmPassword: confirm }),
    });
    setPending(false);
    if (!res.ok) {
      await notifyError("Changement impossible", await readError(res));
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    await notifySuccess("Mot de passe modifié", "Par sécurité, toutes vos sessions ont été fermées : reconnectez-vous avec le nouveau mot de passe.");
    await signOut({ callbackUrl: "/login?motdepasse=1" });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <RequiredLegend />
      <Field label="Mot de passe actuel" required htmlFor="currentPassword">
        <PasswordInput id="currentPassword" value={current} onChange={setCurrent} autoComplete="current-password" />
      </Field>
      <Field label="Nouveau mot de passe" required htmlFor="newPassword">
        <PasswordInput id="newPassword" value={next} onChange={setNext} autoComplete="new-password" />
      </Field>
      <ul className="grid gap-1.5 rounded-xl bg-sand p-4 text-sm sm:grid-cols-2">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(next);
          return (
            <li key={rule.label} className={cn("flex items-center gap-2", ok ? "text-emerald-700" : "text-muted")}>
              {ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              {rule.label}
            </li>
          );
        })}
      </ul>
      <Field
        label="Confirmer le nouveau mot de passe"
        required
        htmlFor="confirmPassword"
        hint={confirm && !matches ? <span className="text-danger">Les deux saisies ne correspondent pas.</span> : undefined}
      >
        <PasswordInput id="confirmPassword" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </Field>
      <div>
        <Button type="submit" loading={pending} disabled={pending || !current || !rulesOk || !matches}>
          {pending ? "Modification…" : "Changer mon mot de passe"}
        </Button>
      </div>
    </form>
  );
}
