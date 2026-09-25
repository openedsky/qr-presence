import { cacheIncr } from "./redis";

export async function rateLimit(key: string, limit: number, windowSeconds = 60) {
  const count = await cacheIncr(`rl:${key}`, windowSeconds);
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    count,
  };
}

export function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
