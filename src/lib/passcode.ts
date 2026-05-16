import bcrypt from "bcryptjs";

const COST = Number.parseInt(process.env.BCRYPT_COST ?? "12", 10);

export function hashPasscode(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPasscode(plain: string, hash: string): Promise<boolean> {
  if (!plain || !hash) return Promise.resolve(false);
  return bcrypt.compare(plain, hash);
}
