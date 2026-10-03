import { transitionRoute } from "@/lib/meeting-transition-route";

/** L'archivage est irréversible : réservé aux administrateurs. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return transitionRoute(id, "archive", "ARCHIVEE");
}
