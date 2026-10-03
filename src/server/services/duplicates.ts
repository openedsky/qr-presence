import { prisma } from "@/lib/prisma";

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
      orderBy: { checkInAt: "asc" },
    });
    if (blocking) return { blocking, homonym: null };
  }

  const homonym = await prisma.attendance.findFirst({
    where: { meetingId: input.meetingId, status: "ACTIVE", nameKey: input.nameKey },
    orderBy: { checkInAt: "asc" },
  });
  if (homonym && identifiers.length === 0) return { blocking: homonym, homonym: null };
  return { blocking: null, homonym };
}
