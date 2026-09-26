import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { findUserById, type UserRole } from '../models/user.model';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      userRole?: UserRole;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  const token = authHeader.replace('Bearer ', '');
  const decoded = verifyToken(token);

  if (!decoded) {
    res.status(401).json({ error: 'Token inválido ou expirado' });
    return;
  }

  req.userId = decoded.userId;
  req.userEmail = decoded.email;
  next();
}

/**
 * Loads the current user's role from DB and attaches to req.userRole.
 * Use after authMiddleware. Required by requireRole.
 */
export async function loadUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  const user = await findUserById(req.userId);
  if (!user || user.status !== 'ATIVO') {
    res.status(403).json({ error: 'Usuário inativo ou inexistente' });
    return;
  }
  req.userRole = user.role;
  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      res.status(403).json({ error: 'Permissão não verificada' });
      return;
    }
    if (!allowedRoles.includes(req.userRole)) {
      res.status(403).json({ error: 'Acesso negado: permissão insuficiente' });
      return;
    }
    next();
  };
}
