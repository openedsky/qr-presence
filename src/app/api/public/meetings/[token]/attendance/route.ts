import { NextResponse } from "next/server";
import { attendanceFormSchema } from "@/lib/validators";
import { resolveToken } from "@/lib/qr";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/server/services/settings";
import {
  ClosedMeetingError,
  DuplicateAttendanceError,
  registerAttendance,
} from "@/server/services/attendances";
import { displayName } from "@/lib/utils";
import { isRegistrationOpen } from "@/lib/meeting-status";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const settings = await getSettings();
  const ip = clientIp(request);
  const limit = await rateLimit(`${ip}:${token}`, settings.rateLimitPerMinute, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans une minute." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = attendanceFormSchema.safeParse({ ...body, token });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  const resolved = await resolveToken(token);
  if (!resolved) return NextResponse.json({ error: "QR invalide." }, { status: 404 });
  if (resolved.expired) return NextResponse.json({ error: "QR expiré." }, { status: 410 });

  const meeting = resolved.record.meeting;
  if (!isRegistrationOpen(meeting.status)) {
    return NextResponse.json({ error: "Les inscriptions sont fermées." }, { status: 409 });
  }
  if (meeting.qrSecurityLevel >= 2) {
    const now = Date.now();
    const open = meeting.registrationOpensAt?.getTime() ?? meeting.startsAt.getTime() - meeting.toleranceMinutes * 60000;
    const close = meeting.registrationClosesAt?.getTime() ?? (meeting.endsAt?.getTime() ?? now + 3600000);
    if (now < open || now > close + meeting.toleranceMinutes * 60000) {
      return NextResponse.json({ error: "En dehors de la fenêtre d'émargement." }, { status: 403 });
    }
  }

  try {
    const attendance = await registerAttendance({
      meetingId: meeting.id,
      meetingUuid: meeting.uuid,
      meetingStatus: meeting.status,
      signatureRequired: meeting.signatureRequired,
      emailRequired: meeting.emailRequired,
      allowGuests: meeting.allowGuests,
      civility: parsed.data.civility,
      lastName: parsed.data.lastName,
      firstNames: parsed.data.firstNames,
      jobTitle: parsed.data.jobTitle,
      organization: parsed.data.organization,
      email: parsed.data.email,
      phone: parsed.data.phone,
      signatureDataUrl: parsed.data.signatureDataUrl,
      method: "QR_CODE",
      ip,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({
      confirmationCode: attendance.confirmationCode,
      displayName: displayName(attendance.lastName, attendance.firstNames),
      organization: `${attendance.jobTitle} – ${attendance.organization}`,
      checkInAt: attendance.checkInAt,
    });
  } catch (error) {
    if (error instanceof DuplicateAttendanceError || error instanceof ClosedMeetingError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur" }, { status: 400 });
  }
}
