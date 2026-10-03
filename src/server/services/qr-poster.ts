import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { Meeting } from "@prisma/client";
import { getSettings } from "./settings";
import { getTemplate, hexToRgb01, type ResolvedTemplate } from "./pdf-templates";
import { getQrLogo } from "./branding";
import { qrLogoLayout } from "@/lib/qr-logo";

const A4: [number, number] = [595.28, 841.89];
const FOREST = rgb(0.078, 0.325, 0.176);
const FOREST_DEEP = rgb(0.043, 0.239, 0.141);
const MINT = rgb(0.906, 0.953, 0.918);
const GOLD = rgb(0.949, 0.757, 0.306);
const INK = rgb(0.11, 0.14, 0.12);
const MUTED = rgb(0.36, 0.4, 0.365);
const WHITE = rgb(1, 1, 1);

const TIME_ZONE = process.env.TZ_DISPLAY || "Africa/Abidjan";

/** Standard PDF fonts only cover WinAnsi: drop anything else to avoid encoding errors. */
function winAnsi(value: string) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF\u2013\u2014\u2026\u20AC\u0152\u0153]/g, "");
}

function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  return [
    `M ${x + r} ${y}`,
    `H ${x + w - r}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `V ${y + h - r}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `H ${x + r}`,
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    "Z",
  ].join(" ");
}

const FINDERS = [
  [8, 8],
  [40, 8],
  [8, 40],
] as const;

const MODULES = [
  [28, 8], [32, 14], [28, 20], [34, 22],
  [8, 28], [14, 32], [20, 28], [22, 34],
  [28, 28], [34, 30], [30, 36], [40, 28],
  [46, 32], [52, 28], [28, 44], [34, 50],
  [28, 52], [40, 38], [52, 38],
] as const;

/** Draws the application QR mark (same geometry as the web logo), top-left corner at (x, top). */
function drawQrMark(page: PDFPage, x: number, top: number, size: number) {
  const scale = size / 64;
  const opts = { x, y: top, scale };
  page.drawSvgPath(roundedRect(0, 0, 64, 64, 14), { ...opts, color: FOREST });
  for (const [fx, fy] of FINDERS) {
    page.drawSvgPath(roundedRect(fx, fy, 16, 16, 4), { ...opts, color: WHITE });
    page.drawSvgPath(roundedRect(fx + 3, fy + 3, 10, 10, 2.5), { ...opts, color: FOREST });
    page.drawSvgPath(roundedRect(fx + 5, fy + 5, 6, 6, 1.5), { ...opts, color: WHITE });
  }
  for (const [mx, my] of MODULES) {
    page.drawSvgPath(roundedRect(mx, my, 4.5, 4.5, 1.2), { ...opts, color: WHITE });
  }
  page.drawSvgPath(roundedRect(42, 44, 14, 12, 3), { ...opts, color: GOLD });
  page.drawSvgPath("M 45.5 50.2 L 48.1 52.8 L 52.7 47.8", {
    ...opts,
    borderColor: FOREST_DEEP,
    borderWidth: 2,
  });
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function centered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (A4[0] - width) / 2, y, size, font, color });
}

function fitSize(text: string, font: PDFFont, maxSize: number, minSize: number, maxWidth: number) {
  let size = maxSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  return size;
}

export function formatPosterDate(date: Date) {
  const day = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(date);
  const time = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(date);
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} à ${time.replace(":", "h")}`;
}

export async function buildQrPoster(meeting: Meeting, url: string, templateOverride?: ResolvedTemplate) {
  const [settings, logo] = await Promise.all([getSettings(), getQrLogo()]);
  const template = templateOverride ?? (await getTemplate("QR_POSTER"));
  const ACCENT = rgb(...hexToRgb01(template.accentColor));
  const pdf = await PDFDocument.create();
  pdf.setTitle(winAnsi(`QR Code — ${meeting.title}`));
  pdf.setAuthor(winAnsi(settings.organizationName));
  pdf.setSubject("Affiche d'émargement par QR code");
  pdf.setCreator("SODEFOR Présences");

  const page = pdf.addPage(A4);
  const [W, H] = A4;
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 42;

  // En-tête institutionnel : fond blanc uniquement (impression économique et lisible).
  const logoSize = 58;
  const logoTop = H - 30;
  drawQrMark(page, margin, logoTop, logoSize);

  const textX = margin + logoSize + 14;
  page.drawText(winAnsi(settings.organizationName.toUpperCase()), { x: textX, y: H - 57, size: 22, font: bold, color: FOREST_DEEP });
  if (template.subtitle) {
    page.drawText(winAnsi(template.subtitle), { x: textX, y: H - 73, size: 9.5, font, color: MUTED });
  }

  const ministry = winAnsi(settings.ministryName.toUpperCase());
  const ministryLines = wrap(ministry, bold, 9, 190);
  ministryLines.forEach((line, i) => {
    const width = bold.widthOfTextAtSize(line, 9);
    page.drawText(line, { x: W - margin - width, y: H - 50 - i * 12, size: 9, font: bold, color: ACCENT });
  });
  if (template.headerNote) {
    const note = winAnsi(template.headerNote);
    page.drawText(note, {
      x: W - margin - font.widthOfTextAtSize(note, 8.5),
      y: H - 54 - ministryLines.length * 12,
      size: 8.5,
      font,
      color: MUTED,
    });
  }
  page.drawLine({ start: { x: margin, y: H - 104 }, end: { x: W - margin, y: H - 104 }, thickness: 1.2, color: ACCENT });
  page.drawLine({ start: { x: margin, y: H - 107 }, end: { x: margin + 90, y: H - 107 }, thickness: 2.5, color: GOLD });

  // Objet, lieu, date
  let y = H - 158;
  const eyebrow = winAnsi(template.title.toUpperCase());
  centered(page, eyebrow, y, bold, 11, ACCENT);
  const eyebrowWidth = bold.widthOfTextAtSize(eyebrow, 11);
  page.drawLine({
    start: { x: (W - eyebrowWidth) / 2 - 40, y: y + 4 },
    end: { x: (W - eyebrowWidth) / 2 - 10, y: y + 4 },
    thickness: 1.2,
    color: GOLD,
  });
  page.drawLine({
    start: { x: (W + eyebrowWidth) / 2 + 10, y: y + 4 },
    end: { x: (W + eyebrowWidth) / 2 + 40, y: y + 4 },
    thickness: 1.2,
    color: GOLD,
  });

  y -= 36;
  const title = winAnsi(meeting.title.toUpperCase());
  const titleSize = title.length > 60 ? 15 : 18;
  const titleLines = wrap(title, bold, titleSize, W - margin * 2).slice(0, 3);
  for (const line of titleLines) {
    centered(page, line, y, bold, titleSize, FOREST_DEEP);
    y -= titleSize + 6;
  }

  y -= 8;
  const location = winAnsi(meeting.location || (meeting.videoConferenceUrl ? "Réunion à distance" : "—"));
  const when = winAnsi(formatPosterDate(meeting.startsAt));
  const infoWidth = W - margin * 2 - 40;
  const boxHeight = 58;
  page.drawSvgPath(roundedRect(0, 0, infoWidth, boxHeight, 12), { x: (W - infoWidth) / 2, y, color: MINT });
  const colW = infoWidth / 2;
  const boxX = (W - infoWidth) / 2;
  const cols: [string, string][] = [
    ["LIEU", location],
    ["DATE", when],
  ];
  cols.forEach(([label, value], i) => {
    const cx = boxX + colW * i + colW / 2;
    const labelW = bold.widthOfTextAtSize(label, 8);
    page.drawText(label, { x: cx - labelW / 2, y: y - 20, size: 8, font: bold, color: MUTED });
    const size = fitSize(value, bold, 12.5, 8, colW - 24);
    const vw = bold.widthOfTextAtSize(value, size);
    page.drawText(value, { x: cx - vw / 2, y: y - 40, size, font: bold, color: INK });
  });
  page.drawLine({
    start: { x: boxX + colW, y: y - 12 },
    end: { x: boxX + colW, y: y - boxHeight + 12 },
    thickness: 0.8,
    color: rgb(0.78, 0.86, 0.8),
  });
  y -= boxHeight + 26;

  // QR code
  const qrPng = await QRCode.toBuffer(url, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 1200,
    color: { dark: "#0b3d24", light: "#ffffff" },
  });
  const qrImage = await pdf.embedPng(qrPng);
  // QR réduit de 30 % par rapport au format d'origine ; l'espace libéré est réparti autour.
  const fullSize = Math.min(290, y - 230);
  const qrSize = Math.round(fullSize * 0.56);
  const spare = fullSize - qrSize;
  y -= spare * 0.35;
  const frame = qrSize + 28;
  const frameX = (W - frame) / 2;
  page.drawSvgPath(roundedRect(0, 0, frame, frame, 22), {
    x: frameX,
    y,
    color: WHITE,
    borderColor: ACCENT,
    borderWidth: 2.5,
  });
  const corner = 26;
  const cornerStroke = { thickness: 5, color: GOLD };
  const fx0 = frameX - 8;
  const fy0 = y + 8;
  const fx1 = frameX + frame + 8;
  const fy1 = y - frame - 8;
  page.drawLine({ start: { x: fx0, y: fy0 }, end: { x: fx0 + corner, y: fy0 }, ...cornerStroke });
  page.drawLine({ start: { x: fx0, y: fy0 }, end: { x: fx0, y: fy0 - corner }, ...cornerStroke });
  page.drawLine({ start: { x: fx1, y: fy0 }, end: { x: fx1 - corner, y: fy0 }, ...cornerStroke });
  page.drawLine({ start: { x: fx1, y: fy0 }, end: { x: fx1, y: fy0 - corner }, ...cornerStroke });
  page.drawLine({ start: { x: fx0, y: fy1 }, end: { x: fx0 + corner, y: fy1 }, ...cornerStroke });
  page.drawLine({ start: { x: fx0, y: fy1 }, end: { x: fx0, y: fy1 + corner }, ...cornerStroke });
  page.drawLine({ start: { x: fx1, y: fy1 }, end: { x: fx1 - corner, y: fy1 }, ...cornerStroke });
  page.drawLine({ start: { x: fx1, y: fy1 }, end: { x: fx1, y: fy1 + corner }, ...cornerStroke });
  page.drawImage(qrImage, { x: frameX + 14, y: y - 14 - qrSize, width: qrSize, height: qrSize });
  if (logo) {
    const layout = qrLogoLayout(logo.width, logo.height);
    const centerX = frameX + 14 + qrSize / 2;
    const centerY = y - 14 - qrSize / 2;
    const badgeW = layout.badgeW * qrSize;
    const badgeH = layout.badgeH * qrSize;
    const radius = Math.min(badgeW, badgeH) * 0.2;
    page.drawSvgPath(roundedRect(0, 0, badgeW + 3, badgeH + 3, radius + 1.5), {
      x: centerX - (badgeW + 3) / 2,
      y: centerY + (badgeH + 3) / 2 - 1,
      color: rgb(0.85, 0.89, 0.86),
    });
    page.drawSvgPath(roundedRect(0, 0, badgeW, badgeH, radius), {
      x: centerX - badgeW / 2,
      y: centerY + badgeH / 2,
      color: WHITE,
    });
    const logoImage = logo.mime === "image/png" ? await pdf.embedPng(logo.bytes) : await pdf.embedJpg(logo.bytes);
    const logoW = layout.logoW * qrSize;
    const logoH = layout.logoH * qrSize;
    page.drawImage(logoImage, { x: centerX - logoW / 2, y: centerY - logoH / 2, width: logoW, height: logoH });
  }
  y -= frame + 42 + spare * 0.3;

  // Appel à l'action
  const cta = winAnsi(template.ctaText.toUpperCase());
  const ctaSize = fitSize(cta, bold, 21, 14, W - margin * 2 - 40);
  const ctaW = bold.widthOfTextAtSize(cta, ctaSize) + 48;
  page.drawSvgPath(roundedRect(0, 0, ctaW, ctaSize + 22, (ctaSize + 22) / 2), {
    x: (W - ctaW) / 2,
    y: y + ctaSize + 4,
    color: ACCENT,
  });
  centered(page, cta, y - 2, bold, ctaSize, WHITE);
  y -= 38;

  const steps = template.steps.filter(Boolean);
  const stepW = (W - margin * 2) / Math.max(1, steps.length);
  steps.forEach((step, i) => {
    const text = winAnsi(step);
    const tw = font.widthOfTextAtSize(text, 10.5);
    page.drawText(text, { x: margin + stepW * i + (stepW - tw) / 2, y, size: 10.5, font, color: INK });
  });
  y -= 26;

  if (template.showUrl) {
    const shownUrl = winAnsi(url);
    const urlSize = fitSize(shownUrl, font, 9, 6, W - margin * 2);
    centered(page, "Ou saisissez l'adresse :", y, font, 8.5, MUTED);
    centered(page, shownUrl, y - 13, font, urlSize, ACCENT);
  }

  // Pied de page
  page.drawRectangle({ x: 0, y: 0, width: W, height: 34, color: MINT });
  page.drawRectangle({ x: 0, y: 34, width: W, height: 2, color: ACCENT });
  const footLeft = winAnsi(`${settings.appName} · Réf. ${meeting.internalRef}`);
  page.drawText(footLeft, { x: margin, y: 13, size: 8.5, font: bold, color: ACCENT });
  if (template.footerText) {
    const footRight = winAnsi(template.footerText);
    const footSize = fitSize(footRight, font, 7.5, 5.5, W - margin * 2 - bold.widthOfTextAtSize(footLeft, 8.5) - 20);
    page.drawText(footRight, {
      x: W - margin - font.widthOfTextAtSize(footRight, footSize),
      y: 13,
      size: footSize,
      font,
      color: MUTED,
    });
  }

  return Buffer.from(await pdf.save());
}
