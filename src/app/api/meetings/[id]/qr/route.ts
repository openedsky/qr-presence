import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { currentDynamicToken, ensureStaticToken } from "@/lib/qr";
import { getSettings } from "@/server/services/settings";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireApiPermission("attendances.read");
  if (gate.error) return gate.error;
  const { id } = await params;
  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const settings = await getSettings();
  const payload =
    meeting.qrMode === "DYNAMIC"
      ? await currentDynamicToken(meeting, settings.dynamicQrSeconds)
      : await ensureStaticToken(meeting);
  return NextResponse.json({ url: payload.url, mode: meeting.qrMode });
}
