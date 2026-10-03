-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `uuid` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `jobTitle` VARCHAR(191) NULL,
    `organization` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `role` ENUM('SUPER_ADMIN', 'MEETING_ADMIN', 'ORGANIZER', 'SECRETARY', 'AUDITOR', 'USER') NOT NULL DEFAULT 'USER',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    `sessionVersion` INTEGER NOT NULL DEFAULT 0,
    `failedLoginCount` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `legacyUserId` INTEGER NULL,

    UNIQUE INDEX `User_uuid_key`(`uuid`),
    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordReset` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordReset_tokenHash_key`(`tokenHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrganizationSetting` (
    `id` VARCHAR(191) NOT NULL,
    `organizationName` VARCHAR(191) NOT NULL DEFAULT 'SODEFOR',
    `ministryName` VARCHAR(191) NOT NULL DEFAULT 'Ministère des Eaux et Forêts',
    `appName` VARCHAR(191) NOT NULL DEFAULT 'SODEFOR Présences',
    `appTagline` VARCHAR(191) NOT NULL DEFAULT 'Gestion intelligente des réunions et présences',
    `publicBaseUrl` VARCHAR(191) NOT NULL DEFAULT 'https://presence.sodefor.ci',
    `retentionMonths` INTEGER NOT NULL DEFAULT 60,
    `emailRequiredDefault` BOOLEAN NOT NULL DEFAULT true,
    `signatureRequiredDefault` BOOLEAN NOT NULL DEFAULT true,
    `dynamicQrSeconds` INTEGER NOT NULL DEFAULT 45,
    `rateLimitPerMinute` INTEGER NOT NULL DEFAULT 20,
    `privacyNotice` TEXT NOT NULL,
    `backgroundColor` VARCHAR(191) NOT NULL DEFAULT '#f4f6f1',
    `cardColor` VARCHAR(191) NOT NULL DEFAULT '#ffffff',
    `sidebarColor` VARCHAR(191) NOT NULL DEFAULT '#0b3d24',
    `primaryColor` VARCHAR(191) NOT NULL DEFAULT '#14532d',
    `logoData` MEDIUMTEXT NULL,
    `qrLogoEnabled` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MeetingTypeOption` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#14532d',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MeetingTypeOption_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PdfTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(40) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `subtitle` VARCHAR(191) NULL,
    `headerNote` VARCHAR(191) NULL,
    `footerText` TEXT NULL,
    `accentColor` VARCHAR(191) NOT NULL DEFAULT '#14532d',
    `options` JSON NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedById` VARCHAR(191) NULL,

    UNIQUE INDEX `PdfTemplate_kind_key`(`kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Meeting` (
    `id` VARCHAR(191) NOT NULL,
    `uuid` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `internalRef` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `type` VARCHAR(40) NOT NULL DEFAULT 'COMITE',
    `location` VARCHAR(191) NULL,
    `videoConferenceUrl` VARCHAR(191) NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NULL,
    `registrationOpensAt` DATETIME(3) NULL,
    `registrationClosesAt` DATETIME(3) NULL,
    `toleranceMinutes` INTEGER NOT NULL DEFAULT 15,
    `status` ENUM('BROUILLON', 'PLANIFIEE', 'OUVERTE', 'EN_COURS', 'CLOTUREE', 'ARCHIVEE') NOT NULL DEFAULT 'BROUILLON',
    `qrMode` ENUM('STATIC', 'DYNAMIC') NOT NULL DEFAULT 'STATIC',
    `qrSecurityLevel` INTEGER NOT NULL DEFAULT 1,
    `allowGuests` BOOLEAN NOT NULL DEFAULT true,
    `showPublicAttendance` BOOLEAN NOT NULL DEFAULT false,
    `expectedParticipants` INTEGER NULL,
    `signatureRequired` BOOLEAN NOT NULL DEFAULT true,
    `emailRequired` BOOLEAN NOT NULL DEFAULT true,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `internalNotes` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `secretaryId` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `closedAt` DATETIME(3) NULL,
    `closedById` VARCHAR(191) NULL,
    `autoClosed` BOOLEAN NOT NULL DEFAULT false,
    `purgedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `legacyPublicationId` INTEGER NULL,
    `legacySha1` VARCHAR(191) NULL,
    `legacySha2` VARCHAR(191) NULL,

    UNIQUE INDEX `Meeting_uuid_key`(`uuid`),
    UNIQUE INDEX `Meeting_internalRef_key`(`internalRef`),
    UNIQUE INDEX `Meeting_slug_key`(`slug`),
    INDEX `Meeting_status_startsAt_idx`(`status`, `startsAt`),
    INDEX `Meeting_createdById_idx`(`createdById`),
    INDEX `Meeting_secretaryId_idx`(`secretaryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExpectedGuest` (
    `id` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `firstNames` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `organization` VARCHAR(191) NULL,
    `jobTitle` VARCHAR(191) NULL,
    `present` BOOLEAN NOT NULL DEFAULT false,

    INDEX `ExpectedGuest_meetingId_idx`(`meetingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attendance` (
    `id` VARCHAR(191) NOT NULL,
    `uuid` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `civility` ENUM('M', 'MME', 'MLLE') NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `firstNames` VARCHAR(191) NOT NULL,
    `gender` ENUM('M', 'F') NOT NULL,
    `jobTitle` VARCHAR(191) NOT NULL,
    `organization` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `emailNormalized` VARCHAR(191) NULL,
    `phoneNormalized` VARCHAR(191) NULL,
    `nameKey` VARCHAR(191) NOT NULL,
    `activeEmailKey` VARCHAR(191) NULL,
    `activePhoneKey` VARCHAR(191) NULL,
    `activeNameKey` VARCHAR(191) NULL,
    `activeUserKey` VARCHAR(191) NULL,
    `suspectedDuplicate` BOOLEAN NOT NULL DEFAULT false,
    `signatureObjectKey` VARCHAR(191) NULL,
    `signatureHash` VARCHAR(191) NULL,
    `signatureMime` VARCHAR(191) NULL,
    `signatureSize` INTEGER NULL,
    `checkInAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `checkInMethod` ENUM('QR_CODE', 'ADMIN_MANUAL', 'KIOSK') NOT NULL DEFAULT 'QR_CODE',
    `publicListConsent` BOOLEAN NOT NULL DEFAULT false,
    `manualReason` TEXT NULL,
    `status` ENUM('ACTIVE', 'ANNULEE') NOT NULL DEFAULT 'ACTIVE',
    `cancelledAt` DATETIME(3) NULL,
    `cancelledById` VARCHAR(191) NULL,
    `cancelReason` VARCHAR(191) NULL,
    `ipHash` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `confirmationCode` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `legacyPresenceId` INTEGER NULL,

    UNIQUE INDEX `Attendance_uuid_key`(`uuid`),
    UNIQUE INDEX `Attendance_confirmationCode_key`(`confirmationCode`),
    INDEX `Attendance_meetingId_status_idx`(`meetingId`, `status`),
    INDEX `Attendance_meetingId_emailNormalized_idx`(`meetingId`, `emailNormalized`),
    INDEX `Attendance_meetingId_phoneNormalized_idx`(`meetingId`, `phoneNormalized`),
    INDEX `Attendance_meetingId_nameKey_idx`(`meetingId`, `nameKey`),
    INDEX `Attendance_meetingId_userId_idx`(`meetingId`, `userId`),
    INDEX `Attendance_meetingId_activeNameKey_idx`(`meetingId`, `activeNameKey`),
    UNIQUE INDEX `Attendance_meetingId_activeEmailKey_key`(`meetingId`, `activeEmailKey`),
    UNIQUE INDEX `Attendance_meetingId_activePhoneKey_key`(`meetingId`, `activePhoneKey`),
    UNIQUE INDEX `Attendance_meetingId_activeUserKey_key`(`meetingId`, `activeUserKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceChange` (
    `id` VARCHAR(191) NOT NULL,
    `attendanceId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `field` VARCHAR(191) NOT NULL,
    `oldValue` TEXT NULL,
    `newValue` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MeetingQrToken` (
    `id` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `publicToken` VARCHAR(191) NULL,
    `tokenHint` VARCHAR(191) NOT NULL,
    `type` ENUM('STATIC', 'DYNAMIC') NOT NULL,
    `validFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validUntil` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MeetingQrToken_tokenHash_key`(`tokenHash`),
    UNIQUE INDEX `MeetingQrToken_publicToken_key`(`publicToken`),
    INDEX `MeetingQrToken_meetingId_type_idx`(`meetingId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `beforeData` JSON NULL,
    `afterData` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    INDEX `AuditLog_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeneratedDocument` (
    `id` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NOT NULL,
    `type` ENUM('QR_POSTER', 'LISTE_PROVISOIRE', 'LISTE_OFFICIELLE', 'LISTE_PUBLIQUE', 'STATISTIQUES') NOT NULL,
    `uuid` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `objectKey` VARCHAR(191) NOT NULL,
    `sha256` VARCHAR(191) NOT NULL,
    `generatedById` VARCHAR(191) NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `participantCount` INTEGER NULL,
    `correctionNote` TEXT NULL,
    `supersededAt` DATETIME(3) NULL,

    UNIQUE INDEX `GeneratedDocument_uuid_key`(`uuid`),
    INDEX `GeneratedDocument_meetingId_type_idx`(`meetingId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Structure` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `internal` BOOLEAN NOT NULL DEFAULT true,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Structure_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PasswordReset` ADD CONSTRAINT `PasswordReset_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meeting` ADD CONSTRAINT `Meeting_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meeting` ADD CONSTRAINT `Meeting_secretaryId_fkey` FOREIGN KEY (`secretaryId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meeting` ADD CONSTRAINT `Meeting_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meeting` ADD CONSTRAINT `Meeting_closedById_fkey` FOREIGN KEY (`closedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExpectedGuest` ADD CONSTRAINT `ExpectedGuest_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceChange` ADD CONSTRAINT `AttendanceChange_attendanceId_fkey` FOREIGN KEY (`attendanceId`) REFERENCES `Attendance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MeetingQrToken` ADD CONSTRAINT `MeetingQrToken_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedDocument` ADD CONSTRAINT `GeneratedDocument_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedDocument` ADD CONSTRAINT `GeneratedDocument_generatedById_fkey` FOREIGN KEY (`generatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
