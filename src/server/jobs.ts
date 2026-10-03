import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { cacheSetNx } from "@/lib/redis";
import { deleteObject } from "@/lib/storage";
import { windowState } from "@/lib/meeting-status";
import { generateTemporaryPassword } from "@/lib/temp-password";
import { writeSecretFile } from "@/lib/secret-file";
import { mapWithLimit } from "@/lib/concurrency";
import { DEFAULT_PRIVACY_NOTICE, LEGACY_PRIVACY_NOTICES } from "@/lib/privacy-notice";
import { TransitionError, transitionMeeting } from "./services/meetings";
import { getSettings } from "./services/settings";
import { reconcileOfficialLists } from "./services/documents";

const AUTO_CLOSE_EVERY_MS = 5 * 60_000;
const PURGE_EVERY_MS = 6 * 3600_000;
export const REOPEN_GRACE_MS = 24 * 3600_000;
const ANONYMIZED = "ANONYMISÉ";
const DELETE_CONCURRENCY = 8;

/** Verrou partagé (Redis) : avec plusieurs instances, une seule exécute chaque passage. */
async function withLock(name: string, ttlSeconds: number, job: () => Promise<void>) {
  if (!(await cacheSetNx(`job:${name}`, String(process.pid), ttlSeconds))) return;
  try {
    await job();
  } catch (error) {
    logger.error(`job.${name}_failed`, error);
  }
}

/** Clôture les réunions ouvertes dont la fenêtre d'émargement est dépassée, et établit la liste officielle. */
export async function autoCloseMeetings(now = new Date()) {
  const open = await prisma.meeting.findMany({
    where: { status: { in: ["OUVERTE", "EN_COURS"] } },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      registrationOpensAt: true,
      registrationClosesAt: true,
      toleranceMinutes: true,
      reopenedAt: true,
    },
  });
  let closed = 0;
  for (const meeting of open) {
    if (windowState(meeting, now) !== "after") continue;
    // Rouverte après la fin de la fenêtre (corrections) : délai laissé avant la nouvelle clôture automatique.
    if (meeting.reopenedAt && now.getTime() - meeting.reopenedAt.getTime() < REOPEN_GRACE_MS) continue;
    try {
      await transitionMeeting(meeting.id, "CLOTUREE", null, { auto: true });
      closed += 1;
    } catch (error) {
      if (!(error instanceof TransitionError)) throw error;
    }
  }
  if (closed > 0) logger.info("job.auto_close", { closed });
  return closed;
}

/**
 * Durée de conservation écoulée : les présences sont anonymisées (identité, coordonnées, empreintes),
 * les signatures supprimées et les QR révoqués. Les listes officielles signées restent archivées.
 */
export async function purgeExpiredMeetings(now = new Date()) {
  const { retentionMonths } = await getSettings();
  const limit = new Date(now);
  limit.setUTCMonth(limit.getUTCMonth() - retentionMonths);
  const meetings = await prisma.meeting.findMany({
    where: {
      status: { in: ["CLOTUREE", "ARCHIVEE"] },
      purgedAt: null,
      // Réunions clôturées par les anciennes versions : pas de date de clôture, on retient la fin (ou le début).
      OR: [
        { closedAt: { lt: limit } },
        { closedAt: null, endsAt: { lt: limit } },
        { closedAt: null, endsAt: null, startsAt: { lt: limit } },
      ],
    },
    select: { id: true },
    take: 50,
  });
  for (const { id } of meetings) {
    // La liste officielle conservée doit refléter les dernières corrections avant que les données ne disparaissent.
    await reconcileOfficialLists([id], 1);
    const attendances = await prisma.attendance.findMany({
      where: { meetingId: id },
      select: { id: true, signatureObjectKey: true },
    });
    // Listes provisoires et publiques : copies nominatives sans valeur probante, supprimées.
    const transientDocs = await prisma.generatedDocument.findMany({
      where: { meetingId: id, type: { in: ["LISTE_PROVISOIRE", "LISTE_PUBLIQUE"] } },
      select: { id: true, objectKey: true },
    });
    const keys = [
      ...attendances.map((row) => row.signatureObjectKey),
      ...transientDocs.map((doc) => doc.objectKey),
    ].filter((key): key is string => Boolean(key));
    const ids = attendances.map((row) => row.id);
    await prisma.$transaction([
      prisma.generatedDocument.deleteMany({ where: { id: { in: transientDocs.map((doc) => doc.id) } } }),
      // Le journal d'audit conserve la trace des actions, pas les données personnelles qu'elles portaient.
      prisma.auditLog.updateMany({
        where: { entity: "Attendance", entityId: { in: ids } },
        data: { beforeData: Prisma.DbNull, afterData: Prisma.DbNull, ipAddress: null, userAgent: null },
      }),
      prisma.attendanceChange.deleteMany({ where: { attendanceId: { in: ids } } }),
      prisma.attendance.updateMany({
        where: { meetingId: id },
        data: {
          lastName: ANONYMIZED,
          firstNames: "",
          jobTitle: "",
          email: null,
          phone: null,
          emailNormalized: null,
          phoneNormalized: null,
          nameKey: "",
          activeEmailKey: null,
          activePhoneKey: null,
          activeNameKey: null,
          activeUserKey: null,
          userId: null,
          signatureObjectKey: null,
          signatureHash: null,
          signatureMime: null,
          signatureSize: null,
          ipHash: null,
          userAgent: null,
          manualReason: null,
          cancelReason: null,
          publicListConsent: false,
        },
      }),
      prisma.meetingQrToken.updateMany({ where: { meetingId: id, revokedAt: null }, data: { revokedAt: now } }),
      prisma.meeting.update({ where: { id }, data: { purgedAt: now } }),
    ]);
    // Après la base : si la transaction échoue, les signatures restent cohérentes avec les présences.
    await mapWithLimit(keys, DELETE_CONCURRENCY, (key) =>
      deleteObject(key).catch((error) => logger.warn("job.object_delete_failed", { key, error: String(error) })),
    );
    await writeAudit({
      actorId: null,
      action: "meeting.retention_purge",
      entity: "Meeting",
      entityId: id,
      afterData: { attendances: ids.length, documents: transientDocs.length, retentionMonths },
    });
  }
  // Emails saisis lors d'échecs de connexion : aucune valeur au-delà de la durée de conservation.
  await prisma.auditLog.updateMany({
    where: { action: { in: ["auth.login_failed", "auth.locked"] }, createdAt: { lt: limit }, afterData: { not: Prisma.DbNull } },
    data: { afterData: Prisma.DbNull, ipAddress: null, userAgent: null },
  });
  if (meetings.length > 0) logger.info("job.retention_purge", { meetings: meetings.length });
  return meetings.length;
}

/** Les jetons dynamiques ne vivent que quelques secondes : inutile de les conserver au-delà d'une journée. */
export async function purgeExpiredQrTokens(now = new Date()) {
  const { count } = await prisma.meetingQrToken.deleteMany({
    where: { type: "DYNAMIC", validUntil: { lt: new Date(now.getTime() - 24 * 3600_000) } },
  });
  if (count > 0) logger.info("job.qr_tokens_purge", { count });
  return count;
}

/** Comptes créés par les anciennes versions avec des mots de passe publiés dans la documentation. */
const LEGACY_ACCOUNTS = [
  { email: "admin@sodefor.ci", password: "Admin@Sodefor2026!" },
  { email: "gest@sodefor.ci", password: "Gest@Sodefor2026!" },
  { email: "secretaire@sodefor.ci", password: "Secretaire@2026!" },
  { email: "audit@sodefor.ci", password: "Audit@Sodefor2026!" },
];
const LEGACY_DEMO_TOKEN = "demo-comite-technique-sodefor-2026-token";

/**
 * En production (hors démonstration), un compte qui a encore son mot de passe public reçoit un mot de passe
 * aléatoire à changer : le super administrateur le lit dans les journaux du conteneur, les autres
 * comptes sont désactivés. Le jeton de démonstration est révoqué.
 */
export async function neutralizeLegacyCredentials() {
  if (process.env.NODE_ENV !== "production" || process.env.SEED_DEMO === "1") return;
  await prisma.meetingQrToken.updateMany({
    where: { publicToken: LEGACY_DEMO_TOKEN, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  for (const account of LEGACY_ACCOUNTS) {
    const user = await prisma.user.findUnique({ where: { email: account.email } });
    if (!user || !(await bcrypt.compare(account.password, user.passwordHash))) continue;
    const isAdmin = user.role === "SUPER_ADMIN";
    const password = generateTemporaryPassword();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, 12),
        passwordChangedAt: new Date(),
        mustChangePassword: true,
        sessionVersion: { increment: 1 },
        ...(isAdmin ? {} : { active: false }),
      },
    });
    await writeAudit({
      actorId: null,
      action: "user.legacy_credentials",
      entity: "User",
      entityId: user.id,
      afterData: { email: user.email, password: "mot de passe public remplacé", active: isAdmin },
    });
    if (isAdmin) {
      const file = await writeSecretFile("admin-temporary-password.txt", `${user.email} ${password}`);
      logger.warn("security.legacy_admin_password_replaced", {
        email: user.email,
        detail: file
          ? `Mot de passe par défaut publié : remplacé. Le mot de passe provisoire est dans ${file} (à lire puis supprimer).`
          : "Mot de passe par défaut publié : remplacé. Fichier provisoire impossible à écrire : réinitialisez le compte avec un autre super administrateur.",
      });
    } else {
      logger.warn("security.legacy_account_disabled", { email: user.email });
    }
  }
}

/**
 * Mises à niveau de données : le niveau de sécurité 4 n'existe plus (il n'apportait rien de plus que le 3),
 * et l'ancienne mention de confidentialité par défaut (incomplète) est remplacée si elle n'a pas été personnalisée.
 */
async function normalizeLegacyData() {
  await prisma.meeting.updateMany({ where: { qrSecurityLevel: { gt: 3 } }, data: { qrSecurityLevel: 3 } });
  // Mode et niveau incohérents (anciennes versions) : le mode fait foi, sinon la réunion n'est plus modifiable.
  await prisma.meeting.updateMany({ where: { qrMode: "DYNAMIC", qrSecurityLevel: { lt: 3 } }, data: { qrSecurityLevel: 3 } });
  await prisma.meeting.updateMany({ where: { qrMode: "STATIC", qrSecurityLevel: { gte: 3 } }, data: { qrSecurityLevel: 1 } });
  await prisma.meeting.updateMany({ where: { qrSecurityLevel: { lt: 1 } }, data: { qrSecurityLevel: 1 } });
  await prisma.organizationSetting.updateMany({
    where: { privacyNotice: { in: LEGACY_PRIVACY_NOTICES } },
    data: { privacyNotice: DEFAULT_PRIVACY_NOTICE },
  });
}

const globalForJobs = globalThis as unknown as { sodeforJobs?: boolean };
const timers: NodeJS.Timeout[] = [];

export function stopScheduler() {
  for (const timer of timers.splice(0)) clearTimeout(timer);
}

export function startScheduler() {
  if (globalForJobs.sodeforJobs || process.env.DISABLE_JOBS === "1") return;
  globalForJobs.sodeforJobs = true;

  const autoClose = () =>
    withLock("auto-close", 240, async () => {
      await autoCloseMeetings();
      const refreshed = await reconcileOfficialLists();
      if (refreshed > 0) logger.info("job.official_lists_reconciled", { refreshed });
    });
  const purge = () =>
    withLock("retention-purge", 3600, async () => {
      await purgeExpiredMeetings();
      await purgeExpiredQrTokens();
    });

  timers.push(
    setTimeout(() => {
      void withLock("startup", 60, async () => {
        await normalizeLegacyData();
        await neutralizeLegacyCredentials();
      });
      void autoClose();
      void purge();
    }, 15_000).unref(),
    setInterval(() => void autoClose(), AUTO_CLOSE_EVERY_MS).unref(),
    setInterval(() => void purge(), PURGE_EVERY_MS).unref(),
  );
  logger.info("jobs.started", { autoCloseMinutes: AUTO_CLOSE_EVERY_MS / 60_000, purgeHours: PURGE_EVERY_MS / 3600_000 });
}
