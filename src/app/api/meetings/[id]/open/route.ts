import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";
import { transitionMeeting } from "@/server/services/meetings";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireApiPermission("meetings.manage_own");
  if (gate.error) return gate.error;
  const { id } = await params;
  try {
    await transitionMeeting(id, "OUVERTE", gate.session.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur" }, { status: 400 });
  }
}
