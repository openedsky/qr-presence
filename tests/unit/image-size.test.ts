import { describe, expect, it } from "vitest";
import { imageDimensions, imageWithinLimits, SIGNATURE_LIMITS } from "@/lib/image-size";

function pngHeader(width: number, height: number) {
  const buffer = Buffer.alloc(33);
  buffer.writeUInt32BE(0x89504e47, 0);
  buffer.writeUInt32BE(0x0d0a1a0a, 4);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function jpegHeader(width: number, height: number) {
  // SOI, segment APP0 de 16 octets, puis SOF0 (longueur 17, précision, hauteur, largeur).
  const app0 = Buffer.concat([Buffer.from([0xff, 0xe0, 0x00, 0x10]), Buffer.alloc(14)]);
  const sof = Buffer.alloc(19);
  sof.writeUInt16BE(0xffc0, 0);
  sof.writeUInt16BE(17, 2);
  sof[4] = 8;
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof]);
}

describe("dimensions d'image sans décodage", () => {
  it("lit l'en-tête PNG et JPEG", () => {
    expect(imageDimensions(pngHeader(480, 200))).toEqual({ width: 480, height: 200 });
    expect(imageDimensions(jpegHeader(480, 200))).toEqual({ width: 480, height: 200 });
    expect(imageDimensions(Buffer.from("pas une image"))).toBeNull();
  });

  it("refuse les images démesurées (bombe de décompression)", () => {
    expect(imageWithinLimits(pngHeader(480, 200), SIGNATURE_LIMITS)).toBe(true);
    expect(imageWithinLimits(pngHeader(20000, 20000), SIGNATURE_LIMITS)).toBe(false);
    expect(imageWithinLimits(jpegHeader(1999, 1999), SIGNATURE_LIMITS)).toBe(false);
    expect(imageWithinLimits(pngHeader(0, 100), SIGNATURE_LIMITS)).toBe(false);
  });
});
