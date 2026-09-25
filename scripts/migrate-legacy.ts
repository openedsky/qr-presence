/**
 * Migration publication (REUNION) → meetings
 * et presence → attendances.
 *
 * Usage:
 *   LEGACY_DATABASE_URL="mysql://user:pass@host:3306/old_db" npx tsx scripts/migrate-legacy.ts
 */
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";
import { nameKey, normalizeEmail } from "../src/lib/identity";
import { normalizePhone } from "../src/lib/phone";
import { confirmationCode } from "../src/lib/utils";

const target = new PrismaClient();

type LegacyMeeting = {
  id: number;
  titre: string;
  slug: string;
  contenu?: string | null;
  type_publication?: string | null;
  lieu?: string | null;
  url_visio?: string | null;
  date_debut?: Date | null;
  date_fin?: Date | null;
  actif?: number | null;
  ferme?: number | null;
  user_id?: number | null;
  sha1?: string | null;
  sha2?: string | null;
};

type LegacyPresence = {
  id: number;
  reunion_id: number;
  nom?: string | null;
  prenom?: string | null;
  civilite?: string | null;
  sexe?: string | null;
  fonction?: string | null;
  structure?: string | null;
  email?: string | null;
  contact?: string | null;
  user_id?: number | null;
  actif?: number | null;
  created_at?: Date | null;
};

async function main() {
  const url = process.env.LEGACY_DATABASE_URL;
  if (!url) {
    throw new Error("LEGACY_DATABASE_URL manquant");
  }
  const legacy = new PrismaClient({ datasources: { db: { url } } });
  const admin = await target.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  if (!admin) throw new Error("Exécutez d'abord le seed pour disposer d'un administrateur.");

  const meetings = await legacy.$queryRaw<LegacyMeeting[]>`
    SELECT * FROM publication WHERE type_publication = 'REUNION'
  `;

  for (const row of meetings) {
    const existing = await target.meeting.findFirst({
      where: { legacyPublicationId: row.id },
    });
    if (existing) continue;
    const meeting = await target.meeting.create({
      data: {
        title: row.titre || "Réunion migrée",
        slug: `${row.slug || "reunion"}-legacy-${row.id}`,
        internalRef: `LEG-${row.id}`,
        description: row.contenu,
        location: row.lieu,
        videoConferenceUrl: row.url_visio,
        startsAt: row.date_debut ?? new Date(),
        endsAt: row.date_fin,
        status: row.ferme ? "CLOTUREE" : row.actif ? "OUVERTE" : "PLANIFIEE",
        createdById: admin.id,
        legacyPublicationId: row.id,
        legacySha1: row.sha1,
        legacySha2: row.sha2,
      },
    });

    const presences = await legacy.$queryRaw<LegacyPresence[]>`
      SELECT * FROM presence WHERE reunion_id = ${row.id}
    `;
    for (const presence of presences) {
      const lastName = (presence.nom || "INCONNU").toUpperCase();
      const firstNames = presence.prenom || "Inconnu";
      await target.attendance.create({
        data: {
          meetingId: meeting.id,
          lastName,
          firstNames,
          civility: presence.civilite === "Mme" ? "MME" : presence.civilite === "Mlle" ? "MLLE" : "M",
          gender: presence.sexe === "F" ? "F" : "M",
          jobTitle: presence.fonction || "Non renseigné",
          organization: presence.structure || "Non renseigné",
          email: presence.email,
          phone: presence.contact,
          emailNormalized: normalizeEmail(presence.email),
          phoneNormalized: normalizePhone(presence.contact),
          nameKey: nameKey(lastName, firstNames),
          confirmationCode: `LEG-${presence.id}-${confirmationCode()}`,
          checkInAt: presence.created_at ?? new Date(),
          checkInMethod: "QR_CODE",
          status: presence.actif === 0 ? "ANNULEE" : "ACTIVE",
          legacyPresenceId: presence.id,
          ipHash: createHash("sha256").update(`legacy:${presence.id}`).digest("hex"),
        },
      });
    }
    console.log(`Migré publication #${row.id} → ${meeting.internalRef} (${presences.length} présences)`);
  }

  await legacy.$disconnect();
  await target.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await target.$disconnect();
  process.exit(1);
});
