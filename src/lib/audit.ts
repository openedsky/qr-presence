import { headers } from "next/headers";
import { prisma } from "./prisma";
import { hashIp, ipFromHeaders } from "./client-ip";

/** Hors requête HTTP (tâches planifiées), il n'y a ni IP ni navigateur à tracer. */
async function requestContext() {
  try {
    const headerList = await headers();
    const ip = ipFromHeaders(headerList);
    return { ip: ip === "unknown" ? null : ip, userAgent: headerList.get("user-agent") };
  } catch {
    return { ip: null, userAgent: "tâche planifiée" };
  }
}

function meetingIdOf(input: { entity: string; entityId: string; afterData?: unknown; meetingId?: string | null }) {
  if (input.meetingId !== undefined) return input.meetingId;
  if (input.entity === "Meeting") return input.entityId;
  const after = input.afterData;
  if (after && typeof after === "object" && "meetingId" in after && typeof after.meetingId === "string") {
    return after.meetingId;
  }
  return null;
}

export async function writeAudit(input: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
  meetingId?: string | null;
}) {
  const { ip, userAgent } = await requestContext();
  // Émargement public : le participant n'est pas un utilisateur ; ni IP brute ni navigateur dans le journal.
  const participant = !input.actorId && input.entity === "Attendance";
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? undefined,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      meetingId: meetingIdOf(input),
      beforeData: input.beforeData as object | undefined,
      afterData: input.afterData as object | undefined,
      ipAddress: participant ? (ip ? `h:${hashIp(ip).slice(0, 32)}` : null) : ip,
      userAgent: participant ? null : userAgent?.slice(0, 400),
    },
  });
}
