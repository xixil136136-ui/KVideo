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
  maxDevices?: number; // 最大设备登录数，undefined=使用默认值(5)，super_admin/admin 不受限制
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
