"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, Pencil, Power, PowerOff, X } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui";
import { apiFetch, confirmAction, notifyError, notifySuccess, readError, showSecret } from "@/lib/alerts";
import { cn } from "@/lib/utils";
import { ROLE_OPTIONS } from "./user-form";

export type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  organization: string | null;
  phone: string | null;
  role: string;
  active: boolean;
  locked: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
};

const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map((role) => [role.value, role.label]));

async function patchUser(id: string, body: Record<string, unknown>) {
  const res = await apiFetch(`/api/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    await notifyError("Action impossible", await readError(res));
    return null;
  }
  return (await res.json()) as { ok: true; temporaryPassword?: string };
}

function EditRow({ user, self, onDone }: { user: UserRow; self: boolean; onDone: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const result = await patchUser(user.id, {
      lastName: form.get("lastName"),
      firstName: form.get("firstName"),
      jobTitle: form.get("jobTitle"),
      organization: form.get("organization"),
      phone: form.get("phone"),
      ...(self ? {} : { role: form.get("role") }),
    });
    setPending(false);
    if (!result) return;
    void notifySuccess("Compte mis à jour");
    onDone();
    router.refresh();
  }

  return (
    <tr className="border-t border-line bg-mint/40">
      <td colSpan={5} className="px-4 py-4">
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nom" required htmlFor={`e-ln-${user.id}`}>
            <Input id={`e-ln-${user.id}`} name="lastName" defaultValue={user.lastName} required minLength={2} maxLength={80} />
          </Field>
          <Field label="Prénom" required htmlFor={`e-fn-${user.id}`}>
            <Input id={`e-fn-${user.id}`} name="firstName" defaultValue={user.firstName} required minLength={2} maxLength={80} />
          </Field>
          <Field label="Rôle" htmlFor={`e-role-${user.id}`} hint={self ? "Vous ne pouvez pas modifier votre propre rôle." : undefined}>
            <Select id={`e-role-${user.id}`} name="role" defaultValue={user.role} disabled={self}>
              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fonction" htmlFor={`e-job-${user.id}`}>
            <Input id={`e-job-${user.id}`} name="jobTitle" defaultValue={user.jobTitle ?? ""} maxLength={120} />
          </Field>
          <Field label="Structure" htmlFor={`e-org-${user.id}`}>
            <Input id={`e-org-${user.id}`} name="organization" defaultValue={user.organization ?? ""} maxLength={160} />
          </Field>
          <Field label="Téléphone" htmlFor={`e-tel-${user.id}`}>
            <Input id={`e-tel-${user.id}`} name="phone" type="tel" defaultValue={user.phone ?? ""} maxLength={30} />
          </Field>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <Button loading={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
            <Button type="button" variant="outline" onClick={onDone}>
              Annuler
            </Button>
          </div>
        </form>
      </td>
    </tr>
  );
}

export function UsersTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);

  async function resetPassword(user: UserRow) {
    const ok = await confirmAction({
      title: "Réinitialiser le mot de passe ?",
      text: `${user.firstName} ${user.lastName} sera déconnecté et devra choisir un nouveau mot de passe à sa prochaine connexion.`,
      confirmText: "Réinitialiser",
      danger: true,
    });
    if (!ok) return;
    const result = await patchUser(user.id, { resetPassword: true });
    if (!result?.temporaryPassword) return;
    router.refresh();
    await showSecret({ title: "Mot de passe réinitialisé", text: `Mot de passe provisoire de ${user.email} :`, secret: result.temporaryPassword });
  }

  async function toggleActive(user: UserRow) {
    const ok = await confirmAction({
      title: user.active ? "Désactiver ce compte ?" : "Réactiver ce compte ?",
      text: user.active
        ? "L'utilisateur est déconnecté immédiatement et ne peut plus se connecter. Son historique est conservé."
        : "L'utilisateur pourra de nouveau se connecter avec son mot de passe.",
      confirmText: user.active ? "Désactiver" : "Réactiver",
      danger: user.active,
    });
    if (!ok) return;
    if (await patchUser(user.id, { active: !user.active })) {
      void notifySuccess(user.active ? "Compte désactivé" : "Compte réactivé");
      router.refresh();
    }
  }

  async function unlock(user: UserRow) {
    if (await patchUser(user.id, { unlock: true })) {
      void notifySuccess("Compte déverrouillé");
      router.refresh();
    }
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-mint text-left text-xs uppercase text-muted">
        <tr>
          <th className="px-4 py-3">Nom</th>
          <th>Email</th>
          <th>Rôle</th>
          <th>État</th>
          <th className="px-4 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => {
          const self = user.id === currentUserId;
          return [
            <tr key={user.id} className={cn("border-t border-line", !user.active && "text-muted")}>
              <td className="px-4 py-3">
                <p className="font-semibold">
                  {user.lastName} {user.firstName}
                  {self ? <span className="ml-2 text-xs font-normal text-muted">(vous)</span> : null}
                </p>
                {user.jobTitle ? <p className="text-xs text-muted">{user.jobTitle}</p> : null}
              </td>
              <td className="whitespace-nowrap">{user.email}</td>
              <td>{ROLE_LABEL[user.role] ?? user.role}</td>
              <td>
                <div className="flex flex-wrap gap-1">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      user.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {user.active ? "Actif" : "Inactif"}
                  </span>
                  {user.locked ? (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Verrouillé</span>
                  ) : null}
                  {user.mustChangePassword ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">MDP provisoire</span>
                  ) : null}
                </div>
              </td>
              <td className="px-4">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    title="Modifier"
                    aria-label={`Modifier ${user.email}`}
                    onClick={() => setEditing(editing === user.id ? null : user.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-forest hover:bg-mint"
                  >
                    {editing === user.id ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  </button>
                  {user.locked ? (
                    <button
                      type="button"
                      title="Déverrouiller"
                      aria-label={`Déverrouiller ${user.email}`}
                      onClick={() => void unlock(user)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-red-700 hover:bg-red-50"
                    >
                      <Lock className="h-4 w-4" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    title="Réinitialiser le mot de passe"
                    aria-label={`Réinitialiser le mot de passe de ${user.email}`}
                    onClick={() => void resetPassword(user)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-700 hover:bg-amber-50"
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>
                  {self ? null : (
                    <button
                      type="button"
                      title={user.active ? "Désactiver" : "Réactiver"}
                      aria-label={`${user.active ? "Désactiver" : "Réactiver"} ${user.email}`}
                      onClick={() => void toggleActive(user)}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg",
                        user.active ? "text-danger hover:bg-red-50" : "text-emerald-700 hover:bg-emerald-50",
                      )}
                    >
                      {user.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </td>
            </tr>,
            editing === user.id ? (
              <EditRow key={`${user.id}-edit`} user={user} self={self} onDone={() => setEditing(null)} />
            ) : null,
          ];
        })}
      </tbody>
    </table>
  );
}
