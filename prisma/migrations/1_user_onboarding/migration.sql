-- AlterTable
ALTER TABLE `User` ADD COLUMN `onboardingCompletedAt` DATETIME(3) NULL;

-- Les comptes déjà utilisés ne se voient pas imposer la visite guidée (elle reste accessible depuis le menu).
UPDATE `User` SET `onboardingCompletedAt` = NOW(3) WHERE `lastLoginAt` IS NOT NULL;
