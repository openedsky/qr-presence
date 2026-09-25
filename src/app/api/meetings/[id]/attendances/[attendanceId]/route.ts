import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { attendancePatchSchema } from "@/lib/validators";
import { nameKey, normalizeEmail, toTitleFirstNames, toUpperLastName } from "@/lib/identity";
import { normalizePhone } from "@/lib/phone";
import { writeAudit } from "@/lib/audit";

const TRACKED = ["lastName", "firstNames", "jobTitle", "organization", "email", "phone"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; attendanceId: string }> },
) {
  const gate = await requireApiPermission("attendances.manage");
  if (gate.error) return gate.error;
  const { id, attendanceId } = await params;
  const body = await request.json();
  const parsed = attendancePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }
  const current = await prisma.attendance.findFirst({
    where: { id: attendanceId, meetingId: id },
  });
  if (!current) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const next = {
    lastName: parsed.data.lastName ? toUpperLastName(parsed.data.lastName) : current.lastName,
    firstNames: parsed.data.firstNames ? toTitleFirstNames(parsed.data.firstNames) : current.firstNames,
    jobTitle: parsed.data.jobTitle ?? current.jobTitle,
    organization: parsed.data.organization ?? current.organization,
    email: parsed.data.email ?? current.email,
    phone: parsed.data.phone ?? current.phone,
  };

  const emailNormalized = normalizeEmail(next.email);
  const phoneNormalized = normalizePhone(next.phone);
  const key = nameKey(next.lastName, next.firstNames);
  const isActive = current.status === "ACTIVE";

  try {
    await prisma.$transaction([
      prisma.attendance.update({
        where: { id: attendanceId },
        data: {
          ...next,
          emailNormalized,
          phoneNormalized,
          nameKey: key,
          activeEmailKey: isActive ? emailNormalized : null,
          activePhoneKey: isActive ? phoneNormalized : null,
          activeNameKey: isActive ? key : null,
          updatedById: gate.session.user.id,
        },
      }),
      ...TRACKED.filter((field) => String(current[field] ?? "") !== String(next[field] ?? "")).map((field) =>
        prisma.attendanceChange.create({
          data: {
            attendanceId,
            actorId: gate.session.user.id,
            field,
            oldValue: String(current[field] ?? ""),
            newValue: String(next[field] ?? ""),
          },
        }),
      ),
    ]);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Ces informations correspondent déjà à un autre participant de cette réunion." },
        { status: 409 },
      );
    }
    throw error;
  }

  await writeAudit({
    actorId: gate.session.user.id,
    action: "attendance.update",
    entity: "Attendance",
    entityId: attendanceId,
    beforeData: current,
    afterData: next,
  });

  return NextResponse.json({ ok: true });
}
