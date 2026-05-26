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
