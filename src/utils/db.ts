/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { JobCard, AppUser, MessageLog, SyncHistory, UserRole, MessageTemplate } from '../types';

// Helper to check if online (always true to ensure live-sync connection is never blocked)
export function isOnline(): boolean {
  return true;
}

// Primary storage keys
const KEYS = {
  USERS: 'aerojobs_users',
  CURRENT_USER: 'aerojobs_current_user',
  JOB_CARDS: 'aerojobs_job_cards',
  MESSAGE_LOGS: 'aerojobs_message_logs',
  SYNC_HISTORY: 'aerojobs_sync_history',
  DELETED_JOB_CARDS: 'aerojobs_deleted_job_cards',
  MESSAGE_TEMPLATES: 'aerojobs_message_templates',
};

const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: 'tpl-ready',
    name: 'Ready for Pickup',
    content: 'Dear {customer}, your vehicle {vehicle} is ready for pickup! Total cost is INR {totalCost}. Thank you, {garage}.'
  },
  {
    id: 'tpl-delayed',
    name: 'Parts Delayed',
    content: 'Hello {customer}, we wanted to inform you that parts for your vehicle {vehicle} are delayed. We will update you as soon as they arrive. Thank you for your patience, {garage}.'
  },
  {
    id: 'tpl-estimate',
    name: 'Estimate / Work Started',
    content: 'Hello {customer}, work has started on your vehicle {vehicle}. Job card: {jbNumber}. Estimated cost: INR {totalCost}. Thank you, {garage}.'
  },
  {
    id: 'tpl-general',
    name: 'General Update',
    content: 'Hello {customer}, the status of your vehicle {vehicle} is currently "{status}". If you have any questions, please contact us. {garage}.'
  }
];

// Initialize default data if empty
if (!localStorage.getItem(KEYS.USERS)) {
  localStorage.setItem(KEYS.USERS, JSON.stringify([]));
}
if (!localStorage.getItem(KEYS.JOB_CARDS)) {
  localStorage.setItem(KEYS.JOB_CARDS, JSON.stringify([]));
}
if (!localStorage.getItem(KEYS.MESSAGE_LOGS)) {
  localStorage.setItem(KEYS.MESSAGE_LOGS, JSON.stringify([]));
}
if (!localStorage.getItem(KEYS.SYNC_HISTORY)) {
  localStorage.setItem(KEYS.SYNC_HISTORY, JSON.stringify([]));
}
if (!localStorage.getItem(KEYS.DELETED_JOB_CARDS)) {
  localStorage.setItem(KEYS.DELETED_JOB_CARDS, JSON.stringify([]));
}
if (!localStorage.getItem(KEYS.MESSAGE_TEMPLATES)) {
  localStorage.setItem(KEYS.MESSAGE_TEMPLATES, JSON.stringify(DEFAULT_TEMPLATES));
}

// LOCAL DATABASE API
export const localDB = {
  // --- USERS ---
  getUsers(): AppUser[] {
    try {
      return JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
    } catch {
      return [];
    }
  },

  saveUser(user: AppUser): void {
    const users = this.getUsers();
    const index = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  },

  getCurrentUser(): AppUser | null {
    try {
      return JSON.parse(localStorage.getItem(KEYS.CURRENT_USER) || 'null');
    } catch {
      return null;
    }
  },

  setCurrentUser(user: AppUser | null): void {
    if (user) {
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
      this.saveUser(user);
      if (user.logoUrl) {
        localStorage.setItem('aerojobs_custom_logo', user.logoUrl);
      }
      if (user.bannerUrl) {
        localStorage.setItem('aerojobs_custom_banner', user.bannerUrl);
      }
    } else {
      localStorage.removeItem(KEYS.CURRENT_USER);
    }
  },

  getGarageLogo(): string {
    return localStorage.getItem('aerojobs_custom_logo') || '/src/assets/images/aero_logo_1782628818729.jpg';
  },

  setGarageLogo(logoUrl: string): void {
    localStorage.setItem('aerojobs_custom_logo', logoUrl);
  },

  getGarageBanner(): string {
    return localStorage.getItem('aerojobs_custom_banner') || '/src/assets/images/workshop_login_bg_1782628838111.jpg';
  },

  setGarageBanner(bannerUrl: string): void {
    localStorage.setItem('aerojobs_custom_banner', bannerUrl);
  },

  // --- JOB CARDS ---
  getJobCards(): JobCard[] {
    try {
      const cards: JobCard[] = JSON.parse(localStorage.getItem(KEYS.JOB_CARDS) || '[]');
      // Sort in descending order of jbNumber
      return cards.sort((a, b) => b.jbNumber.localeCompare(a.jbNumber));
    } catch {
      return [];
    }
  },

  saveJobCard(card: JobCard): void {
    const cards = this.getJobCards();
    const index = cards.findIndex(c => c.id === card.id);
    const updatedCard = { ...card, synced: false, updatedAt: new Date().toISOString() };
    if (index >= 0) {
      cards[index] = updatedCard;
    } else {
      cards.push(updatedCard);
    }
    localStorage.setItem(KEYS.JOB_CARDS, JSON.stringify(cards));
  },

  deleteJobCard(id: string): void {
    let cards = this.getJobCards();
    
    // 1. Record deleted card ID for Supabase synchronization
    try {
      const deletedList: string[] = JSON.parse(localStorage.getItem(KEYS.DELETED_JOB_CARDS) || '[]');
      if (!deletedList.includes(id)) {
        deletedList.push(id);
        localStorage.setItem(KEYS.DELETED_JOB_CARDS, JSON.stringify(deletedList));
      }
    } catch (e) {
      console.error('Failed to update deleted job list tracker', e);
    }

    // 2. Filter out the deleted card
    cards = cards.filter(c => c.id !== id);
    
    // 3. Sort cards chronologically by creation date ascending (oldest first)
    cards.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    // 4. Re-assign jbNumber sequentially
    cards = cards.map((card, index) => {
      const newJbNumber = `JB${String(index + 1).padStart(3, '0')}`;
      return {
        ...card,
        jbNumber: newJbNumber,
        synced: false,
        updatedAt: new Date().toISOString()
      };
    });
    
    // 5. Save back to localStorage
    localStorage.setItem(KEYS.JOB_CARDS, JSON.stringify(cards));
  },

  getNextJbNumber(): string {
    const cards = this.getJobCards();
    if (cards.length === 0) {
      return 'JB001';
    }
    // Find maximum numeric part
    let maxNum = 0;
    cards.forEach(card => {
      const match = card.jbNumber.match(/^JB(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    const nextNum = maxNum + 1;
    return `JB${String(nextNum).padStart(3, '0')}`;
  },

  // --- MESSAGE LOGS ---
  getMessageLogs(): MessageLog[] {
    try {
      return JSON.parse(localStorage.getItem(KEYS.MESSAGE_LOGS) || '[]');
    } catch {
      return [];
    }
  },

  saveMessageLog(log: MessageLog): void {
    const logs = this.getMessageLogs();
    logs.unshift(log); // Newer first
    localStorage.setItem(KEYS.MESSAGE_LOGS, JSON.stringify(logs));
  },

  // --- SYNC HISTORY ---
  getSyncHistory(): SyncHistory[] {
    try {
      return JSON.parse(localStorage.getItem(KEYS.SYNC_HISTORY) || '[]');
    } catch {
      return [];
    }
  },

  addSyncHistory(history: Omit<SyncHistory, 'id' | 'timestamp'>): void {
    const items = this.getSyncHistory();
    const newItem: SyncHistory = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      ...history
    };
    items.unshift(newItem);
    localStorage.setItem(KEYS.SYNC_HISTORY, JSON.stringify(items.slice(0, 100))); // Keep last 100 logs
  },

  // --- MESSAGE TEMPLATES ---
  getMessageTemplates(): MessageTemplate[] {
    try {
      return JSON.parse(localStorage.getItem(KEYS.MESSAGE_TEMPLATES) || '[]');
    } catch {
      return [];
    }
  },

  saveMessageTemplate(template: MessageTemplate): void {
    const templates = this.getMessageTemplates();
    const index = templates.findIndex(t => t.id === template.id);
    if (index >= 0) {
      templates[index] = template;
    } else {
      templates.push(template);
    }
    localStorage.setItem(KEYS.MESSAGE_TEMPLATES, JSON.stringify(templates));
  },

  deleteMessageTemplate(id: string): void {
    const templates = this.getMessageTemplates();
    const filtered = templates.filter(t => t.id !== id);
    localStorage.setItem(KEYS.MESSAGE_TEMPLATES, JSON.stringify(filtered));
  }
};

// BACKUP AND RESTORE SERVICE
export const backupRestoreService = {
  // Generate JSON backup of all application data
  generateBackup(): string {
    const data = {
      version: "1.0.0",
      backupDate: new Date().toISOString(),
      jobCards: localDB.getJobCards(),
      users: localDB.getUsers(),
      messageLogs: localDB.getMessageLogs(),
      messageTemplates: localDB.getMessageTemplates(),
      branding: {
        logoUrl: localStorage.getItem('aerojobs_custom_logo'),
        bannerUrl: localStorage.getItem('aerojobs_custom_banner'),
      }
    };
    return JSON.stringify(data, null, 2);
  },

  // Validate and restore data from JSON
  restoreBackup(jsonString: string): { success: boolean; error?: string } {
    try {
      const data = JSON.parse(jsonString);
      
      // Validation checks
      if (!data || typeof data !== 'object') {
        return { success: false, error: 'Invalid backup file format.' };
      }
      
      if (!Array.isArray(data.jobCards) || !Array.isArray(data.users)) {
        return { success: false, error: 'Missing core data structures (Job Cards or Users).' };
      }

      // Overwrite local records
      localStorage.setItem(KEYS.JOB_CARDS, JSON.stringify(data.jobCards));
      localStorage.setItem(KEYS.USERS, JSON.stringify(data.users));
      
      if (Array.isArray(data.messageLogs)) {
        localStorage.setItem(KEYS.MESSAGE_LOGS, JSON.stringify(data.messageLogs));
      }

      if (Array.isArray(data.messageTemplates)) {
        localStorage.setItem(KEYS.MESSAGE_TEMPLATES, JSON.stringify(data.messageTemplates));
      }

      if (data.branding) {
        if (data.branding.logoUrl) {
          localStorage.setItem('aerojobs_custom_logo', data.branding.logoUrl);
        }
        if (data.branding.bannerUrl) {
          localStorage.setItem('aerojobs_custom_banner', data.branding.bannerUrl);
        }
      }

      // Add to history log
      localDB.addSyncHistory({
        action: 'Local Restore',
        status: 'Success',
        details: `Restored ${data.jobCards.length} job cards, ${data.users.length} staff, and ${data.messageLogs?.length || 0} logs.`
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error parsing backup file.' };
    }
  },

  // Export Job Cards as CSV string
  generateCSVExport(): string {
    const cards = localDB.getJobCards();
    
    // Column Headers
    const headers = [
      'Job Number',
      'Vehicle Plate',
      'Customer Name',
      'Phone Number',
      'Status',
      'Total Cost (INR)',
      'Created At',
      'Updated At',
      'Work Details (Description & Cost)'
    ];

    const rows = cards.map(card => {
      // Format work rows into a single string
      const workDetails = card.workRows
        .map(row => `${row.description}: ₹${row.cost}`)
        .join(' | ');

      // Escape double quotes in CSV fields to avoid formatting breakages
      const escape = (val: any) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      return [
        escape(card.jbNumber),
        escape(card.vehicleNumber),
        escape(card.name),
        escape(card.phoneNumber),
        escape(card.status),
        escape(card.totalCost),
        escape(new Date(card.createdAt).toLocaleDateString('en-IN')),
        escape(new Date(card.updatedAt).toLocaleDateString('en-IN')),
        escape(workDetails)
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
};

// SYNCHRONIZATION SERVICE (SECURE BIDIRECTIONAL CLOUD SYNC)
export const syncService = {
  async sync(user: AppUser): Promise<{ success: boolean; message: string }> {
    try {
      const unsyncedJobs = localDB.getJobCards().filter(j => !j.synced);
      const localUsers = localDB.getUsers();
      const localLogs = localDB.getMessageLogs();
      const deletedJobIds = JSON.parse(localStorage.getItem('aerojobs_deleted_job_cards') || '[]');

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          syncUrl: user.syncUrl || '',
          syncKey: user.syncKey || '',
          localUsers,
          unsyncedJobs,
          localLogs,
          deletedJobIds
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Sync failed');
      }

      // Update local jobs from remote
      if (Array.isArray(result.remoteJobs)) {
        const localJobs = localDB.getJobCards();
        const mergedJobsMap = new Map<string, JobCard>();
        
        // Add all remote jobs first
        result.remoteJobs.forEach((rj: any) => {
          mergedJobsMap.set(rj.id, {
            id: rj.id,
            jbNumber: rj.jb_number,
            vehicleNumber: rj.vehicle_number,
            name: rj.name,
            phoneNumber: rj.phone_number,
            workRows: Array.isArray(rj.work_rows) ? rj.work_rows : [],
            totalCost: Number(rj.total_cost),
            smsSent: Boolean(rj.sms_sent),
            smsText: rj.sms_text || '',
            status: rj.status || 'Open',
            vehiclePhoto: rj.vehicle_photo || '',
            createdBy: rj.created_by || '',
            createdById: rj.created_by_id || '',
            synced: true,
            createdAt: rj.created_at,
            updatedAt: rj.updated_at
          });
        });

        // Add local jobs that might not have synced yet, or keep local if newer
        localJobs.forEach((lj) => {
          const remote = mergedJobsMap.get(lj.id);
          if (!remote || new Date(lj.updatedAt).getTime() > new Date(remote.updatedAt).getTime()) {
            mergedJobsMap.set(lj.id, {
              ...lj,
              synced: result.pushedIds?.includes(lj.id) || lj.synced
            });
          }
        });

        // Convert back to list and save
        const mergedList = Array.from(mergedJobsMap.values());
        localStorage.setItem('aerojobs_job_cards', JSON.stringify(mergedList));
      }

      // Update local users
      if (Array.isArray(result.remoteUsers)) {
        const mergedUsersMap = new Map<string, AppUser>();
        
        // Add remote users
        result.remoteUsers.forEach((ru: any) => {
          mergedUsersMap.set(ru.email.toLowerCase(), {
            id: ru.id,
            email: ru.email,
            name: ru.name,
            phoneNumber: ru.phone_number,
            garageName: ru.garage_name,
            role: ru.role,
            category: ru.category || undefined,
            logoUrl: ru.logo_url || undefined,
            bannerUrl: ru.banner_url || undefined,
            createdAt: ru.created_at
          });
        });

        // Add local users (preserve local additions)
        localUsers.forEach((lu) => {
          const key = lu.email.toLowerCase();
          if (!mergedUsersMap.has(key)) {
            mergedUsersMap.set(key, lu);
          }
        });

        localStorage.setItem('aerojobs_users', JSON.stringify(Array.from(mergedUsersMap.values())));
      }

      // Clear deleted tracker
      localStorage.setItem('aerojobs_deleted_job_cards', JSON.stringify([]));

      const details = `Cloud sync successful! Pushed ${result.pushedIds?.length || 0} jobs, pulled ${result.remoteJobs?.length || 0} remote jobs.`;
      localDB.addSyncHistory({
        action: 'Cloud Sync',
        status: 'Success',
        details
      });

      return { success: true, message: details };
    } catch (err: any) {
      console.error("syncService error:", err);
      localDB.addSyncHistory({
        action: 'Cloud Sync',
        status: 'Failed',
        details: err.message || 'Unknown network error'
      });
      return { success: false, message: err.message || 'Sync failed' };
    }
  }
};
