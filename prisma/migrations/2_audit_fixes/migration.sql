-- AlterTable
ALTER TABLE `User` ADD COLUMN `lastFailedLoginAt` DATETIME(3) NULL,
    ADD COLUMN `passwordChangedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Meeting` ADD COLUMN `reopenedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `AuditLog` ADD COLUMN `meetingId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Attendance_signatureObjectKey_idx` ON `Attendance`(`signatureObjectKey`);
CREATE INDEX `Attendance_status_checkInAt_idx` ON `Attendance`(`status`, `checkInAt`);
CREATE INDEX `MeetingQrToken_type_validUntil_idx` ON `MeetingQrToken`(`type`, `validUntil`);
CREATE INDEX `AuditLog_meetingId_createdAt_idx` ON `AuditLog`(`meetingId`, `createdAt`);
CREATE INDEX `GeneratedDocument_objectKey_idx` ON `GeneratedDocument`(`objectKey`);

-- Rattachement des entrées existantes du journal à leur réunion.
UPDATE `AuditLog` SET `meetingId` = `entityId` WHERE `entity` = 'Meeting';
UPDATE `AuditLog` a JOIN `Attendance` t ON a.`entity` = 'Attendance' AND a.`entityId` = t.`id`
  SET a.`meetingId` = t.`meetingId` WHERE a.`meetingId` IS NULL;
UPDATE `AuditLog` a JOIN `GeneratedDocument` d ON a.`entity` = 'GeneratedDocument' AND a.`entityId` = d.`id`
  SET a.`meetingId` = d.`meetingId` WHERE a.`meetingId` IS NULL;

-- Émargements publics : l'adresse IP et le navigateur bruts ne sont plus conservés dans le journal
-- (l'empreinte d'IP à clé secrète reste sur la présence).
UPDATE `AuditLog` SET `ipAddress` = NULL, `userAgent` = NULL WHERE `entity` = 'Attendance' AND `actorId` IS NULL;

-- Les mots de passe provisoires en cours disposent de 7 jours à compter de la mise à jour.
UPDATE `User` SET `passwordChangedAt` = NOW(3);
