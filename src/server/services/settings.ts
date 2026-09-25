import { prisma } from "@/lib/prisma";

const DEFAULT_PRIVACY =
  "Les informations collectées (identité, fonction, structure, coordonnées et signature) sont destinées exclusivement à l'établissement des listes de présence des réunions SODEFOR. Elles sont accessibles aux seuls agents habilités, conservées pour la durée paramétrée, et ne sont pas publiées sur la page publique d'émargement.";

export async function getSettings() {
  const existing = await prisma.organizationSetting.findFirst();
  if (existing) return existing;
  return prisma.organizationSetting.create({
    data: { privacyNotice: DEFAULT_PRIVACY },
  });
}
