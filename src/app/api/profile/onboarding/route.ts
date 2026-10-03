import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

/** Visite guidée terminée ou passée : elle ne sera plus proposée automatiquement. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const result = await prisma.user.updateMany({
    where: { id: session.user.id, onboardingCompletedAt: null },
    data: { onboardingCompletedAt: new Date() },
  });
  if (result.count > 0) {
    await writeAudit({
      actorId: session.user.id,
      action: "user.onboarding_completed",
      entity: "User",
      entityId: session.user.id,
    });
  }
  return NextResponse.json({ ok: true });
}
