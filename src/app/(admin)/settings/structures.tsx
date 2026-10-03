"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Badge, Button, Card, Field, Input } from "@/components/ui";
import { apiFetch, confirmAction, notifyError, notifySuccess, readError } from "@/lib/alerts";

type StructureRow = { id: string; name: string; internal: boolean; active: boolean };

async function send(url: string, method: string, body?: unknown) {
  const res = await apiFetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    await notifyError("Action impossible", await readError(res));
    return false;
  }
  return true;
}

export function StructuresManager({ structures, domains }: { structures: StructureRow[]; domains: string[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    const ok = await send("/api/structures", "POST", {
      name: form.get("name"),
      internal: form.get("internal") === "on",
      active: true,
    });
    setPending(false);
    if (ok) {
      formElement.reset();
      void notifySuccess("Structure ajoutée");
      router.refresh();
    }
  }

  async function patch(row: StructureRow, data: Partial<StructureRow>, message: string) {
    if (await send(`/api/structures/${row.id}`, "PATCH", data)) {
      void notifySuccess(message);
      setEditing(null);
      router.refresh();
    }
  }

  async function remove(row: StructureRow) {
    const ok = await confirmAction({
      title: `Supprimer « ${row.name} » ?`,
      text: "Les présences déjà enregistrées gardent le libellé saisi.",
      confirmText: "Supprimer",
      danger: true,
    });
    if (ok && (await send(`/api/structures/${row.id}`, "DELETE"))) {
      void notifySuccess("Structure supprimée");
      router.refresh();
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Card className="overflow-x-auto p-0">
        <table className="data-table w-full text-sm">
          <thead>
            <tr>
              <th>Structure</th>
              <th>Catégorie</th>
              <th>État</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {structures.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted">Aucune structure enregistrée.</td>
              </tr>
            ) : null}
            {structures.map((row) => (
              <tr key={row.id} className={row.active ? undefined : "opacity-60"}>
                <td className="font-semibold">
                  {editing === row.id ? (
                    <Input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={120} aria-label="Nom" />
                  ) : (
                    row.name
                  )}
                </td>
                <td>
                  <button
                    onClick={() => patch(row, { internal: !row.internal }, "Catégorie modifiée")}
                    title="Changer de catégorie"
                  >
                    <Badge className={row.internal ? "bg-sky-50 text-sky-800" : "bg-amber-50 text-amber-800"}>
                      {row.internal ? "Interne" : "Externe"}
                    </Badge>
                  </button>
                </td>
                <td>
                  <button
                    onClick={() => patch(row, { active: !row.active }, row.active ? "Structure désactivée" : "Structure réactivée")}
                    title={row.active ? "Désactiver" : "Réactiver"}
                  >
                    <Badge className={row.active ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-600"}>
                      {row.active ? "Active" : "Désactivée"}
                    </Badge>
                  </button>
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    {editing === row.id ? (
                      <>
                        <Button variant="primary" className="px-3 py-2" title="Enregistrer" onClick={() => patch(row, { name: draft }, "Structure renommée")}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" className="px-3 py-2" title="Annuler" onClick={() => setEditing(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditing(row.id);
                            setDraft(row.name);
                          }}
                          className="rounded-lg p-2 text-forest hover:bg-mint"
                          title="Renommer"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => remove(row)} className="rounded-lg p-2 text-danger hover:bg-rose-50" title="Supprimer">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-line px-4 py-3 text-xs text-muted">
          Une réunion réservée aux agents internes n&apos;accepte que les structures internes actives, et un email
          sur {domains.length ? domains.map((domain) => `@${domain}`).join(", ") : "le domaine de l'organisation"} lorsqu&apos;il est saisi
          (variable INTERNAL_EMAIL_DOMAINS).
        </p>
      </Card>

      <Card className="h-fit p-6">
        <h2 className="font-display text-xl font-semibold text-forest-deep">Ajouter une structure</h2>
        <form onSubmit={create} className="mt-4 grid gap-4">
          <Field label="Nom" required htmlFor="structure-name">
            <Input id="structure-name" name="name" required minLength={2} maxLength={120} placeholder="Ex. : Direction technique" />
          </Field>
          <label className="check-tile">
            <input type="checkbox" name="internal" defaultChecked />
            <span>Structure interne à l&apos;organisation</span>
          </label>
          <Button type="submit" loading={pending}>
            <Plus className="h-4 w-4" /> {pending ? "Ajout…" : "Ajouter la structure"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
