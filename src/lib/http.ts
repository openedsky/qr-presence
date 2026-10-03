export class PayloadTooLargeError extends Error {
  constructor() {
    super("Requête trop volumineuse.");
    this.name = "PayloadTooLargeError";
  }
}

/** Lit un corps JSON en s'arrêtant dès que la taille maximale est dépassée (Content-Length absent ou mensonger). */
export async function readJsonLimited(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new PayloadTooLargeError();
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new PayloadTooLargeError();
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

/** Corps JSON des formulaires d'administration : null si absent, invalide ou trop volumineux (→ 400). */
export async function readJsonBody(request: Request, maxBytes = 64 * 1024): Promise<unknown> {
  try {
    return await readJsonLimited(request, maxBytes);
  } catch {
    return null;
  }
}

/** Nom de fichier sûr pour Content-Disposition (ASCII, sans guillemets ni séparateurs). */
export function safeFilename(value: string, fallback = "document") {
  const cleaned = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return cleaned || fallback;
}
