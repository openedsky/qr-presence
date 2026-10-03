import { PrismaClient, MeetingStatus, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { DEFAULT_PRIVACY_NOTICE, LEGACY_PRIVACY_NOTICES } from "../src/lib/privacy-notice";
import { writeSecretFile } from "../src/lib/secret-file";

const prisma = new PrismaClient();
const production = process.env.NODE_ENV === "production";

function generatedPassword() {
  return `${randomBytes(9).toString("base64url")}-A7!`;
}

/**
 * Premier super administrateur : identifiants fournis par INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD,
 * sinon mot de passe aléatoire affiché une seule fois. Dans tous les cas il doit être changé à la première connexion.
 */
async function bootstrapAdmin() {
  const existing = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  if (existing) return existing;
  const email = (process.env.INITIAL_ADMIN_EMAIL || "admin@sodefor.ci").toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD || generatedPassword();
  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      firstName: process.env.INITIAL_ADMIN_FIRST_NAME || "Administrateur",
      lastName: process.env.INITIAL_ADMIN_LAST_NAME || "SODEFOR",
      jobTitle: "Super administrateur",
      organization: "SODEFOR",
      role: "SUPER_ADMIN",
      mustChangePassword: true,
      passwordChangedAt: new Date(),
    },
  });
  console.log(`Super administrateur créé : ${email}`);
  if (!process.env.INITIAL_ADMIN_PASSWORD) {
    // Hors des journaux du conteneur, souvent collectés : fichier 0600 sur le volume persistant.
    const file = await writeSecretFile("admin-temporary-password.txt", `${email} ${password}`);
    console.log(
      file
        ? `Mot de passe provisoire écrit dans ${file} (à lire puis supprimer).`
        : `Mot de passe provisoire (affiché une seule fois) : ${password}`,
    );
  }
  return admin;
}

async function seedReferenceData() {
  const setting = await prisma.organizationSetting.findFirst({ select: { id: true, privacyNotice: true } });
  if (!setting) {
    await prisma.organizationSetting.create({ data: { privacyNotice: DEFAULT_PRIVACY_NOTICE } });
  } else if (!setting.privacyNotice || LEGACY_PRIVACY_NOTICES.includes(setting.privacyNotice)) {
    await prisma.organizationSetting.update({ where: { id: setting.id }, data: { privacyNotice: DEFAULT_PRIVACY_NOTICE } });
  }

  // Référentiel initial seulement : ensuite il se gère dans Paramètres > Structures.
  if ((await prisma.structure.count()) > 0) return;
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
}

/** Comptes et réunion de démonstration : uniquement avec SEED_DEMO=1 (environnements de test). */
async function seedDemo(adminId: string) {
  const accounts: { email: string; firstName: string; lastName: string; jobTitle: string; role: Role }[] = [
    { email: "gest@sodefor.ci", firstName: "Awa", lastName: "KOUASSI", jobTitle: "Gestionnaire réunions", role: "MEETING_ADMIN" },
    { email: "secretaire@sodefor.ci", firstName: "Jean", lastName: "YAO", jobTitle: "Secrétaire de séance", role: "SECRETARY" },
    { email: "audit@sodefor.ci", firstName: "Marie", lastName: "KONE", jobTitle: "Auditrice interne", role: "AUDITOR" },
  ];
  const demoPassword = process.env.DEMO_PASSWORD || generatedPassword();
  const created: string[] = [];
  for (const account of accounts) {
    if (await prisma.user.findUnique({ where: { email: account.email }, select: { id: true } })) continue;
    await prisma.user.create({
      data: { ...account, organization: "SODEFOR", passwordHash: await bcrypt.hash(demoPassword, 12) },
    });
    created.push(account.email);
  }

  const startsAt = new Date(Date.now() + 60 * 60 * 1000);
  startsAt.setUTCMinutes(0, 0, 0);
  const meeting = await prisma.meeting.upsert({
    where: { slug: "reunion-de-demonstration" },
    update: {},
    create: {
      title: "RÉUNION DE DÉMONSTRATION",
      slug: "reunion-de-demonstration",
      internalRef: "DEMO-0001",
      description: "Réunion fictive pour tester l'émargement par QR code.",
      type: "COMITE",
      location: "Salle de conférence",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3 * 60 * 60 * 1000),
      status: MeetingStatus.OUVERTE,
      qrMode: "STATIC",
      qrSecurityLevel: 1,
      allowGuests: true,
      showPublicAttendance: false,
      expectedParticipants: 20,
      signatureRequired: true,
      emailRequired: true,
      createdById: adminId,
      updatedById: adminId,
    },
  });

  const existingToken = await prisma.meetingQrToken.findFirst({ where: { meetingId: meeting.id, revokedAt: null } });
  // DEMO_QR_TOKEN : jeton fixe pour les tests de bout en bout.
  const token = existingToken?.publicToken ?? (process.env.DEMO_QR_TOKEN || randomBytes(24).toString("base64url"));
  if (!existingToken) {
    await prisma.meetingQrToken.create({
      data: {
        meetingId: meeting.id,
        publicToken: token,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        tokenHint: token.slice(-6),
        type: "STATIC",
      },
    });
  }
  if (created.length > 0) {
    console.log(`Comptes de démonstration créés : ${created.join(", ")}`);
    if (!process.env.DEMO_PASSWORD) console.log(`Mot de passe de démonstration : ${demoPassword}`);
  }
  console.log(`QR de démonstration : /r/${token}`);
}

async function main() {
  const admin = await bootstrapAdmin();
  await seedReferenceData();
  if (process.env.SEED_DEMO === "1") {
    if (production) console.warn("ATTENTION : SEED_DEMO=1 crée des comptes de démonstration. À réserver aux environnements de test.");
    await seedDemo(admin.id);
  }
  console.log("Seed OK");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
