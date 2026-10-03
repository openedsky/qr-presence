-- Exécuté avant `prisma db push` : conversions sans perte que Prisma signalerait comme risquées.
-- Meeting.type : ENUM -> VARCHAR (les types de réunion sont désormais paramétrables).
ALTER TABLE `Meeting` MODIFY `type` VARCHAR(40) NOT NULL DEFAULT 'COMITE';
