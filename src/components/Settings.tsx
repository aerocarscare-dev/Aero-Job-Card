/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Database, RefreshCw, CheckCircle, ShieldAlert, AlertCircle, Image, Upload, Download, Layers, ChevronDown, Cloud, Trash2, ShieldCheck, MessageSquare, Plus, Edit, Save, X, FileText } from 'lucide-react';
import { AppUser, SyncHistory, MessageTemplate } from '../types';
import { localDB, backupRestoreService, syncService } from '../utils/db';
import { googleDriveAuth, googleDriveService, DriveBackupFile } from '../utils/googleDrive';
import { User } from 'firebase/auth';

interface SettingsProps {
  currentUser: AppUser;
  onUpdateUser: (user: AppUser) => void;
  onBack: () => void;
}

export default function Settings({ currentUser, onUpdateUser, onBack }: SettingsProps) {
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [logoUrl, setLogoUrl] = useState(currentUser.logoUrl || localDB.getGarageLogo());
  const [bannerUrl, setBannerUrl] = useState(currentUser.bannerUrl || localDB.getGarageBanner());
  const [customizationSaved, setCustomizationSaved] = useState(false);

  // Google Drive State variables
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isDriveLoading, setIsDriveLoading] = useState<boolean>(true);
  const [driveBackups, setDriveBackups] = useState<DriveBackupFile[]>([]);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState<boolean>(false);

  // Message Templates State
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [templateSavedMsg, setTemplateSavedMsg] = useState('');

  useEffect(() => {
    setSyncHistory(localDB.getSyncHistory());
    setTemplates(localDB.getMessageTemplates());

    // Initialize Google Drive Auth
    const unsubscribe = googleDriveAuth.initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setIsDriveLoading(false);
        fetchDriveBackups(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setIsDriveLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const fetchDriveBackups = async (token: string) => {
    try {
      const files = await googleDriveService.listBackups(token);
      setDriveBackups(files);
    } catch (err: any) {
      console.error('Error fetching Google Drive backups:', err);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsDriveLoading(true);
    try {
      const res = await googleDriveAuth.signIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        await fetchDriveBackups(res.accessToken);
      }
    } catch (err: any) {
      alert(`Google Sign-In failed: ${err.message || err}`);
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    if (window.confirm('Are you sure you want to disconnect from Google Drive?')) {
      await googleDriveAuth.signOut();
      setGoogleUser(null);
      setGoogleToken(null);
      setDriveBackups([]);
    }
  };

  const handlePublishToDrive = async () => {
    if (!googleToken) {
      alert('Please connect to Google Drive first.');
      return;
    }

    setIsUploadingToDrive(true);
    try {
      const backupStr = backupRestoreService.generateBackup();
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `aerojobs_backup_${dateStr.substring(0, 16)}.json`;

      await googleDriveService.uploadBackup(googleToken, backupStr, fileName);

      // Add sync history log
      localDB.addSyncHistory({
        action: 'Google Drive Backup',
        status: 'Success',
        details: `Saved backup file: ${fileName}`
      });
      setSyncHistory(localDB.getSyncHistory());

      alert('Successfully published your workshop backup to Google Drive!');
      await fetchDriveBackups(googleToken);
    } catch (err: any) {
      alert(`Failed to upload backup to Google Drive: ${err.message}`);
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleRestoreFromDrive = async (fileId: string, fileName: string) => {
    if (!googleToken) return;

    const confirmed = window.confirm(
      `Are you sure you want to RESTORE the backup "${fileName}" from Google Drive?\n\nWARNING: This will replace your entire current local database (Job Cards, staff list, message history, settings). This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const content = await googleDriveService.downloadBackup(googleToken, fileId);
      const res = backupRestoreService.restoreBackup(content);
      if (res.success) {
        localDB.addSyncHistory({
          action: 'Google Drive Restore',
          status: 'Success',
          details: `Restored from file: ${fileName}`
        });
        setSyncHistory(localDB.getSyncHistory());
        alert('Database successfully restored from Google Drive! Reloading page...');
        window.location.reload();
      } else {
        alert(`Restore failed: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Failed to restore backup: ${err.message}`);
    }
  };

  const handleDeleteFromDrive = async (fileId: string, fileName: string) => {
    if (!googleToken) return;

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${fileName}" from Google Drive?`
    );
    if (!confirmed) return;

    try {
      await googleDriveService.deleteBackup(googleToken, fileId);
      alert('Backup file deleted successfully from Google Drive.');
      await fetchDriveBackups(googleToken);
    } catch (err: any) {
      alert(`Failed to delete backup file: ${err.message}`);
    }
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim() || !newTemplateContent.trim()) {
      alert('Please fill out both the template name and content.');
      return;
    }

    const templateToSave: MessageTemplate = {
      id: editingTemplate?.id || `tpl-${Math.random().toString(36).substring(2, 9)}`,
      name: newTemplateName.trim(),
      content: newTemplateContent.trim(),
    };

    localDB.saveMessageTemplate(templateToSave);
    setTemplates(localDB.getMessageTemplates());
    
    setEditingTemplate(null);
    setNewTemplateName('');
    setNewTemplateContent('');
    setIsAddingTemplate(false);
    
    setTemplateSavedMsg('Template saved successfully!');
    setTimeout(() => setTemplateSavedMsg(''), 3000);
  };

  const handleEditTemplate = (tpl: MessageTemplate) => {
    setEditingTemplate(tpl);
    setNewTemplateName(tpl.name);
    setNewTemplateContent(tpl.content);
    setIsAddingTemplate(true);
  };

  const handleDeleteTemplate = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the template "${name}"?`)) {
      localDB.deleteMessageTemplate(id);
      setTemplates(localDB.getMessageTemplates());
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-16 font-sans">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 flex items-center justify-between z-10">
        <button
          id="btn-settings-back"
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-700 hover:text-blue-600 transition font-medium text-sm cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Dashboard</span>
        </button>
        <h2 className="text-lg font-bold font-display text-slate-900">
          Sync & settings
        </h2>
        <div className="w-10"></div>
      </div>

      <div className="max-w-xl mx-auto px-4 mt-6 space-y-6">

        {/* Local Database Backup & Restore Console */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Database className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-slate-800 font-display">Local Database Backup & Restore</h3>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Your data is saved securely on this device! Keep standard offline backups or migrate your data to other devices using the secure file utilities below.
          </p>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Action 1: Export JSON Backup */}
            <div className="border border-slate-200 p-4 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition flex flex-col justify-between space-y-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Download className="h-4 w-4 text-blue-600" />
                  <span>Download Backup (.JSON)</span>
                </h4>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                  Saves your complete workspace including Job Cards, staff profiles, message history, and custom branding into a self-contained backup file.
                </p>
              </div>
              <button
                id="btn-download-json-backup"
                type="button"
                onClick={() => {
                  const backupStr = backupRestoreService.generateBackup();
                  const blob = new Blob([backupStr], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  const dateStr = new Date().toISOString().split('T')[0];
                  a.download = `aerojobs_backup_${dateStr}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  setSyncHistory(localDB.getSyncHistory());
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export Backup File</span>
              </button>
            </div>

            {/* Action 2: Export Business Excel/CSV */}
            <div className="border border-slate-200 p-4 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition flex flex-col justify-between space-y-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-emerald-600" />
                  <span>Export Spreadsheet (.CSV)</span>
                </h4>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                  Downloads all recorded Job Cards as a standard CSV spreadsheet format. Instantly viewable in Microsoft Excel, Google Sheets, or Apple Numbers.
                </p>
              </div>
              <button
                id="btn-export-csv"
                type="button"
                onClick={() => {
                  const csvStr = backupRestoreService.generateCSVExport();
                  const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  const dateStr = new Date().toISOString().split('T')[0];
                  a.download = `aerojobs_spreadsheet_${dateStr}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Export Excel Sheet</span>
              </button>
            </div>
          </div>

          {/* Action 3: Restore Database JSON */}
          <div className="border border-slate-200 p-4 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition space-y-3.5">
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Upload className="h-4 w-4 text-orange-600" />
                <span>Restore Database Backup</span>
              </h4>
              <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                Upload a previously exported <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded text-[9px]">.json</code> file to completely restore your settings and records. <strong className="text-red-500">Note:</strong> This replaces existing local records with the uploaded backup state.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 border border-dashed border-slate-300 rounded-xl bg-white hover:bg-slate-100 text-xs text-slate-700 cursor-pointer font-bold py-2 px-3 transition shadow-sm">
                <Upload className="h-4 w-4 text-slate-500" />
                <span>Select Backup File (.json)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        const res = backupRestoreService.restoreBackup(reader.result as string);
                        if (res.success) {
                          setSyncHistory(localDB.getSyncHistory());
                          alert('Database successfully restored! Reloading database cache...');
                          window.location.reload();
                        } else {
                          alert(`Restore failed: ${res.error}`);
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Google Drive Cloud Backup & Restore Console */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-blue-600 animate-pulse" />
              <h3 className="font-bold text-slate-800 font-display">Google Drive Cloud Backups</h3>
            </div>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Secure Storage
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Publish your workshop's complete local database directly to your personal <strong>Google Drive</strong>. Keeps your data safe in the cloud and allows easy restoring on other devices.
          </p>

          {isDriveLoading ? (
            <div className="flex items-center justify-center py-6 gap-2">
              <RefreshCw className="h-4 w-4 text-slate-400 animate-spin" />
              <span className="text-xs text-slate-500 font-medium">Connecting to Google services...</span>
            </div>
          ) : !googleUser ? (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3.5 flex flex-col items-center text-center">
              <div className="bg-blue-50 p-2.5 rounded-full">
                <Cloud className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">Connect Google Drive Account</h4>
                <p className="text-[10px] text-slate-500 max-w-xs mt-1">
                  Authorize with permission to save your database backups inside a dedicated <strong className="font-mono text-slate-700">"AeroJobs Backups"</strong> folder in your Google Drive.
                </p>
              </div>

              {/* Official GSI Styled Button */}
              <button
                id="btn-google-drive-signin"
                type="button"
                onClick={handleGoogleSignIn}
                className="gsi-material-button w-full sm:w-auto shadow-sm cursor-pointer hover:shadow-md transition duration-150"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #dadce0',
                  borderRadius: '12px',
                  boxSizing: 'border-box',
                  color: '#3c4043',
                  cursor: 'pointer',
                  fontFamily: '"Google Sans",arial,sans-serif',
                  fontSize: '14px',
                  fontWeight: '500',
                  height: '40px',
                  letterSpacing: '0.25px',
                  outline: 'none',
                  overflow: 'hidden',
                  padding: '0 12px',
                  position: 'relative',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block', width: '20px', height: '20px' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>Sign in with Google</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Account Status */}
              <div className="flex items-center justify-between p-3 bg-blue-50/60 rounded-xl border border-blue-100/80 text-xs">
                <div className="flex items-center gap-2">
                  {googleUser.photoURL ? (
                    <img src={googleUser.photoURL} alt="Google Avatar" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full border border-blue-200" />
                  ) : (
                    <div className="bg-blue-600 text-white h-6 w-6 rounded-full flex items-center justify-center font-bold text-[10px]">
                      {googleUser.displayName?.[0] || 'G'}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-slate-800 flex items-center gap-1">
                      <span>{googleUser.displayName || 'Google User'}</span>
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <div className="text-[10px] text-slate-500">{googleUser.email}</div>
                  </div>
                </div>
                <button
                  id="btn-google-signout"
                  type="button"
                  onClick={handleGoogleSignOut}
                  className="text-[10px] text-slate-500 hover:text-red-600 font-bold underline cursor-pointer"
                >
                  Disconnect
                </button>
              </div>

              {/* Upload Active Database */}
              <div className="border border-slate-200 p-4 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition flex flex-col justify-between space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Cloud className="h-4 w-4 text-blue-600" />
                    <span>Publish Current Database to Google Drive</span>
                  </h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                    This pushes all local data, staff list, settings, and branding logs to Google Drive immediately as a secure restore point.
                  </p>
                </div>
                <button
                  id="btn-upload-google-backup"
                  type="button"
                  disabled={isUploadingToDrive}
                  onClick={handlePublishToDrive}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {isUploadingToDrive ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Uploading Database...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" />
                      <span>Publish Backup File</span>
                    </>
                  )}
                </button>
              </div>

              {/* Cloud Backups List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 px-0.5">
                  <span>Available Cloud Backups</span>
                  <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-md font-mono">
                    {driveBackups.length}
                  </span>
                </h4>

                {driveBackups.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/30">
                    <p className="text-[10px] text-slate-500">No backups found in Google Drive yet.</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">Click "Publish Backup File" above to create one.</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
                    {driveBackups.map((backup) => (
                      <div key={backup.id} className="p-3 bg-white hover:bg-slate-50 transition flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800 truncate" title={backup.name}>
                            {backup.name}
                          </p>
                          <p className="text-[9px] text-slate-400 mt-0.5 font-mono">
                            {new Date(backup.createdTime).toLocaleString()} • {backup.size ? `${(parseInt(backup.size) / 1024).toFixed(1)} KB` : 'JSON'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            id={`btn-restore-${backup.id}`}
                            type="button"
                            onClick={() => handleRestoreFromDrive(backup.id, backup.name)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded text-[10px] transition cursor-pointer"
                          >
                            Restore
                          </button>
                          <button
                            id={`btn-delete-${backup.id}`}
                            type="button"
                            onClick={() => handleDeleteFromDrive(backup.id, backup.name)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 font-bold p-1 rounded transition cursor-pointer"
                            title="Delete Backup"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SMS Message Templates Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              <h3 className="font-bold text-slate-800 font-display">Message Templates</h3>
            </div>
            <button
              id="btn-add-template"
              type="button"
              onClick={() => {
                setEditingTemplate(null);
                setNewTemplateName('');
                setNewTemplateContent('');
                setIsAddingTemplate(!isAddingTemplate);
              }}
              className="flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 hover:bg-blue-100 transition px-2.5 py-1.5 rounded-lg font-bold cursor-pointer"
            >
              {isAddingTemplate ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              <span>{isAddingTemplate ? 'Cancel' : 'New Template'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Customize the SMS messages sent to your customers. Use dynamic variables to insert customer details, job numbers, vehicle info, and pricing automatically.
          </p>

          {templateSavedMsg && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-1.5 animate-fade-in">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{templateSavedMsg}</span>
            </div>
          )}

          {/* Form to Add / Edit Template */}
          {isAddingTemplate && (
            <form onSubmit={handleSaveTemplate} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span>{editingTemplate ? 'Edit SMS Template' : 'Create Custom SMS Template'}</span>
                </h4>
                {editingTemplate && (
                  <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                    Modifying Existing
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Template Label / Name
                  </label>
                  <input
                    id="input-template-name"
                    type="text"
                    required
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="e.g., Ready for Pickup, Parts Delayed"
                    className="w-full text-xs font-medium border border-slate-200 px-3 py-2 rounded-xl bg-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      SMS Text Body
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {newTemplateContent.length} chars
                    </span>
                  </div>
                  <textarea
                    id="input-template-content"
                    rows={4}
                    required
                    value={newTemplateContent}
                    onChange={(e) => setNewTemplateContent(e.target.value)}
                    placeholder="Dear {customer}, your vehicle {vehicle} is ready for pickup! Total: INR {totalCost}. {garage}."
                    className="w-full text-xs font-medium border border-slate-200 px-3 py-2 rounded-xl bg-white focus:outline-none focus:border-blue-500 transition font-sans"
                  />
                </div>
              </div>

              {/* Placeholders Guide */}
              <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <span>Available Variables</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] leading-tight">
                  <div className="flex items-start gap-1 font-mono">
                    <span className="text-blue-600 font-bold">{'{customer}'}</span>
                    <span className="text-slate-400 font-sans">- Customer's Name</span>
                  </div>
                  <div className="flex items-start gap-1 font-mono">
                    <span className="text-blue-600 font-bold">{'{vehicle}'}</span>
                    <span className="text-slate-400 font-sans">- Plate / Vehicle Number</span>
                  </div>
                  <div className="flex items-start gap-1 font-mono">
                    <span className="text-blue-600 font-bold">{'{jbNumber}'}</span>
                    <span className="text-slate-400 font-sans">- Job Card ID</span>
                  </div>
                  <div className="flex items-start gap-1 font-mono">
                    <span className="text-blue-600 font-bold">{'{status}'}</span>
                    <span className="text-slate-400 font-sans">- Done, Open, Active</span>
                  </div>
                  <div className="flex items-start gap-1 font-mono">
                    <span className="text-blue-600 font-bold">{'{totalCost}'}</span>
                    <span className="text-slate-400 font-sans">- Total Invoice Cost</span>
                  </div>
                  <div className="flex items-start gap-1 font-mono">
                    <span className="text-blue-600 font-bold">{'{garage}'}</span>
                    <span className="text-slate-400 font-sans">- Garage Business Name</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Live Preview Panel */}
              <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-3 space-y-1.5">
                <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-mono font-bold uppercase tracking-wider">
                  Live Variable Preview
                </span>
                <p className="text-xs font-mono text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {newTemplateContent
                    ? newTemplateContent
                        .replace(/{customer}/g, 'John Doe')
                        .replace(/{vehicle}/g, 'DL3C-AB-1234')
                        .replace(/{jbNumber}/g, 'JB042')
                        .replace(/{status}/g, 'Done')
                        .replace(/{totalCost}/g, '12,500')
                        .replace(/{garage}/g, currentUser.garageName || 'My Garage')
                    : 'Dear John Doe, your vehicle DL3C-AB-1234 is ready!'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-save-message-template"
                  type="submit"
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Template</span>
                </button>
                <button
                  id="btn-cancel-message-template"
                  type="button"
                  onClick={() => {
                    setEditingTemplate(null);
                    setNewTemplateName('');
                    setNewTemplateContent('');
                    setIsAddingTemplate(false);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold py-2 px-3 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* List of active templates */}
          <div className="space-y-2">
            {templates.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/30">
                <p className="text-[10px] text-slate-500">No message templates available.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="p-3.5 bg-white hover:bg-slate-50/50 transition space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 text-xs">{tpl.name}</span>
                        {['tpl-ready', 'tpl-delayed', 'tpl-estimate', 'tpl-general'].includes(tpl.id) && (
                          <span className="text-[8px] bg-slate-100 text-slate-500 font-mono px-1 rounded font-bold uppercase tracking-wide">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          id={`btn-edit-tpl-${tpl.id}`}
                          type="button"
                          onClick={() => handleEditTemplate(tpl)}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold p-1 rounded transition cursor-pointer"
                          title="Edit Template"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        {!['tpl-ready', 'tpl-delayed', 'tpl-estimate', 'tpl-general'].includes(tpl.id) && (
                          <button
                            id={`btn-delete-tpl-${tpl.id}`}
                            type="button"
                            onClick={() => handleDeleteTemplate(tpl.id, tpl.name)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 font-bold p-1 rounded transition cursor-pointer"
                            title="Delete Template"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 font-mono leading-relaxed bg-slate-50/80 p-2 rounded-lg border border-slate-100 whitespace-pre-wrap">
                      {tpl.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Garage Branding & Login Page Customization Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Image className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-slate-800 font-display">Garage Branding & Login Customization</h3>
          </div>

          {customizationSaved && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-fade-in">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Branding settings updated successfully on this device!</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              localDB.setGarageLogo(logoUrl);
              localDB.setGarageBanner(bannerUrl);
              
              const updatedUser: AppUser = {
                ...currentUser,
                logoUrl,
                bannerUrl
              };
              
              localDB.saveUser(updatedUser);
              localDB.setCurrentUser(updatedUser);
              onUpdateUser(updatedUser);
              
              setCustomizationSaved(true);
              setTimeout(() => setCustomizationSaved(false), 3000);
            }}
            className="space-y-5"
          >
            {/* 1. Logo Section */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                1. Garage Logo Option
              </label>
              
              {/* Preset Selection Grid */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { name: 'Aero Crest', url: '/src/assets/images/aero_logo_1782628818729.jpg' },
                  { name: 'Sleek Gear', url: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=200' },
                  { name: 'Classic Shield', url: 'https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?auto=format&fit=crop&q=80&w=200' },
                  { name: 'Modern Carbon', url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=200' }
                ].map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLogoUrl(p.url)}
                    className={`p-1.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 bg-slate-50 hover:bg-slate-100 ${
                      logoUrl === p.url ? 'border-blue-600 ring-2 ring-blue-100 bg-blue-50/20' : 'border-slate-200'
                    }`}
                  >
                    <img 
                      src={p.url} 
                      alt={p.name} 
                      className="h-9 w-9 object-contain rounded-lg border border-slate-150 bg-white" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/src/assets/images/aero_logo_1782628818729.jpg';
                      }}
                    />
                    <span className="text-[9px] font-medium text-slate-600 truncate w-full">{p.name}</span>
                  </button>
                ))}
              </div>

              {/* Upload or Custom URL input */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <span className="block text-[10px] text-slate-500 mb-1 font-medium">Or Paste Custom Logo URL:</span>
                  <input
                    type="text"
                    value={logoUrl.startsWith('data:') ? '' : logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="block w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
                  />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 mb-1 font-medium">Or Upload Logo Image:</span>
                  <label className="flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs text-slate-700 cursor-pointer font-medium transition">
                    <Upload className="h-3.5 w-3.5 text-slate-500" />
                    <span>Upload File</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setLogoUrl(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* 2. Login Banner Section */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                2. Login Page Banner
              </label>
              
              {/* Preset Selection Grid */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { name: 'Aero Workshop', url: '/src/assets/images/workshop_login_bg_1782628838111.jpg' },
                  { name: 'Electric Garage', url: 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&q=80&w=600' },
                  { name: 'Supercar Bay', url: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&q=80&w=600' },
                  { name: 'Engine Bay HUD', url: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&q=80&w=600' }
                ].map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setBannerUrl(p.url)}
                    className={`p-1 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 bg-slate-50 hover:bg-slate-100 ${
                      bannerUrl === p.url ? 'border-blue-600 ring-2 ring-blue-100 bg-blue-50/20' : 'border-slate-200'
                    }`}
                  >
                    <img 
                      src={p.url} 
                      alt={p.name} 
                      className="h-8 w-full object-cover rounded-lg border border-slate-150 bg-white" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/src/assets/images/workshop_login_bg_1782628838111.jpg';
                      }}
                    />
                    <span className="text-[9px] font-medium text-slate-600 truncate w-full">{p.name}</span>
                  </button>
                ))}
              </div>

              {/* Upload or Custom URL input */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <span className="block text-[10px] text-slate-500 mb-1 font-medium">Or Paste Custom Banner URL:</span>
                  <input
                    type="text"
                    value={bannerUrl.startsWith('data:') ? '' : bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    placeholder="https://example.com/banner.jpg"
                    className="block w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
                  />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 mb-1 font-medium">Or Upload Banner Image:</span>
                  <label className="flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs text-slate-700 cursor-pointer font-medium transition">
                    <Upload className="h-3.5 w-3.5 text-slate-500" />
                    <span>Upload File</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setBannerUrl(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* 3. Live Preview */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                🖥️ Live Login Card Preview
              </span>
              <div className="border border-slate-300/60 rounded-2xl overflow-hidden shadow-sm bg-white max-w-sm mx-auto">
                {/* Banner preview */}
                <div className="h-24 w-full relative overflow-hidden bg-slate-950">
                  <img 
                    src={bannerUrl} 
                    alt="Custom login background" 
                    className="w-full h-full object-cover opacity-85"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/src/assets/images/workshop_login_bg_1782628838111.jpg';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
                    <span className="text-white text-[8px] font-black uppercase tracking-wider bg-blue-600 px-1.5 py-0.5 rounded shadow">
                      {currentUser.garageName || 'Aero Cars'} Console
                    </span>
                  </div>
                </div>
                {/* Logo and info */}
                <div className="p-3 flex items-center gap-3">
                  <img 
                    src={logoUrl} 
                    alt="Custom logo preview" 
                    className="h-10 w-10 object-contain rounded-lg border border-slate-200 bg-white p-0.5 animate-pulse"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/src/assets/images/aero_logo_1782628818729.jpg';
                    }}
                  />
                  <div>
                    <h4 className="text-xs font-black text-slate-900">{currentUser.garageName || 'Aero Cars'}</h4>
                    <span className="text-[9px] text-slate-500 font-medium">Customized Garage branding active</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              id="btn-save-custom-branding"
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl font-bold text-xs transition cursor-pointer shadow-sm"
            >
              Save Custom Branding Options
            </button>
          </form>
        </div>

        {/* Supabase Cloud Database Connection Console (Owner Only) */}
        {currentUser.role === 'owner' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 font-display">Supabase Cloud Sync Manager</h3>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Cloud Synced
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Connect your local workshop database to a secure, remote <strong>Supabase PostgreSQL Cloud database</strong> to enable automatic multi-device synchronization and staff logins.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const syncUrl = (form.elements.namedItem('syncUrl') as HTMLInputElement).value.trim();
                const syncKey = (form.elements.namedItem('syncKey') as HTMLInputElement).value.trim();

                const updatedUser: AppUser = {
                  ...currentUser,
                  syncUrl,
                  syncKey
                };

                localDB.saveUser(updatedUser);
                localDB.setCurrentUser(updatedUser);
                onUpdateUser(updatedUser);
                alert('Cloud credentials saved! Trigger a sync below to sync your local data.');
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Supabase Project URL
                </label>
                <input
                  id="sync-supabase-url"
                  name="syncUrl"
                  type="url"
                  defaultValue={currentUser.syncUrl || ''}
                  placeholder="https://your-project.supabase.co"
                  className="block w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Supabase Anon Key
                </label>
                <input
                  id="sync-supabase-key"
                  name="syncKey"
                  type="password"
                  defaultValue={currentUser.syncKey || ''}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="block w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs font-mono"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  id="btn-save-sync-creds"
                  type="submit"
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer text-center shadow-sm"
                >
                  Save Credentials
                </button>

                <button
                  id="btn-sync-now"
                  type="button"
                  onClick={async () => {
                    if (!currentUser.syncUrl || !currentUser.syncKey) {
                      alert('Please input and save your Supabase URL & Anon Key first!');
                      return;
                    }
                    const btn = document.getElementById('btn-sync-now') as HTMLButtonElement;
                    const originalText = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerText = 'Syncing...';
                    
                    const res = await syncService.sync(currentUser);
                    setSyncHistory(localDB.getSyncHistory());
                    
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    
                    if (res.success) {
                      alert('Cloud sync completed successfully!');
                    } else {
                      alert(`Cloud sync failed: ${res.message}`);
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Sync Now</span>
                </button>
              </div>
            </form>

            {/* Collapsible Copy SQL Schema */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
              <details className="group">
                <summary className="flex items-center justify-between p-3 cursor-pointer select-none text-[11px] font-bold text-slate-700 hover:bg-slate-100">
                  <span>🛠️ Supabase SQL Schema setup script</span>
                  <ChevronDown className="h-4 w-4 text-slate-500 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="p-3 border-t border-slate-200 space-y-2.5">
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Copy and run this setup script in your <strong>Supabase SQL Editor</strong> to create the necessary table structures:
                  </p>
                  <div className="relative">
                    <pre className="text-[9px] bg-slate-900 text-slate-200 p-2 rounded-lg font-mono overflow-x-auto max-h-40">
{`-- 1. Users Table
create table if not exists users (
  id text primary key,
  email text unique,
  name text,
  phone_number text,
  garage_name text,
  role text,
  category text,
  logo_url text,
  banner_url text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Job Cards Table
create table if not exists job_cards (
  id text primary key,
  jb_number text,
  vehicle_number text,
  name text,
  phone_number text,
  work_rows jsonb,
  total_cost numeric,
  sms_sent boolean,
  sms_text text,
  status text,
  vehicle_photo text,
  created_by text,
  created_by_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Message Logs Table
create table if not exists message_logs (
  id text primary key,
  jb_number text,
  vehicle_number text,
  phone_number text,
  recipient_name text,
  message text,
  timestamp timestamp with time zone default timezone('utc'::text, now()),
  status text
);`}
                    </pre>
                    <button
                      type="button"
                      onClick={() => {
                        const sql = `-- 1. Users Table\ncreate table if not exists users (\n  id text primary key,\n  email text unique,\n  name text,\n  phone_number text,\n  garage_name text,\n  role text,\n  category text,\n  logo_url text,\n  banner_url text,\n  created_at timestamp with time zone default timezone('utc'::text, now())\n);\n\n-- 2. Job Cards Table\ncreate table if not exists job_cards (\n  id text primary key,\n  jb_number text,\n  vehicle_number text,\n  name text,\n  phone_number text,\n  work_rows jsonb,\n  total_cost numeric,\n  sms_sent boolean,\n  sms_text text,\n  status text,\n  vehicle_photo text,\n  created_by text,\n  created_by_id text,\n  created_at timestamp with time zone default timezone('utc'::text, now()),\n  updated_at timestamp with time zone default timezone('utc'::text, now())\n);\n\n-- 3. Message Logs Table\ncreate table if not exists message_logs (\n  id text primary key,\n  jb_number text,\n  vehicle_number text,\n  phone_number text,\n  recipient_name text,\n  message text,\n  timestamp timestamp with time zone default timezone('utc'::text, now()),\n  status text\n);`;
                        navigator.clipboard.writeText(sql);
                        alert('SQL setup script copied to clipboard!');
                      }}
                      className="absolute top-2 right-2 text-[9px] bg-slate-800 hover:bg-slate-700 text-white font-bold py-1 px-1.5 rounded transition cursor-pointer"
                    >
                      Copy Script
                    </button>
                  </div>
                </div>
              </details>
            </div>
          </div>
        )}

        {/* Sync History Logs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-600" />
              <h3 className="font-bold text-slate-800 font-display">Offline & Sync logs</h3>
            </div>
            {syncHistory.length > 0 && (
              <button
                id="btn-clear-synclogs"
                onClick={() => {
                  localStorage.setItem('aerojobs_sync_history', JSON.stringify([]));
                  setSyncHistory([]);
                }}
                className="text-[10px] text-red-500 hover:underline font-bold"
              >
                Clear History
              </button>
            )}
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {syncHistory.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-3">No synchronization activities logged yet.</p>
            ) : (
              syncHistory.map((history) => (
                <div key={history.id} className="text-xs border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-800">{history.action}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${
                      history.status === 'Success' 
                        ? 'bg-emerald-50 text-emerald-600' 
                        : 'bg-red-50 text-red-600'
                    }`}>
                      {history.status}
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed mb-0.5">{history.details}</p>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(history.timestamp).toLocaleTimeString('en-IN', {
                      hour: 'numeric',
                      minute: 'numeric',
                      second: 'numeric'
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
