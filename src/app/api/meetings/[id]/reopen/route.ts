import { transitionRoute } from "@/lib/meeting-transition-route";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return transitionRoute(id, "reopen", "OUVERTE", ({ status }) =>
    status === "CLOTUREE" ? null : "Seule une réunion clôturée peut être rouverte.",
  );
}
