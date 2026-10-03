import { NextResponse } from "next/server";
import { notFound, redirect } from "next/navigation";
import type { Meeting, Role } from "@prisma/client";
import type { Session } from "next-auth";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { hasPermission, meetingScope, type Permission } from "./rbac";

export type MeetingAction =
  | "read"
  | "manage"
  | "attendances.manage"
  | "export"
  | "documents"
  | "qr"
  | "close"
  | "archive"
  | "reopen"
  | "delete";

const ACTION_PERMISSION: Record<MeetingAction, Permission> = {
  read: "attendances.read",
  manage: "meetings.manage_own",
  "attendances.manage": "attendances.manage",
  export: "attendances.export",
  documents: "documents.read",
  qr: "qr.display",
  close: "meetings.close",
  archive: "meetings.archive",
  reopen: "meetings.reopen",
  delete: "meetings.delete",
};

/** Vrai si le rôle ne voit qu'une partie des réunions (les siennes ou celles qui lui sont affectées). */
export function isOwnMeetingsOnly(role: Role) {
  return meetingScope(role) !== "all";
}

export function canAccessMeeting(
  user: { id: string; role: Role },
  meeting: Pick<Meeting, "createdById" | "secretaryId">,
  action: MeetingAction,
) {
  if (!hasPermission(user.role, ACTION_PERMISSION[action])) return false;
  const scope = meetingScope(user.role);
  if (scope === "own" && meeting.createdById !== user.id) return false;
  if (scope === "assigned" && meeting.secretaryId !== user.id) return false;
  return true;
}

type ApiGate =
  | { error: NextResponse; session?: never; meeting?: never }
  | { error?: never; session: Session; meeting: Meeting };

/** Réponse 404 hors périmètre : l'existence d'une réunion d'un autre organisateur n'est pas révélée. */
export async function requireMeetingApi(meetingId: string, action: MeetingAction): Promise<ApiGate> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  }
  if (!hasPermission(session.user.role, ACTION_PERMISSION[action])) {
    return { error: NextResponse.json({ error: "Accès interdit" }, { status: 403 }) };
  }
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting || !canAccessMeeting(session.user, meeting, action)) {
    return { error: NextResponse.json({ error: "Réunion introuvable" }, { status: 404 }) };
  }
  return { session, meeting };
}

/**
 * Après clôture, la liste officielle fait foi : toute correction exige un motif (tracé et repris
 * dans la version suivante de la liste). Une réunion archivée n'est plus modifiable.
 */
export function postCloseGuard(
  meeting: Pick<Meeting, "status" | "purgedAt">,
  reason: unknown,
): { error: NextResponse; reason?: never } | { error?: never; reason: string | null } {
  if (meeting.purgedAt) {
    return { error: NextResponse.json({ error: "Données anonymisées (durée de conservation écoulée)." }, { status: 409 }) };
  }
  if (meeting.status === "ARCHIVEE") {
    return { error: NextResponse.json({ error: "Réunion archivée : aucune modification possible." }, { status: 409 }) };
  }
  if (meeting.status !== "CLOTUREE") return { reason: null };
  const text = typeof reason === "string" ? reason.trim() : "";
  if (text.length < 5) {
    return {
      error: NextResponse.json(
        { error: "Réunion clôturée : indiquez le motif de la correction (5 caractères minimum).", needsReason: true },
        { status: 422 },
      ),
    };
  }
  return { reason: text.slice(0, 400) };
}

export async function requireMeetingPage(meetingId: string, action: MeetingAction = "read") {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!hasPermission(session.user.role, ACTION_PERMISSION[action])) redirect("/dashboard?interdit=1");
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting || !canAccessMeeting(session.user, meeting, action)) notFound();
  return { session, meeting };
}
