import { logger } from "@/lib/logger";

/**
 * Contrôle de la configuration au démarrage. Les erreurs bloquantes arrêtent le serveur en production
 * (mieux vaut un conteneur qui redémarre qu'une application qui génère des liens vers localhost).
 */
export function checkEnvironment() {
  const production = process.env.NODE_ENV === "production";
  const errors: string[] = [];
  const warnings: string[] = [];

  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32) errors.push("AUTH_SECRET absent ou trop court (32 caractères minimum).");
  if (!process.env.DATABASE_URL) errors.push("DATABASE_URL absent.");

  const appUrl = process.env.APP_URL ?? "";
  try {
    const url = new URL(appUrl);
    if (production && /^(localhost|127\.0\.0\.1)$/.test(url.hostname)) {
      warnings.push("APP_URL pointe vers localhost : les QR codes et liens de vérification seront inutilisables hors de ce poste.");
    }
  } catch {
    errors.push("APP_URL absent ou invalide (URL publique de l'application, ex. https://presences.sodefor.ci).");
  }

  const hops = process.env.TRUSTED_PROXY_HOPS;
  if (hops !== undefined && !(Number(hops) >= 1)) {
    warnings.push(
      "TRUSTED_PROXY_HOPS doit valoir au moins 1 : l'application doit être placée derrière un reverse proxy qui ajoute l'adresse du client à X-Forwarded-For. Exposée directement, l'adresse IP est falsifiable et les limites par IP sont contournables.",
    );
  }
  if (production && !process.env.REDIS_URL) {
    warnings.push("REDIS_URL absent : limites, verrous et usage unique des QR ne sont pas partagés entre instances.");
  }
  if (process.env.STORAGE_DRIVER === "s3") {
    const missing = ["S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"].filter((name) => !process.env[name]);
    if (missing.length) errors.push(`STORAGE_DRIVER=s3 mais ${missing.join(", ")} absent(s).`);
  } else if (production) {
    warnings.push("Stockage local (STORAGE_DRIVER≠s3) : signatures et PDF restent dans le conteneur, à monter sur un volume sauvegardé.");
  }

  for (const message of warnings) logger.warn("config.warning", { message });
  for (const message of errors) logger.error("config.error", { message });
  if (production && errors.length > 0 && process.env.SKIP_ENV_CHECK !== "1") {
    throw new Error(`Configuration invalide : ${errors.join(" ")}`);
  }
}
