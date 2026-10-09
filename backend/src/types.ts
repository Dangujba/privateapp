import type { Request } from 'express';

export type Role = 'individual' | 'business' | 'admin' | 'super_admin';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface AuthRequest extends Request {
  auth?: AuthUser;
}
