import { randomInt } from "crypto";
import { PASSWORD_RULES } from "./validators";

const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "@#%!?*+=";

function pick(alphabet: string) {
  return alphabet[randomInt(alphabet.length)];
}

/** Mot de passe provisoire lisible (sans 0/O, 1/l) qui respecte les règles de robustesse. */
export function generateTemporaryPassword(length = 14): string {
  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  const password = chars.join("");
  return PASSWORD_RULES.every((rule) => rule.test(password)) ? password : generateTemporaryPassword(length);
}
