/**
 * Second passage de la reprise : rattache aux présences migrées les images de signature de l'intranet.
 * L'ancienne base ne stocke que le nom du fichier (presence.signature) ; les images sont lues dans SIGNATURES_DIR
 * (dossier d'upload de l'intranet, sous-dossiers compris) puis copiées dans le stockage de l'application.
 *
 * Non destructif et rejouable : seules les présences migrées encore sans signature sont complétées.
 *
 * Usage (stockage S3 local du docker-compose) :
 *   DATABASE_URL="mysql://sodefor:sodefor@127.0.0.1:3307/sodefor_presences" \
 *   LEGACY_DATABASE_URL="mysql://root@127.0.0.1:3306/intranet_sodefor" \
 *   STORAGE_DRIVER=s3 S3_ENDPOINT=http://127.0.0.1:8333 S3_BUCKET=sodefor-presences \
 *   S3_ACCESS_KEY=... S3_SECRET_KEY=... SIGNATURES_DIR="D:/intranet/public/uploads/signatures" \
 *   npx tsx scripts/restore-legacy-signatures.ts            (ajouter DRY_RUN=1 pour un simple bilan)
 */
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";
import { readdir, readFile } from "fs/promises";
import { basename, extname, join } from "path";
import { imageWithinLimits, SIGNATURE_LIMITS } from "../src/lib/image-size";
import { meetingObjectKey, putObject } from "../src/lib/storage";

const FORMATS = [
  { mime: "image/png", extension: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", extension: "jpg", magic: [0xff, 0xd8, 0xff] },
] as const;

async function indexFiles(dir: string, index = new Map<string, string>()) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await indexFiles(path, index);
    else if (!index.has(entry.name.toLowerCase())) index.set(entry.name.toLowerCase(), path);
  }
  return index;
}

async function main() {
  const legacyUrl = process.env.LEGACY_DATABASE_URL;
  const dir = process.env.SIGNATURES_DIR;
  if (!legacyUrl || !dir) throw new Error("LEGACY_DATABASE_URL et SIGNATURES_DIR sont requis.");
  const dryRun = process.env.DRY_RUN === "1";

  const target = new PrismaClient();
  const legacy = new PrismaClient({ datasources: { db: { url: legacyUrl } } });
  try {
    const files = await indexFiles(dir);
    console.log(`${files.size} fichiers trouvés dans ${dir}`);

    const rows = await legacy.$queryRaw<{ id: number; signature: string | null }[]>`
      SELECT id, signature FROM presence WHERE signature IS NOT NULL AND signature <> ''
    `;
    const fileByPresence = new Map(rows.map((row) => [row.id, basename(String(row.signature).trim())]));

    const attendances = await target.attendance.findMany({
      where: { legacyPresenceId: { not: null }, signatureObjectKey: null },
      select: { id: true, legacyPresenceId: true, meetingId: true, meeting: { select: { uuid: true } } },
    });

    const stats = { restored: 0, noName: 0, missing: 0, invalid: 0, oversized: 0 };
    const missingSamples: string[] = [];
    const touchedMeetings = new Set<string>();

    for (const attendance of attendances) {
      const name = fileByPresence.get(attendance.legacyPresenceId as number);
      if (!name) {
        stats.noName++;
        continue;
      }
      const path = files.get(name.toLowerCase());
      if (!path) {
        stats.missing++;
        if (missingSamples.length < 10) missingSamples.push(name);
        continue;
      }
      const buffer = await readFile(path);
      const format = FORMATS.find((f) => f.magic.every((byte, i) => buffer[i] === byte));
      if (!format) {
        stats.invalid++;
        continue;
      }
      // Hors limites : conservée (preuve historique) mais ignorée à l'impression, comme une signature trop lourde.
      if (!imageWithinLimits(buffer, SIGNATURE_LIMITS)) stats.oversized++;
      if (dryRun) {
        stats.restored++;
        continue;
      }
      const stem = basename(name, extname(name)).replace(/[^A-Za-z0-9_-]/g, "") || "signature";
      const key = meetingObjectKey(
        attendance.meeting.uuid,
        "signatures",
        `legacy-${attendance.legacyPresenceId}-${stem}.${format.extension}`,
      );
      await putObject(key, buffer, format.mime);
      const updated = await target.attendance.updateMany({
        where: { id: attendance.id, signatureObjectKey: null },
        data: {
          signatureObjectKey: key,
          signatureHash: createHash("sha256").update(buffer).digest("hex"),
          signatureMime: format.mime,
          signatureSize: buffer.length,
        },
      });
      if (updated.count) {
        stats.restored++;
        touchedMeetings.add(attendance.meetingId);
      }
    }

    // Liste officielle déjà produite sans les signatures : elle sera régénérée à la prochaine consultation.
    if (touchedMeetings.size) {
      await target.meeting.updateMany({
        where: { id: { in: [...touchedMeetings] } },
        data: { contentVersion: { increment: 1 } },
      });
    }

    console.log(
      `${dryRun ? "[simulation] " : ""}Présences migrées sans signature : ${attendances.length}\n` +
        `  restaurées : ${stats.restored} (dont ${stats.oversized} trop grandes pour l'impression)\n` +
        `  sans nom de fichier dans l'intranet : ${stats.noName}\n` +
        `  fichier introuvable : ${stats.missing}${missingSamples.length ? ` (ex. ${missingSamples.join(", ")})` : ""}\n` +
        `  fichier non PNG/JPEG : ${stats.invalid}\n` +
        `  réunions concernées : ${touchedMeetings.size}`,
    );
  } finally {
    await legacy.$disconnect();
    await target.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
