import { prisma } from "@/lib/prisma";
import { DEFAULT_PRIVACY_NOTICE } from "@/lib/privacy-notice";
import { invalidateMemo, memo } from "@/lib/memo-cache";

const SETTINGS_TTL_MS = 30_000;

/** Paramètres sans le logo (volumineux) : lus à chaque page, notamment pour le thème. */
export function getSettings() {
  return memo("settings", SETTINGS_TTL_MS, async () => {
    const existing = await prisma.organizationSetting.findFirst({ omit: { logoData: true } });
    if (existing) return existing;
    return prisma.organizationSetting.create({
      data: { privacyNotice: DEFAULT_PRIVACY_NOTICE },
      omit: { logoData: true },
    });
  });
}

export function invalidateSettings() {
  invalidateMemo("settings");
}
