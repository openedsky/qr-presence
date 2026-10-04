import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postCloseGuard, requireMeetingApi } from "@/lib/meeting-access";
import { attendanceFormSchema } from "@/lib/validators";
import { fromDateTimeLocal } from "@/lib/utils";
import { logger } from "@/lib/logger";
import {
  ATTENDANCE_ORDER,
  AttendanceValidationError,
  ClosedMeetingError,
  DuplicateAttendanceError,
  GuestsNotAllowedError,
  registerAttendance,
} from "@/server/services/attendances";
import { scheduleOfficialRefresh } from "@/server/services/documents";
import { readJsonBody } from "@/lib/http";
import { hasPermission } from "@/lib/rbac";

/** Champs exposés au back-office : ni empreinte d'IP ni navigateur (données techniques de sécurité). */
const PUBLIC_FIELDS = {
  id: true,
  civility: true,
  lastName: true,
  firstNames: true,
  gender: true,
  jobTitle: true,
  organization: true,
  email: true,
  phone: true,
  suspectedDuplicate: true,
  checkInAt: true,
  checkInMethod: true,
  manualReason: true,
  status: true,
  cancelledAt: true,
  cancelReason: true,
  confirmationCode: true,
  publicListConsent: true,
} as const;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireMeetingApi(id, "read");
  if (gate.error) return gate.error;
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").slice(0, 100);
  // Coordonnées et code de confirmation : réservés aux gestionnaires (sinon contournement de l'export tracé).
  const withContact = hasPermission(gate.session.user.role, "attendances.manage");
  const { email, phone, confirmationCode, ...withoutContact } = PUBLIC_FIELDS;
  const rows = await prisma.attendance.findMany({
    where: {
      meetingId: id,
      OR: q
        ? [
            { lastName: { contains: q } },
            { firstNames: { contains: q } },
            ...(withContact ? [{ email: { contains: q } }, { phone: { contains: q } }] : []),
            { jobTitle: { contains: q } },
            { organization: { contains: q } },
          ]
        : undefined,
    },
    select: withContact ? { ...withoutContact, email, phone, confirmationCode } : withoutContact,
    orderBy: ATTENDANCE_ORDER,
  });
  return NextResponse.json(rows);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireMeetingApi(id, "attendances.manage");
  if (gate.error) return gate.error;
  const meeting = gate.meeting;
  const body = (await readJsonBody(request)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  const frozen = postCloseGuard(meeting, body.reason);
  if (frozen.error) return frozen.error;
  const parsed = attendanceFormSchema.safeParse({
    ...body,
    token: "admin-manual-token-placeholder",
    signatureDataUrl: "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  const checkInAt = typeof body.checkInAt === "string" && body.checkInAt ? fromDateTimeLocal(body.checkInAt) : null;
  if (typeof body.checkInAt === "string" && body.checkInAt && !checkInAt) {
    return NextResponse.json({ error: "Heure d'arrivée invalide" }, { status: 400 });
  }
  const earliest = (meeting.registrationOpensAt ?? meeting.startsAt).getTime() - 24 * 60 * 60 * 1000;
  if (checkInAt && checkInAt.getTime() < earliest) {
    return NextResponse.json(
      { error: "L'heure d'arrivée ne peut pas précéder de plus de 24 h l'ouverture de l'émargement." },
      { status: 400 },
    );
  }
  const manualReason = typeof body.manualReason === "string" ? body.manualReason.trim().slice(0, 400) : null;
  try {
    const attendance = await registerAttendance({
      meetingId: meeting.id,
      meetingUuid: meeting.uuid,
      meetingStatus: meeting.status,
      signatureRequired: false,
      emailRequired: meeting.emailRequired,
      allowGuests: meeting.allowGuests,
      civility: parsed.data.civility,
      lastName: parsed.data.lastName,
      firstNames: parsed.data.firstNames,
      jobTitle: parsed.data.jobTitle,
      organization: parsed.data.organization,
      email: parsed.data.email,
      phone: parsed.data.phone,
      createdById: gate.session.user.id,
      method: "ADMIN_MANUAL",
      correctionReason: frozen.reason,
      checkInAt,
      manualReason,
    });
    if (frozen.reason) scheduleOfficialRefresh(meeting.id, gate.session.user.id);
    return NextResponse.json({
      id: attendance.id,
      confirmationCode: attendance.confirmationCode,
      suspectedDuplicate: attendance.suspectedDuplicate,
    });
  } catch (error) {
    if (error instanceof DuplicateAttendanceError) {
      return NextResponse.json({ error: error.adminMessage }, { status: 409 });
    }
    if (error instanceof ClosedMeetingError || error instanceof GuestsNotAllowedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof AttendanceValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error("attendance.manual_failed", error);
    return NextResponse.json({ error: "La présence n'a pas pu être enregistrée." }, { status: 500 });
  }
}
