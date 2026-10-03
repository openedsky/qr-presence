import { NextResponse } from "next/server";
import { requireMeetingApi } from "@/lib/meeting-access";
import { hasPermission } from "@/lib/rbac";
import { duplicateMeeting } from "@/server/services/meetings";
import { assertMeetingType } from "@/server/services/meeting-types";
import { resolveSecretary } from "@/server/services/meeting-input";

/** Copie planifiée le lendemain, à la même heure que la réunion d'origine. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireMeetingApi(id, "read");
  if (gate.error) return gate.error;
  if (!hasPermission(gate.session.user.role, "meetings.create")) {
    return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  }
  const typeError = await assertMeetingType(gate.meeting.type);
  if (typeError) {
    return NextResponse.json({ error: `${typeError} : choisissez un autre type avant de dupliquer.` }, { status: 422 });
  }
  // Secrétaire désactivé ou changé de rôle depuis : la copie part sans secrétaire plutôt qu'avec un compte invalide.
  const secretary = await resolveSecretary(gate.meeting.secretaryId);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dropped = "error" in secretary;
  const copy = await duplicateMeeting(id, gate.session.user.id, tomorrow, {
    secretaryId: dropped ? null : secretary.secretaryId,
  });
  return NextResponse.json({
    id: copy.id,
    ...(dropped ? { notice: "Le secrétaire de séance d'origine n'est plus actif : affectez-en un à la copie." } : {}),
  });
}
