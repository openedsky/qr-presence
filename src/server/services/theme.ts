import { getSettings } from "./settings";

const HEX = /^#[0-9a-fA-F]{6}$/;

function safe(value: string | undefined, fallback: string) {
  return value && HEX.test(value) ? value : fallback;
}

/** Couleurs personnalisées (valeurs contrôlées) ; vide si la base est indisponible : globals.css s'applique. */
export async function themeCss() {
  try {
    const settings = await getSettings();
    return `:root:root{--sand:${safe(settings.backgroundColor, "#f4f6f1")};--paper:${safe(settings.cardColor, "#ffffff")};--sidebar:${safe(settings.sidebarColor, "#0b3d24")};--primary:${safe(settings.primaryColor, "#14532d")};}`;
  } catch {
    return "";
  }
}
