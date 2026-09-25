import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { duplicateMeeting } from "@/server/services/meetings";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireApiPermission("meetings.create");
  if (gate.error) return gate.error;
  const { id } = await params;
  const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const copy = await duplicateMeeting(id, gate.session.user.id, startsAt);
  return NextResponse.json({ id: copy.id });
}
