import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { invalidateMemo, memo } from "@/lib/memo-cache";
import { getSettings } from "./settings";
import { imageDimensions, imageWithinLimits, LOGO_LIMITS } from "@/lib/image-size";

export type LogoMime = "image/png" | "image/jpeg";

export type Logo = {
  bytes: Buffer;
  mime: LogoMime;
  dataUrl: string;
  width: number;
  height: number;
  custom: boolean;
  /** URL versionnée (empreinte du contenu) : mise en cache par le navigateur au lieu d'une data URL dans chaque page. */
  url: string;
};

function logoUrl(bytes: Buffer) {
  return `/brand/logo?v=${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}`;
}

export const MAX_LOGO_BYTES = 1024 * 1024;
const DEFAULT_LOGO_PATH = path.join(process.cwd(), "public", "brand", "logo-sodefor.jpg");

/** Dimensions lues dans l'en-tête PNG (IHDR) ou JPEG (segment SOF), sous réserve que le type corresponde. */
export function imageSize(bytes: Buffer, mime: LogoMime): { width: number; height: number } | null {
  const png = bytes.length >= 4 && bytes.readUInt32BE(0) === 0x89504e47;
  if (png !== (mime === "image/png")) return null;
  return imageDimensions(bytes);
}

/** Décode et contrôle une data URL de logo (type réel vérifié via la signature du fichier). */
export function parseLogoDataUrl(dataUrl: string): { bytes: Buffer; mime: LogoMime; width: number; height: number } | { error: string } {
  const match = /^data:(image\/png|image\/jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return { error: "Format non pris en charge : utilisez une image PNG ou JPEG." };
  const mime = match[1] as LogoMime;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > MAX_LOGO_BYTES) return { error: "Le logo ne doit pas dépasser 1 Mo." };
  const size = imageSize(bytes, mime);
  if (!size || size.width < 32 || size.height < 32) return { error: "Image invalide ou trop petite (32 px minimum)." };
  if (!imageWithinLimits(bytes, LOGO_LIMITS)) {
    return { error: `Image trop grande : ${LOGO_LIMITS.maxSide} px de côté au maximum (2 mégapixels).` };
  }
  return { bytes, mime, ...size };
}

export async function defaultLogo(): Promise<Logo | null> {
  try {
    const bytes = await readFile(DEFAULT_LOGO_PATH);
    const size = imageSize(bytes, "image/jpeg");
    if (!size) return null;
    return {
      bytes,
      mime: "image/jpeg",
      dataUrl: `data:image/jpeg;base64,${bytes.toString("base64")}`,
      ...size,
      custom: false,
      url: logoUrl(bytes),
    };
  } catch {
    return null;
  }
}

export function getLogo(): Promise<Logo | null> {
  return memo("branding:logo", 60_000, async () => {
    const settings = await getSettings();
    const row = await prisma.organizationSetting.findUnique({ where: { id: settings.id }, select: { logoData: true } });
    if (row?.logoData) {
      const parsed = parseLogoDataUrl(row.logoData);
      if (!("error" in parsed)) return { ...parsed, dataUrl: row.logoData, custom: true, url: logoUrl(parsed.bytes) };
    }
    return defaultLogo();
  });
}

export function invalidateBranding() {
  invalidateMemo("branding:");
}

/** Logo à incruster au centre des QR codes, ou null si l'option est désactivée. */
export async function getQrLogo(): Promise<Logo | null> {
  const settings = await getSettings();
  return settings.qrLogoEnabled ? getLogo() : null;
}