import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Après un changement de nom ou une annulation, un ancien homonyme resté seul n'est plus un doublon probable :
 * son signalement est levé (les signalements encore justifiés sont conservés).
 */
export async function clearLoneHomonymFlags(tx: Prisma.TransactionClient, meetingId: string, nameKey: string) {
  if (!nameKey) return;
  const active = await tx.attendance.findMany({
    where: { meetingId, status: "ACTIVE", nameKey },
    select: { id: true, suspectedDuplicate: true },
    take: 2,
  });
  if (active.length === 1 && active[0].suspectedDuplicate) {
    await tx.attendance.update({ where: { id: active[0].id }, data: { suspectedDuplicate: false } });
  }
}

/**
 * Bloque sur un identifiant fiable (compte, email, téléphone). Le nom seul ne bloque pas :
 * les homonymes sont fréquents, la présence est alors signalée « doublon probable ».
 * Sans email ni téléphone, rien ne distingue deux saisies du même nom : on bloque.
 */
export async function findDuplicate(input: {
  meetingId: string;
  userId?: string | null;
  emailNormalized?: string | null;
  phoneNormalized?: string | null;
  nameKey: string;
}) {
  const identifiers = [
    input.userId ? { userId: input.userId } : null,
    input.emailNormalized ? { emailNormalized: input.emailNormalized } : null,
    input.phoneNormalized ? { phoneNormalized: input.phoneNormalized } : null,
  ].filter((clause): clause is NonNullable<typeof clause> => clause !== null);

  if (identifiers.length > 0) {
    const blocking = await prisma.attendance.findFirst({
      where: { meetingId: input.meetingId, status: "ACTIVE", OR: identifiers },
      orderBy: [{ checkInAt: "asc" }, { id: "asc" }],
    });
    if (blocking) return { blocking, homonym: null };
  }

  const homonym = await prisma.attendance.findFirst({
    where: { meetingId: input.meetingId, status: "ACTIVE", nameKey: input.nameKey },
    orderBy: [{ checkInAt: "asc" }, { id: "asc" }],
  });
  if (homonym && identifiers.length === 0) return { blocking: homonym, homonym: null };
  return { blocking: null, homonym };
}
