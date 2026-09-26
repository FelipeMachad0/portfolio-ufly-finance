import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../types/auth';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-key-minimo-32-caracteres';
const JWT_EXPIRY = process.env.JWT_EXPIRY ?? '24h';

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
