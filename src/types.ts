/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WorkRow {
  id: string;
  description: string;
  cost: number;
}

export interface JobCard {
  id: string;
  jbNumber: string; // e.g. "JB001"
  vehicleNumber: string;
  name: string;
  phoneNumber: string;
  workRows: WorkRow[];
  totalCost: number;
  smsSent: boolean;
  smsText: string;
  status: 'Open' | 'Active' | 'Done';
  vehiclePhoto: string | null; // Base64 optional photo
  createdBy: string; // Creator's name
  createdById: string; // Creator's user ID
  createdAt: string; // ISO date-time
  updatedAt: string; // ISO date-time
  synced: boolean; // Flag to track local modifications
}

export type UserRole = 'owner' | 'staff';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  phoneNumber: string;
  garageName: string; // Owner's garage name
  role: UserRole;
  category?: string; // For staff (e.g. Mechanic, Electrician, Advisor)
  syncUrl?: string; // Supabase dynamic URL
  syncKey?: string; // Supabase dynamic Anon Key
  logoUrl?: string; // Custom logo URL or Base64
  bannerUrl?: string; // Custom login banner URL or Base64
  createdAt: string;
}

export interface MessageLog {
  id: string;
  jbNumber: string;
  vehicleNumber: string;
  phoneNumber: string;
  recipientName: string;
  message: string;
  timestamp: string;
  status: 'Sent' | 'Failed';
}

export interface SyncHistory {
  id: string;
  timestamp: string;
  action: string; // e.g., "Pushed 2 jobs", "Pulled 5 jobs", "Initialized Sync"
  status: 'Success' | 'Failed';
  details: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
}

