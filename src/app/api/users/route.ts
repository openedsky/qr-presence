import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-auth";
import { userFormSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import { generateTemporaryPassword } from "@/lib/temp-password";
import { readJsonBody } from "@/lib/http";

export async function POST(request: Request) {
  const gate = await requireApiPermission("users.manage");
  if (gate.error) return gate.error;
  const parsed = userFormSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  const temporaryPassword = generateTemporaryPassword();
  try {
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        jobTitle: parsed.data.jobTitle || null,
        organization: parsed.data.organization || "SODEFOR",
        phone: parsed.data.phone || null,
        role: parsed.data.role,
        passwordHash: await bcrypt.hash(temporaryPassword, 12),
        passwordChangedAt: new Date(),
        mustChangePassword: true,
        active: parsed.data.active,
      },
    });
    await writeAudit({
      actorId: gate.session.user.id,
      action: "user.create",
      entity: "User",
      entityId: user.id,
      afterData: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        jobTitle: user.jobTitle,
        organization: user.organization,
        role: user.role,
        active: user.active,
      },
    });
    return NextResponse.json({ id: user.id, temporaryPassword });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Un compte existe déjà avec cet email." }, { status: 409 });
    }
    throw error;
  }
}
