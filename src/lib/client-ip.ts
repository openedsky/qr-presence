import { createHmac } from "crypto";

/**
 * Le client peut forger X-Forwarded-For ; chaque proxy de confiance (Traefik/Dokploy) ajoute
 * l'adresse vue à droite. On lit donc l'entrée placée par le proxy le plus proche de l'application.
 * TRUSTED_PROXY_HOPS = nombre de proxys devant l'application (1 par défaut).
 */
export function ipFromHeaders(headers: Headers) {
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? "1") || 1);
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (chain.length > 0) return chain[Math.max(0, chain.length - hops)];
  return headers.get("x-real-ip") || "unknown";
}

/** Empreinte d'IP à clé secrète : non réversible par dictionnaire des 4 milliards d'adresses IPv4. */
export function hashIp(ip: string) {
  const secret = process.env.AUTH_SECRET || "dev-only-secret";
  return createHmac("sha256", secret).update(`ip:${ip}`).digest("hex");
}
