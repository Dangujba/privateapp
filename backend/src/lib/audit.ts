import type { Request } from 'express';
import { prisma } from '../db.js';
import type { AuthRequest } from '../types.js';

export async function audit(req: Request, action: string, entityType: string, entityId?: string, metadata?: unknown) {
  const auth = (req as AuthRequest).auth;
  await prisma.auditLog.create({
    data: {
      actorId: auth?.id,
      action,
      entityType,
      entityId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: metadata === undefined ? undefined : JSON.stringify(metadata),
    },
  });
}
