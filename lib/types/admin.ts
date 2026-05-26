/**
 * Admin & Account Management Types
 */

export interface AdminAccount {
  id: string;
  password: string;
  name: string;
  role: 'super_admin' | 'admin' | 'viewer';
  createdAt: number;
  updatedAt: number;
  expiresAt?: number; // 过期时间戳(ms)，undefined=永不过期
}

export interface AdminSession {
  id: string;
  name: string;
  role: 'super_admin' | 'admin' | 'viewer';
}

export interface AdminConfig {
  adminPassword: string;
  premiumPassword: string;
}
