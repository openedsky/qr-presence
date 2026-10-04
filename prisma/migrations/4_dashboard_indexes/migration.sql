-- Agrégats du tableau de bord : l'index couvre la jointure sur la réunion (pas d'accès à la ligne).
CREATE INDEX `Attendance_status_checkInAt_meetingId_idx` ON `Attendance`(`status`, `checkInAt`, `meetingId`);
DROP INDEX `Attendance_status_checkInAt_idx` ON `Attendance`;

-- Purge périodique des échecs de connexion (filtre action + date).
CREATE INDEX `AuditLog_action_createdAt_idx` ON `AuditLog`(`action`, `createdAt`);
