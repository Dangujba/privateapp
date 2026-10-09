import { createHash, randomBytes } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../db.js';
import type { AuthRequest, AuthUser, Role } from '../types.js';
import { ApiError } from './http.js';

const accessCookie = 'yirs_revenue_access';
const refreshCookie = 'yirs_revenue_refresh';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');

export function signAccess(user: AuthUser): string {
  return jwt.sign({ email: user.email, role: user.role }, config.JWT_ACCESS_SECRET, {
    subject: user.id,
    audience: config.APP_DOMAIN,
    issuer: 'yirs-revenue-system-api',
    expiresIn: `${config.ACCESS_TOKEN_MINUTES}m`,
  });
}

export function signRefresh(user: AuthUser): string {
  return jwt.sign({ type: 'refresh' }, config.JWT_REFRESH_SECRET, {
    subject: user.id,
    audience: config.APP_DOMAIN,
    issuer: 'yirs-revenue-system-api',
    expiresIn: `${config.REFRESH_TOKEN_DAYS}d`,
    jwtid: randomToken(),
  });
}

export async function issueSession(res: Response, user: AuthUser) {
  const accessToken = signAccess(user);
  const refreshToken = signRefresh(user);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + config.REFRESH_TOKEN_DAYS * 86_400_000),
    },
  });
  const secure = config.NODE_ENV === 'production';
  res.cookie(accessCookie, accessToken, { httpOnly: true, secure, sameSite: 'lax', maxAge: config.ACCESS_TOKEN_MINUTES * 60_000, path: '/' });
  res.cookie(refreshCookie, refreshToken, { httpOnly: true, secure, sameSite: 'lax', maxAge: config.REFRESH_TOKEN_DAYS * 86_400_000, path: '/api/v1/auth' });
  return { accessToken };
}

export function clearSession(res: Response) {
  res.clearCookie(accessCookie, { path: '/' });
  res.clearCookie(refreshCookie, { path: '/api/v1/auth' });
}

function readAccessToken(req: AuthRequest): string | undefined {
  const bearer = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  return req.cookies?.[accessCookie] ?? bearer;
}

export async function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = readAccessToken(req);
  if (!token) return next(new ApiError(401, 'Authentication required', 'UNAUTHENTICATED'));
  try {
    const claims = jwt.verify(token, config.JWT_ACCESS_SECRET, {
      audience: config.APP_DOMAIN,
      issuer: 'yirs-revenue-system-api',
    });
    if (typeof claims === 'string' || !claims.sub || typeof claims.email !== 'string' || typeof claims.role !== 'string') throw new Error('Bad claims');
    req.auth = { id: claims.sub, email: claims.email, role: claims.role as Role };
    next();
  } catch {
    next(new ApiError(401, 'Session expired or invalid', 'INVALID_SESSION'));
  }
}

export const requireRole = (...roles: Role[]) => (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (!req.auth || !roles.includes(req.auth.role)) return next(new ApiError(403, 'You are not authorised to perform this action', 'FORBIDDEN'));
  next();
};

export function getRefreshToken(req: AuthRequest): string | undefined {
  return req.cookies?.[refreshCookie] ?? (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined);
}
