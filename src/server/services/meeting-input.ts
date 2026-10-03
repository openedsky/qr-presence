import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fromDateTimeLocal } from "@/lib/utils";
import type { meetingFormSchema } from "@/lib/validators";

type MeetingForm = z.infer<typeof meetingFormSchema>;

/** Dates saisies à l'heure d'Abidjan (UTC+0), converties en instants indépendamment du fuseau du navigateur. */
export function meetingDates(data: MeetingForm) {
  return {
    startsAt: fromDateTimeLocal(data.startsAt)!,
    endsAt: fromDateTimeLocal(data.endsAt),
    registrationOpensAt: fromDateTimeLocal(data.registrationOpensAt),
    registrationClosesAt: fromDateTimeLocal(data.registrationClosesAt),
  };
}

/** Le secrétaire affecté doit être un compte actif ayant le rôle de secrétaire de séance. */
export async function resolveSecretary(secretaryId: string | null | undefined) {
  if (!secretaryId) return { secretaryId: null };
  const user = await prisma.user.findFirst({
    where: { id: secretaryId, role: "SECRETARY", active: true },
    select: { id: true },
  });
  if (!user) return { error: "Le secrétaire de séance choisi est introuvable ou inactif." };
  return { secretaryId: user.id };
}

export async function secretaryOptions() {
  const users = await prisma.user.findMany({
    where: { role: "SECRETARY", active: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });
  return users.map((user) => ({ id: user.id, label: `${user.lastName} ${user.firstName}` }));
}
