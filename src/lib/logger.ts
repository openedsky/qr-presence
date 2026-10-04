type Level = "info" | "warn" | "error";

/**
 * Erreur réduite au nom, au code, à la première ligne du message et aux cadres de pile : les erreurs Prisma
 * reproduisent les arguments de l'appel (nom, email, téléphone des participants) dans la suite du message.
 */
export function sanitizeError(error: Error) {
  const firstLine = error.message.split("\n").find((line) => line.trim()) ?? "";
  const frames = (error.stack ?? "")
    .split("\n")
    .filter((line) => line.trimStart().startsWith("at "))
    .slice(0, 8)
    .join("\n");
  const code = (error as { code?: unknown }).code;
  return {
    error: firstLine.trim().slice(0, 300),
    errorName: error.name,
    ...(typeof code === "string" ? { code } : {}),
    ...(frames ? { stack: frames } : {}),
  };
}

function serialize(detail: unknown) {
  if (detail instanceof Error) return sanitizeError(detail);
  if (detail && typeof detail === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(detail)) {
      out[key] = value instanceof Error ? sanitizeError(value) : value;
    }
    return out;
  }
  return detail === undefined ? {} : { detail };
}

/** Journal JSON sur une ligne : exploitable par docker logs, Loki ou tout collecteur. */
function write(level: Level, event: string, detail?: unknown) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...serialize(detail) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (event: string, detail?: unknown) => write("info", event, detail),
  warn: (event: string, detail?: unknown) => write("warn", event, detail),
  error: (event: string, detail?: unknown) => write("error", event, detail),
};
