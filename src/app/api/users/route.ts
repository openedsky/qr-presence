import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { userFormSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const gate = await requireApiPermission("users.manage");
  if (gate.error) return gate.error;
  const parsed = userFormSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  const passwordHash = await bcrypt.hash(parsed.data.password || "ChangeMe@2026", 12);
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      jobTitle: parsed.data.jobTitle || null,
      organization: parsed.data.organization || "SODEFOR",
      phone: parsed.data.phone || null,
      role: parsed.data.role,
      passwordHash,
      active: parsed.data.active,
    },
  });
  await writeAudit({
    actorId: gate.session.user.id,
    action: "user.create",
    entity: "User",
    entityId: user.id,
    afterData: { email: user.email, role: user.role },
  });
  return NextResponse.json({ id: user.id });
}
