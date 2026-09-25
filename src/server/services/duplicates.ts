import { prisma } from "@/lib/prisma";

export async function findDuplicate(input: {
  meetingId: string;
  userId?: string | null;
  emailNormalized?: string | null;
  phoneNormalized?: string | null;
  nameKey: string;
}) {
  return prisma.attendance.findFirst({
    where: {
      meetingId: input.meetingId,
      status: "ACTIVE",
      OR: [
        input.userId ? { userId: input.userId } : undefined,
        input.emailNormalized ? { emailNormalized: input.emailNormalized } : undefined,
        input.phoneNormalized ? { phoneNormalized: input.phoneNormalized } : undefined,
        { nameKey: input.nameKey },
      ].filter(Boolean) as object[],
    },
    orderBy: { checkInAt: "asc" },
  });
}
