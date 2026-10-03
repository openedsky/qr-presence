"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Badge, Button, Card, Field, Input } from "@/components/ui";
import { apiFetch, confirmAction, notifyError, notifySuccess, readError } from "@/lib/alerts";

type TypeRow = {
  id: string;
  code: string;
  label: string;
  color: string;
  active: boolean;
  sortOrder: number;
  usage: number;
};

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

function EditRow({ row, onDone }: { row: TypeRow; onDone: (saved: boolean) => void }) {
  const [label, setLabel] = useState(row.label);
  const [color, setColor] = useState(row.color);
  const [sortOrder, setSortOrder] = useState(row.sortOrder);
  return (
    <tr className="bg-mint/40">
      <td>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-paper p-1" aria-label="Couleur" />
      </td>
      <td>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} aria-label="Libellé" />
      </td>
      <td className="font-mono text-xs text-muted">{row.code}</td>
      <td>
        <Input type="number" min={0} max={9999} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="w-24" aria-label="Ordre" />
      </td>
      <td colSpan={2} />
      <td className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="primary"
            className="px-3 py-2"
            title="Enregistrer"
            onClick={async () => onDone(await send(`/api/meeting-types/${row.id}`, "PATCH", { label, color, sortOrder }))}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="px-3 py-2" title="Annuler" onClick={() => onDone(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function MeetingTypesManager({ types }: { types: TypeRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    const ok = await send("/api/meeting-types", "POST", {
      label: form.get("label"),
      code: String(form.get("code") ?? "").toUpperCase(),
      color: form.get("color"),
      sortOrder: Number(form.get("sortOrder") || (types.length + 1) * 10),
      active: true,
    });
    setPending(false);
    if (ok) {
      formElement.reset();
      void notifySuccess("Type de réunion ajouté");
      router.refresh();
    }
  }

  async function toggle(row: TypeRow) {
    if (await send(`/api/meeting-types/${row.id}`, "PATCH", { active: !row.active })) {
      void notifySuccess(row.active ? "Type désactivé" : "Type réactivé");
      router.refresh();
    }
  }

  async function remove(row: TypeRow) {
    const ok = await confirmAction({
      title: `Supprimer « ${row.label} » ?`,
      text: "Cette suppression est définitive.",
      confirmText: "Supprimer",
      danger: true,
    });
    if (ok && (await send(`/api/meeting-types/${row.id}`, "DELETE"))) {
      void notifySuccess("Type supprimé");
      router.refresh();
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Card className="overflow-x-auto p-0">
        <table className="data-table w-full text-sm">
          <thead>
            <tr>
              <th className="w-16">Couleur</th>
              <th>Libellé</th>
              <th>Code</th>
              <th className="w-28">Ordre</th>
              <th>Réunions</th>
              <th>État</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {types.map((row) =>
              editing === row.id ? (
                <EditRow
                  key={row.id}
                  row={row}
                  onDone={(saved) => {
                    setEditing(null);
                    if (saved) {
                      void notifySuccess("Type mis à jour");
                      router.refresh();
                    }
                  }}
                />
              ) : (
                <tr key={row.id} className={row.active ? undefined : "opacity-60"}>
                  <td>
                    <span className="block h-6 w-6 rounded-lg border border-black/10" style={{ background: row.color }} />
                  </td>
                  <td className="font-semibold">{row.label}</td>
                  <td className="font-mono text-xs text-muted">{row.code}</td>
                  <td>{row.sortOrder}</td>
                  <td>{row.usage}</td>
                  <td>
                    <button onClick={() => toggle(row)} title={row.active ? "Désactiver" : "Réactiver"}>
                      <Badge className={row.active ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-600"}>
                        {row.active ? "Actif" : "Désactivé"}
                      </Badge>
                    </button>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(row.id)} className="rounded-lg p-2 text-forest hover:bg-mint" title="Modifier">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(row)}
                        disabled={row.usage > 0}
                        className="rounded-lg p-2 text-danger hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30"
                        title={row.usage > 0 ? "Utilisé par des réunions : désactivez-le" : "Supprimer"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        <p className="border-t border-line px-4 py-3 text-xs text-muted">
          Un type désactivé n&apos;est plus proposé à la création, mais reste affiché sur les réunions existantes.
        </p>
      </Card>

      <Card className="h-fit p-6">
        <h2 className="font-display text-xl font-semibold text-forest-deep">Ajouter un type</h2>
        <form onSubmit={create} className="mt-4 grid gap-4">
          <Field label="Libellé" required htmlFor="type-label">
            <Input id="type-label" name="label" required minLength={2} maxLength={60} placeholder="Ex. : Conseil d'administration" />
          </Field>
          <Field label="Code" htmlFor="type-code" hint="Déduit du libellé si vide (ex. CONSEIL_D_ADMINISTRATION).">
            <Input id="type-code" name="code" maxLength={40} pattern="[A-Za-z0-9_]{2,40}" className="font-mono uppercase" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Couleur" htmlFor="type-color">
              <input id="type-color" name="color" type="color" defaultValue="#14532d" className="h-11 w-full cursor-pointer rounded-xl border border-line bg-paper p-1" />
            </Field>
            <Field label="Ordre" htmlFor="type-order">
              <Input id="type-order" name="sortOrder" type="number" min={0} max={9999} placeholder={String((types.length + 1) * 10)} />
            </Field>
          </div>
          <Button type="submit" loading={pending}>
            <Plus className="h-4 w-4" /> {pending ? "Ajout…" : "Ajouter le type"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
