import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";

export async function GET() {
  const checks: Record<string, string> = { app: "ok" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.mariadb = "ok";
  } catch {
    checks.mariadb = "down";
  }
  try {
    const redis = getRedis();
    if (!redis) checks.redis = "disabled";
    else {
      if (redis.status === "wait") await redis.connect();
      await redis.ping();
      checks.redis = "ok";
    }
  } catch {
    checks.redis = "down";
  }
  const healthy = checks.mariadb === "ok";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, time: new Date().toISOString() },
    { status: healthy ? 200 : 503 },
  );
}
