type Level = "info" | "warn" | "error";

function serialize(detail: unknown) {
  if (detail instanceof Error) return { error: detail.message, stack: detail.stack };
  if (detail && typeof detail === "object") return detail as Record<string, unknown>;
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
