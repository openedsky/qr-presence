"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function MeetingActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();

  async function post(path: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    const res = await fetch(path, { method: "POST" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? "Action impossible");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "BROUILLON" ? (
        <Button onClick={() => post(`/api/meetings/${id}/plan`)}>Planifier</Button>
      ) : null}
      {["PLANIFIEE", "BROUILLON"].includes(status) ? (
        <Button onClick={() => post(`/api/meetings/${id}/open`)}>Ouvrir les inscriptions</Button>
      ) : null}
      {["OUVERTE", "EN_COURS"].includes(status) ? (
        <Button
          variant="danger"
          onClick={() =>
            post(
              `/api/meetings/${id}/close`,
              "Cette opération empêchera tout nouvel émargement. Voulez-vous continuer ?",
            )
          }
        >
          Clôturer les émargements
        </Button>
      ) : null}
      {status === "CLOTUREE" ? (
        <Button variant="outline" onClick={() => post(`/api/meetings/${id}/reopen`)}>
          Réouvrir
        </Button>
      ) : null}
      <Button variant="outline" onClick={() => post(`/api/meetings/${id}/duplicate`)}>
        Dupliquer
      </Button>
      {status === "CLOTUREE" ? (
        <Button variant="ghost" onClick={() => post(`/api/meetings/${id}/archive`)}>
          Archiver
        </Button>
      ) : null}
    </div>
  );
}
