import type { Instrumentation } from "next";

/** Tâches planifiées (clôture automatique, purge de conservation) : uniquement côté serveur Node.js. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkEnvironment } = await import("./server/env-check");
  checkEnvironment();
  const { startScheduler } = await import("./server/jobs");
  startScheduler();
}

/** Toute erreur serveur non gérée est journalisée en JSON (sans les en-têtes, qui peuvent contenir des cookies). */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logger } = await import("./lib/logger");
  logger.error("request.unhandled_error", {
    error: error instanceof Error ? error.message : String(error),
    digest: typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined,
    method: request.method,
    path: request.path.split("?")[0],
    route: context.routePath,
    type: context.routeType,
  });
};
