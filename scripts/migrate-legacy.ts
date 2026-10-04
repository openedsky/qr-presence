/**
 * Migration publication (REUNION) → meetings
 * et presence → attendances.
 *
 * Usage:
 *   LEGACY_DATABASE_URL="mysql://user:pass@host:3306/old_db" npx tsx scripts/migrate-legacy.ts
 */
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { nameKey, normalizeEmail, toTitleFirstNames, toUpperLastName } from "../src/lib/identity";
import { normalizePhone } from "../src/lib/phone";

const target = new PrismaClient();

function confirmationCode() {
  return `SDF-${randomBytes(6).toString("hex").toUpperCase()}`;
}

/** Les deux générations de l'intranet coexistent : lieu/lieu_evenement, actif/is_active, ferme/is_reunion_closed. */
type LegacyMeeting = {
  id: number;
  titre: string;
  slug: string;
  contenu?: string | null;
  type_publication?: string | null;
  lieu?: string | null;
  lieu_evenement?: string | null;
  url_visio?: string | null;
  date_debut?: Date | null;
  date_fin?: Date | null;
  actif?: number | null;
  is_active?: number | boolean | null;
  ferme?: number | null;
  is_reunion_closed?: number | boolean | null;
  user_id?: number | null;
  sha1?: string | null;
  sha2?: string | null;
};

function flag(...values: (number | boolean | null | undefined)[]) {
  const value = values.find((item) => item !== null && item !== undefined);
  return value === undefined ? undefined : Boolean(Number(value));
}

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
  is_active?: number | boolean | null;
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
    const startsAt = row.date_debut ?? new Date();
    const endsAt = row.date_fin ?? null;
    // Réunion passée : clôturée à sa date de fin (sinon la clôture automatique et les PDF officiels partiraient en masse).
    const past = (endsAt ?? startsAt).getTime() < Date.now();
    const closed = flag(row.ferme, row.is_reunion_closed) || past;
    const presences = await legacy.$queryRaw<LegacyPresence[]>`
      SELECT * FROM presence WHERE reunion_id = ${row.id}
    `;
    // Une réunion et ses présences forment un tout : un échec ne laisse pas de réunion à moitié reprise.
    const meeting = await target.$transaction(async (tx) => {
      const created = await tx.meeting.create({
        data: {
          title: row.titre || "Réunion migrée",
          slug: `${row.slug || "reunion"}-legacy-${row.id}`,
          internalRef: `LEG-${row.id}`,
          description: row.contenu,
          location: row.lieu ?? row.lieu_evenement,
          videoConferenceUrl: row.url_visio,
          startsAt,
          endsAt,
          status: closed ? "CLOTUREE" : flag(row.actif, row.is_active) ? "OUVERTE" : "PLANIFIEE",
          closedAt: closed ? (endsAt ?? startsAt) : null,
          createdById: admin.id,
          legacyPublicationId: row.id,
          legacySha1: row.sha1,
          legacySha2: row.sha2,
        },
      });

      // Clés de doublon (uniques par réunion) : seule la première présence active d'un email/téléphone les porte.
      // Les présences actives en double (même email, téléphone ou nom) sont reprises mais signalées à l'organisateur.
      const seenEmails = new Set<string>();
      const seenPhones = new Set<string>();
      const activeByName = new Map<string, number>();
      const duplicateNames = new Set<string>();
      for (const presence of presences) {
        const lastName = toUpperLastName(presence.nom || "") || "INCONNU";
        const firstNames = toTitleFirstNames(presence.prenom || "") || "Inconnu";
        const active = flag(presence.actif, presence.is_active) !== false;
        const emailNormalized = normalizeEmail(presence.email);
        const phoneNormalized = normalizePhone(presence.contact);
        const key = nameKey(lastName, firstNames);
        const emailKey = active && emailNormalized && !seenEmails.has(emailNormalized) ? emailNormalized : null;
        const phoneKey = active && phoneNormalized && !seenPhones.has(phoneNormalized) ? phoneNormalized : null;
        const contactDuplicate =
          active &&
          ((emailNormalized !== null && emailKey === null) || (phoneNormalized !== null && phoneKey === null));
        if (emailKey) seenEmails.add(emailKey);
        if (phoneKey) seenPhones.add(phoneKey);
        if (active) {
          const count = (activeByName.get(key) ?? 0) + 1;
          activeByName.set(key, count);
          if (count > 1) duplicateNames.add(key);
        }
        await tx.attendance.create({
          data: {
            meetingId: created.id,
            lastName,
            firstNames,
            civility: presence.civilite === "Mme" ? "MME" : presence.civilite === "Mlle" ? "MLLE" : "M",
            gender: presence.sexe === "F" ? "F" : "M",
            jobTitle: presence.fonction || "Non renseigné",
            organization: presence.structure || "Non renseigné",
            email: presence.email,
            phone: presence.contact,
            emailNormalized,
            phoneNormalized,
            nameKey: key,
            activeEmailKey: emailKey,
            activePhoneKey: phoneKey,
            activeNameKey: active ? key : null,
            suspectedDuplicate: contactDuplicate,
            confirmationCode: `LEG-${presence.id}-${confirmationCode()}`,
            checkInAt: presence.created_at ?? new Date(),
            checkInMethod: "QR_CODE",
            status: active ? "ACTIVE" : "ANNULEE",
            legacyPresenceId: presence.id,
            ipHash: createHash("sha256").update(`legacy:${presence.id}`).digest("hex"),
          },
        });
      }
      if (duplicateNames.size > 0) {
        await tx.attendance.updateMany({
          where: { meetingId: created.id, activeNameKey: { in: [...duplicateNames] } },
          data: { suspectedDuplicate: true },
        });
      }
      return created;
    }, { timeout: 120_000 });
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
