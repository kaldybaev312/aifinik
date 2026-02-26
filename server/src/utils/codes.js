import crypto from "crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateCode() {
  const bytes = crypto.randomBytes(8);

  let code = "";
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }

  return code.slice(0, 4) + "-" + code.slice(4, 8);
}