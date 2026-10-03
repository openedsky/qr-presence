-- AlterTable
ALTER TABLE `Meeting` ADD COLUMN `contentVersion` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `GeneratedDocument` ADD COLUMN `officialVersion` INTEGER NULL,
    ADD COLUMN `contentVersion` INTEGER NOT NULL DEFAULT 0;

-- Listes officielles existantes : une seule ligne par (réunion, version) reçoit le numéro unique.
UPDATE `GeneratedDocument` d
  JOIN (
    SELECT `meetingId`, `version`, MIN(`id`) AS `keepId`
    FROM `GeneratedDocument`
    WHERE `type` = 'LISTE_OFFICIELLE'
    GROUP BY `meetingId`, `version`
  ) k ON d.`id` = k.`keepId`
  SET d.`officialVersion` = d.`version`;

-- CreateIndex
CREATE UNIQUE INDEX `GeneratedDocument_meetingId_officialVersion_key` ON `GeneratedDocument`(`meetingId`, `officialVersion`);
CREATE INDEX `Meeting_startsAt_idx` ON `Meeting`(`startsAt`);
CREATE INDEX `Meeting_updatedAt_idx` ON `Meeting`(`updatedAt`);
CREATE INDEX `Meeting_createdById_startsAt_idx` ON `Meeting`(`createdById`, `startsAt`);
CREATE INDEX `Meeting_secretaryId_startsAt_idx` ON `Meeting`(`secretaryId`, `startsAt`);
CREATE INDEX `AuditLog_actorId_createdAt_idx` ON `AuditLog`(`actorId`, `createdAt`);
CREATE INDEX `AuditLog_entity_createdAt_idx` ON `AuditLog`(`entity`, `createdAt`);

-- DropIndex (les clés étrangères s'appuient désormais sur les index composés ci-dessus)
DROP INDEX `Meeting_createdById_idx` ON `Meeting`;
DROP INDEX `Meeting_secretaryId_idx` ON `Meeting`;
DROP INDEX `AuditLog_actorId_idx` ON `AuditLog`;
