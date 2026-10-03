import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { meetingTypeSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import { listMeetingTypes, meetingTypeCode } from "@/server/services/meeting-types";
import { readJsonBody } from "@/lib/http";

export async function GET() {
  const gate = await requireApiPermission("attendances.read");
  if (gate.error) return gate.error;
  return NextResponse.json(await listMeetingTypes());
}

export async function POST(request: Request) {
  const gate = await requireApiPermission("settings.manage");
  if (gate.error) return gate.error;
  const parsed = meetingTypeSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  const code = parsed.data.code || meetingTypeCode(parsed.data.label);
  if (code.length < 2) return NextResponse.json({ error: "Impossible de déduire un code : saisissez-le." }, { status: 400 });
  if (await prisma.meetingTypeOption.findUnique({ where: { code } })) {
    return NextResponse.json({ error: `Le code ${code} existe déjà.` }, { status: 409 });
  }
  const type = await prisma.meetingTypeOption.create({
    data: {
      code,
      label: parsed.data.label,
      color: parsed.data.color,
      active: parsed.data.active,
      sortOrder: parsed.data.sortOrder,
    },
  });
  await writeAudit({
    actorId: gate.session.user.id,
    action: "meeting_type.create",
    entity: "MeetingTypeOption",
    entityId: type.id,
    afterData: { code: type.code, label: type.label, color: type.color, active: type.active, sortOrder: type.sortOrder },
  });
  return NextResponse.json(type);
}
