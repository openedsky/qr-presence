/**
 * Dimensions lues dans l'en-tête, sans décoder l'image : une image compressée de quelques Ko peut annoncer
 * des dizaines de millions de pixels et saturer la mémoire au décodage (PDF, QR avec logo).
 */
export function imageDimensions(buffer: Buffer): { width: number; height: number } | null {
  // PNG : signature (8 octets), puis bloc IHDR (longueur, type, largeur, hauteur).
  if (buffer.length >= 24 && buffer.readUInt32BE(0) === 0x89504e47 && buffer.toString("ascii", 12, 16) === "IHDR") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  // JPEG : parcours des segments jusqu'au premier SOFn (hors DHT, JPG, DAC).
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) return null;
      const marker = buffer[offset + 1];
      if (marker === 0xff) {
        offset += 1;
        continue;
      }
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      if (length < 2) return null;
      offset += 2 + length;
    }
  }
  return null;
}

/** Vrai si l'image a des dimensions lisibles et raisonnables (côté et surface plafonnés). */
export function imageWithinLimits(buffer: Buffer, limits: { maxSide: number; maxPixels: number }) {
  const size = imageDimensions(buffer);
  if (!size || size.width === 0 || size.height === 0) return false;
  return size.width <= limits.maxSide && size.height <= limits.maxSide && size.width * size.height <= limits.maxPixels;
}

/** Signature : 480 px de large côté client, marge pour les anciens clients (600 px) et les écrans denses. */
export const SIGNATURE_LIMITS = { maxSide: 2000, maxPixels: 1_200_000 };
/** Logo de l'organisation (QR, PDF, interface). */
export const LOGO_LIMITS = { maxSide: 2000, maxPixels: 2_000_000 };
