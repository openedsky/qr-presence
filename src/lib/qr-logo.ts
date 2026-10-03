/**
 * Emplacement du logo, en fractions de la largeur du QR. Le logo tient dans un carré de 22 %
 * (6 % de la surface au plus) : la correction d'erreur de niveau H (30 %) garde le QR lisible.
 */
export function qrLogoLayout(width: number, height: number) {
  const box = 0.22;
  const ratio = width / height;
  const logoW = ratio >= 1 ? box : box * ratio;
  const logoH = ratio >= 1 ? box / ratio : box;
  const pad = 0.022;
  return { logoW, logoH, badgeW: logoW + pad * 2, badgeH: logoH + pad * 2, pad };
}
