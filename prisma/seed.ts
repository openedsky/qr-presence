import { PrismaClient, MeetingStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin@Sodefor2026!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@sodefor.ci" },
    update: {},
    create: {
      email: "admin@sodefor.ci",
      passwordHash,
      firstName: "Anselme",
      lastName: "SERI",
      jobTitle: "DSI",
      organization: "SODEFOR",
      phone: "0700000001",
      role: "SUPER_ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "gest@sodefor.ci" },
    update: {},
    create: {
      email: "gest@sodefor.ci",
      passwordHash: await bcrypt.hash("Gest@Sodefor2026!", 12),
      firstName: "Awa",
      lastName: "KOUASSI",
      jobTitle: "Gestionnaire réunions",
      organization: "SODEFOR",
      role: "MEETING_ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "secretaire@sodefor.ci" },
    update: {},
    create: {
      email: "secretaire@sodefor.ci",
      passwordHash: await bcrypt.hash("Secretaire@2026!", 12),
      firstName: "Jean",
      lastName: "YAO",
      jobTitle: "Secrétaire de séance",
      organization: "SODEFOR",
      role: "SECRETARY",
    },
  });

  await prisma.user.upsert({
    where: { email: "audit@sodefor.ci" },
    update: {},
    create: {
      email: "audit@sodefor.ci",
      passwordHash: await bcrypt.hash("Audit@Sodefor2026!", 12),
      firstName: "Marie",
      lastName: "KONE",
      jobTitle: "Auditrice interne",
      organization: "SODEFOR",
      role: "AUDITOR",
    },
  });

  const privacy =
    "Les informations collectées (identité, fonction, structure, coordonnées et signature) sont destinées exclusivement à l'établissement des listes de présence des réunions SODEFOR. Elles sont accessibles aux seuls agents habilités et ne sont pas publiées sur la page publique d'émargement.";

  if (!(await prisma.organizationSetting.findFirst())) {
    await prisma.organizationSetting.create({ data: { privacyNotice: privacy } });
  }

  const structures = [
    "SODEFOR",
    "DSI – SODEFOR",
    "Direction Générale",
    "Centre de Gestion d'Abidjan",
    "Ministère des Eaux et Forêts",
    "Partenaire externe",
  ];
  for (const name of structures) {
    await prisma.structure.upsert({
      where: { name },
      update: {},
      create: { name, internal: !name.toLowerCase().includes("externe") },
    });
  }

  const startsAt = new Date("2026-09-21T14:30:00.000Z");
  const meeting = await prisma.meeting.upsert({
    where: { slug: "comite-technique-21-septembre-2026" },
    update: { qrSecurityLevel: 1 },
    create: {
      title: "COMITE TECHNIQUE",
      slug: "comite-technique-21-septembre-2026",
      internalRef: "REU-2026-0921",
      description: "Comité technique institutionnel — émargement par QR Code.",
      type: "COMITE",
      location: "Salle de conférence",
      startsAt,
      endsAt: new Date("2026-09-21T17:30:00.000Z"),
      status: MeetingStatus.OUVERTE,
      qrMode: "STATIC",
      qrSecurityLevel: 1,
      allowGuests: true,
      showPublicAttendance: true,
      expectedParticipants: 40,
      signatureRequired: true,
      emailRequired: true,
      createdById: admin.id,
      updatedById: admin.id,
    },
  });

  const token = "demo-comite-technique-sodefor-2026-token";
  const { createHash } = await import("crypto");
  await prisma.meetingQrToken.upsert({
    where: { publicToken: token },
    update: { revokedAt: null, createdAt: new Date() },
    create: {
      meetingId: meeting.id,
      publicToken: token,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      tokenHint: token.slice(-6),
      type: "STATIC",
    },
  });

  console.log("Seed OK");
  console.log("Admin: admin@sodefor.ci / Admin@Sodefor2026!");
  console.log("Démo QR: /r/demo-comite-technique-sodefor-2026-token");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
