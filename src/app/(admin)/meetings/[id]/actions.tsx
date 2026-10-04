"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, CalendarCheck, Copy, Lock, RotateCcw, Trash2, Unlock } from "lucide-react";
import { Button } from "@/components/ui";
import { apiFetch, confirmAction, notifyError, notifySuccess, readError, setFlash } from "@/lib/alerts";

type ActionSpec = {
  path: string;
  method?: "POST" | "DELETE";
  confirm?: { title: string; text: string; confirmText: string; danger?: boolean };
  success: string;
  redirect?: (json: { id?: string }) => string;
};

export function MeetingActions({
  id,
  status,
  canManage = false,
  canClose = false,
  canArchive = false,
  canDuplicate = false,
  canDelete = false,
  canReopen = false,
  hasAttendances = false,
}: {
  id: string;
  status: string;
  canManage?: boolean;
  canClose?: boolean;
  canArchive?: boolean;
  canDuplicate?: boolean;
  canDelete?: boolean;
  canReopen?: boolean;
  hasAttendances?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(spec: ActionSpec) {
    if (spec.confirm) {
      const ok = await confirmAction(spec.confirm);
      if (!ok) return;
    }
    setBusy(spec.path);
    const res = await apiFetch(spec.path, { method: spec.method ?? "POST" });
    if (!res.ok) {
      setBusy(null);
      await notifyError("Action impossible", await readError(res));
      return;
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string; notice?: string };
    if (spec.redirect) {
      // Le bouton reste « en cours » jusqu'à l'affichage de la page suivante.
      setFlash({ icon: "success", title: spec.success, text: json.notice });
      router.push(spec.redirect(json));
      return;
    }
    setBusy(null);
    void notifySuccess(spec.success, json.notice);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canManage && (status === "BROUILLON" || (status === "OUVERTE" && !hasAttendances)) ? (
        <Button
          variant="outline"
          loading={busy === `/api/meetings/${id}/plan`}
          disabled={busy !== null}
          onClick={() =>
            run({
              path: `/api/meetings/${id}/plan`,
              success: "Réunion planifiée",
            })
          }
        >
          <CalendarCheck className="h-4 w-4" /> {status === "OUVERTE" ? "Repasser en planifiée" : "Planifier"}
        </Button>
      ) : null}
      {canManage && ["PLANIFIEE", "BROUILLON"].includes(status) ? (
        <Button
          loading={busy === `/api/meetings/${id}/open`}
          disabled={busy !== null}
          onClick={() =>
            run({
              path: `/api/meetings/${id}/open`,
              confirm: {
                title: "Ouvrir les inscriptions ?",
                text: "Le QR code deviendra actif pendant la fenêtre d'émargement de la réunion.",
                confirmText: "Ouvrir",
              },
              success: "Inscriptions ouvertes",
            })
          }
        >
          <Unlock className="h-4 w-4" /> Ouvrir les inscriptions
        </Button>
      ) : null}
      {canClose && ["OUVERTE", "EN_COURS"].includes(status) ? (
        <Button
          variant="danger"
          loading={busy === `/api/meetings/${id}/close`}
          disabled={busy !== null}
          onClick={() =>
            run({
              path: `/api/meetings/${id}/close`,
              confirm: {
                title: "Clôturer les émargements ?",
                text: "Plus aucun émargement ne sera accepté, les informations de la réunion seront gelées et la liste officielle (version 1) sera établie. Voulez-vous continuer ?",
                confirmText: "Clôturer",
                danger: true,
              },
              success: "Réunion clôturée · liste officielle établie",
            })
          }
        >
          <Lock className="h-4 w-4" /> Clôturer
        </Button>
      ) : null}
      {status === "CLOTUREE" && canReopen ? (
        <Button
          variant="outline"
          loading={busy === `/api/meetings/${id}/reopen`}
          disabled={busy !== null}
          onClick={() =>
            run({
              path: `/api/meetings/${id}/reopen`,
              confirm: {
                title: "Rouvrir la réunion ?",
                text: "Les émargements seront à nouveau acceptés. À la prochaine clôture, toute modification produira une nouvelle version de la liste officielle. L'opération est tracée.",
                confirmText: "Rouvrir",
              },
              success: "Réunion rouverte",
            })
          }
        >
          <RotateCcw className="h-4 w-4" /> Rouvrir
        </Button>
      ) : null}
      {canDuplicate ? (
        <Button
          variant="outline"
          loading={busy === `/api/meetings/${id}/duplicate`}
          disabled={busy !== null}
          onClick={() =>
            run({
              path: `/api/meetings/${id}/duplicate`,
              confirm: {
                title: "Dupliquer la réunion ?",
                text: "Une copie en brouillon sera créée pour demain à la même heure, sans les participants ni les notes internes.",
                confirmText: "Dupliquer",
              },
              success: "Réunion dupliquée",
              redirect: (json) => `/meetings/${json.id}/edit`,
            })
          }
        >
          <Copy className="h-4 w-4" /> Dupliquer
        </Button>
      ) : null}
      {canArchive && status === "CLOTUREE" ? (
        <Button
          variant="ghost"
          loading={busy === `/api/meetings/${id}/archive`}
          disabled={busy !== null}
          onClick={() =>
            run({
              path: `/api/meetings/${id}/archive`,
              confirm: {
                title: "Archiver la réunion ?",
                text: "Une réunion archivée ne peut plus être modifiée ni rouverte.",
                confirmText: "Archiver",
                danger: true,
              },
              success: "Réunion archivée",
            })
          }
        >
          <Archive className="h-4 w-4" /> Archiver
        </Button>
      ) : null}
      {canDelete && ["BROUILLON", "PLANIFIEE"].includes(status) ? (
        <Button
          variant="ghost"
          className="text-danger hover:bg-red-50"
          loading={busy === `/api/meetings/${id}`}
          disabled={busy !== null}
          onClick={() =>
            run({
              path: `/api/meetings/${id}`,
              method: "DELETE",
              confirm: {
                title: "Supprimer définitivement ?",
                text: "La réunion et son QR code seront supprimés. Cette action est irréversible.",
                confirmText: "Supprimer",
                danger: true,
              },
              success: "Réunion supprimée",
              redirect: () => "/meetings",
            })
          }
        >
          <Trash2 className="h-4 w-4" /> Supprimer
        </Button>
      ) : null}
    </div>
  );
}
