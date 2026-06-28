import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');

let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const googleDriveAuth = {
  initAuth(
    onAuthSuccess?: (user: User, token: string) => void,
    onAuthFailure?: () => void
  ) {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (cachedAccessToken) {
          if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        } else if (!isSigningIn) {
          cachedAccessToken = null;
          if (onAuthFailure) onAuthFailure();
        }
      } else {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    });
  },

  async signIn(): Promise<{ user: User; accessToken: string } | null> {
    try {
      isSigningIn = true;
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Failed to get access token from Google.');
      }
      cachedAccessToken = credential.accessToken;
      return { user: result.user, accessToken: cachedAccessToken };
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      isSigningIn = false;
    }
  },

  async signOut() {
    await auth.signOut();
    cachedAccessToken = null;
  },

  getAccessToken() {
    return cachedAccessToken;
  }
};

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
}

export const googleDriveService = {
  async getHeaders(token?: string) {
    const t = token || cachedAccessToken;
    if (!t) throw new Error('No Google Drive access token. Please sign in first.');
    return {
      'Authorization': `Bearer ${t}`,
      'Content-Type': 'application/json'
    };
  },

  async findOrCreateFolder(token: string, folderName: string = "AeroJobs Backups"): Promise<string> {
    const headers = await this.getHeaders(token);
    
    // Search for existing folder
    const query = encodeURIComponent(`name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
      method: 'GET',
      headers
    });

    if (!searchRes.ok) {
      const err = await searchRes.text();
      throw new Error(`Failed to search Google Drive folder: ${err}`);
    }

    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // Create the folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed to create Google Drive folder: ${err}`);
    }

    const createData = await createRes.json();
    return createData.id;
  },

  async uploadBackup(token: string, backupDataStr: string, fileName: string): Promise<{ success: boolean; fileId: string }> {
    const headers = await this.getHeaders(token);
    
    // 1. Get or create folder
    const folderId = await this.findOrCreateFolder(token);

    // 2. Create the file metadata
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: fileName,
        mimeType: 'application/json',
        parents: [folderId]
      })
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed to create backup file metadata: ${err}`);
    }

    const fileMeta = await createRes.json();
    const fileId = fileMeta.id;

    // 3. Upload content
    const uploadHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: uploadHeaders,
      body: backupDataStr
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Failed to upload backup file content: ${err}`);
    }

    return { success: true, fileId };
  },

  async listBackups(token: string): Promise<DriveBackupFile[]> {
    const headers = await this.getHeaders(token);
    
    // 1. Get folder ID
    const folderId = await this.findOrCreateFolder(token);

    // 2. List files in folder
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=createdTime%20desc&fields=files(id,name,createdTime,size)&pageSize=50`, {
      method: 'GET',
      headers
    });

    if (!listRes.ok) {
      const err = await listRes.text();
      throw new Error(`Failed to list backups: ${err}`);
    }

    const data = await listRes.json();
    return data.files || [];
  },

  async downloadBackup(token: string, fileId: string): Promise<string> {
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      method: 'GET',
      headers
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to download backup content: ${err}`);
    }

    return await res.text();
  },

  async deleteBackup(token: string, fileId: string): Promise<boolean> {
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to delete backup from Google Drive: ${err}`);
    }

    return true;
  }
};
