import { transitionRoute } from "@/lib/meeting-transition-route";
import { windowState } from "@/lib/meeting-status";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return transitionRoute(id, "manage", "OUVERTE", (meeting) => {
    if (meeting.status === "CLOTUREE") return "Une réunion clôturée ne peut être rouverte que par un administrateur.";
    // Ouverte après sa fenêtre, elle n'accepterait aucun émargement et échapperait à la clôture automatique.
    if (windowState(meeting) === "after") {
      return "La fenêtre d'émargement de cette réunion est dépassée : modifiez ses horaires avant de l'ouvrir.";
    }
    return null;
  });
}
