import { headers } from "next/headers";
import { prisma } from "./prisma";

export async function writeAudit(input: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
}) {
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    null;
  const userAgent = headerList.get("user-agent");

  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? undefined,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      beforeData: input.beforeData as object | undefined,
      afterData: input.afterData as object | undefined,
      ipAddress: ip,
      userAgent,
    },
  });
}
