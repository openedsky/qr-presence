import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";
import { memo } from "@/lib/memo-cache";
import { safeEqual } from "@/lib/tokens";
import { checkStorage } from "@/lib/storage";

/** Résultat mutualisé quelques secondes : des appels en rafale ne se traduisent pas en requêtes sur la base. */
function runChecks() {
  return memo("health", 5_000, async () => {
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
    checks.storage = await checkStorage();
    return checks;
  });
}

/** Public : seulement l'état global. Le détail (?details=1) exige HEALTH_TOKEN en en-tête Authorization. */
export async function GET(request: Request) {
  const checks = await runChecks();
  // Seule la base conditionne le 503 (le conteneur redémarrerait sans rien réparer) ; stockage ou Redis en panne → « degraded ».
  const healthy = checks.mariadb === "ok";
  const status = healthy && checks.storage === "ok" && checks.redis !== "down" ? "ok" : "degraded";
  const token = process.env.HEALTH_TOKEN;
  const detailed =
    Boolean(token) &&
    new URL(request.url).searchParams.get("details") === "1" &&
    safeEqual(request.headers.get("authorization") ?? "", `Bearer ${token}`);
  return NextResponse.json(
    detailed ? { status, checks } : { status },
    { status: healthy ? 200 : 503 },
  );
}
