import { NextResponse } from "next/server";
import type { Meeting, MeetingStatus } from "@prisma/client";
import { requireMeetingApi, type MeetingAction } from "./meeting-access";
import { logger } from "./logger";
import { TransitionError, transitionMeeting } from "@/server/services/meetings";

/** Traitement commun des routes de changement de statut : droits, garde métier, erreurs génériques. */
export async function transitionRoute(
  id: string,
  action: MeetingAction,
  to: MeetingStatus,
  guard?: (meeting: Meeting) => string | null,
) {
  const gate = await requireMeetingApi(id, action);
  if (gate.error) return gate.error;
  const refused = guard?.(gate.meeting);
  if (refused) return NextResponse.json({ error: refused }, { status: 403 });
  try {
    // Statut attendu = celui qu'a vu la garde : si la réunion a changé entre-temps, la transition est refusée.
    await transitionMeeting(id, to, gate.session.user.id, { from: gate.meeting.status });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TransitionError) return NextResponse.json({ error: error.message }, { status: 409 });
    logger.error("meeting.transition_failed", { meetingId: id, to, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Le changement de statut a échoué. Réessayez." }, { status: 500 });
  }
}
