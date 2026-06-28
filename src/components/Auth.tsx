/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Key, Mail, Phone, Wrench, FileText, CheckCircle2, AlertCircle, Database, RefreshCw } from 'lucide-react';
import { AppUser, JobCard } from '../types';
import { localDB } from '../utils/db';

interface AuthProps {
  onAuthSuccess: (user: AppUser) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Owner Registration Specific
  const [garageName, setGarageName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Supabase Link & Sync Specifics
  const [linkSupabase, setLinkSupabase] = useState(false);
  const [syncUrl, setSyncUrl] = useState('');
  const [syncKey, setSyncKey] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!email || !password) {
      setError('Please fill in all standard credentials.');
      setLoading(false);
      return;
    }

    try {
      let finalUser: AppUser | null = null;
      const cleanInput = email.trim().toLowerCase();
      const digitsInput = email.replace(/\D/g, '');

      if (linkSupabase) {
        if (!syncUrl || !syncKey) {
          setError('Please provide both Supabase Project URL and Anon Key.');
          setLoading(false);
          return;
        }

        setSuccess('Connecting to Supabase and pulling remote database...');
        
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            syncUrl: syncUrl.trim(),
            syncKey: syncKey.trim(),
            localUsers: [],
            unsyncedJobs: [],
            localLogs: [],
            deletedJobIds: []
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Supabase connection failed (HTTP ${response.status})`);
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Supabase sync failed');
        }

        const remoteUsers = result.remoteUsers || [];
        const foundRemoteUser = remoteUsers.find((ru: any) => {
          const cleanEmail = (ru.email || '').trim().toLowerCase();
          const cleanPhone = (ru.phone_number || ru.phoneNumber || '').trim();
          const digitsPhone = cleanPhone.replace(/\D/g, '');

          if (cleanEmail === cleanInput) return true;
          if (cleanPhone === email.trim()) return true;
          if (digitsInput && digitsInput.length >= 5 && digitsPhone === digitsInput) return true;
          return false;
        });

        const localUsers = localDB.getUsers();
        const foundLocalUser = localUsers.find(u => {
          const cleanEmail = u.email.trim().toLowerCase();
          const cleanPhone = u.phoneNumber.trim();
          const digitsPhone = u.phoneNumber.replace(/\D/g, '');

          if (cleanEmail === cleanInput) return true;
          if (cleanPhone === email.trim()) return true;
          if (digitsInput && digitsInput.length >= 5 && digitsPhone === digitsInput) return true;
          return false;
        });

        if (!foundRemoteUser && !foundLocalUser) {
          throw new Error('User account not found on your Supabase remote DB or locally. Please double check credentials or register first.');
        }

        if (foundRemoteUser) {
          finalUser = {
            id: foundRemoteUser.id,
            email: foundRemoteUser.email,
            name: foundRemoteUser.name || 'Owner',
            phoneNumber: foundRemoteUser.phone_number || foundRemoteUser.phoneNumber || '',
            garageName: foundRemoteUser.garage_name || foundRemoteUser.garageName || 'Aero Cars',
            role: foundRemoteUser.role || 'owner',
            category: foundRemoteUser.category || undefined,
            logoUrl: foundRemoteUser.logo_url || foundRemoteUser.logoUrl || undefined,
            bannerUrl: foundRemoteUser.banner_url || foundRemoteUser.bannerUrl || undefined,
            syncUrl: syncUrl.trim(),
            syncKey: syncKey.trim(),
            createdAt: foundRemoteUser.created_at || foundRemoteUser.createdAt || new Date().toISOString()
          };
        } else {
          finalUser = {
            ...foundLocalUser!,
            syncUrl: syncUrl.trim(),
            syncKey: syncKey.trim()
          };
        }

        // Save matched user in database
        localDB.saveUser(finalUser);
        localDB.setCurrentUser(finalUser);

        // Merge all users
        const mergedUsersMap = new Map<string, AppUser>();
        remoteUsers.forEach((ru: any) => {
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
        localUsers.forEach((lu) => {
          const key = lu.email.toLowerCase();
          if (!mergedUsersMap.has(key)) {
            mergedUsersMap.set(key, lu);
          }
        });
        // Save current user in list with credentials
        mergedUsersMap.set(finalUser.email.toLowerCase(), finalUser);
        localStorage.setItem('aerojobs_users', JSON.stringify(Array.from(mergedUsersMap.values())));

        // Merge all jobs
        if (Array.isArray(result.remoteJobs)) {
          const localJobs = localDB.getJobCards();
          const mergedJobsMap = new Map<string, JobCard>();
          
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

          localJobs.forEach((lj) => {
            const remote = mergedJobsMap.get(lj.id);
            if (!remote || new Date(lj.updatedAt).getTime() > new Date(remote.updatedAt).getTime()) {
              mergedJobsMap.set(lj.id, {
                ...lj,
                synced: result.pushedIds?.includes(lj.id) || lj.synced
              });
            }
          });

          localStorage.setItem('aerojobs_job_cards', JSON.stringify(Array.from(mergedJobsMap.values())));
        }

        localDB.addSyncHistory({
          action: 'Supabase Sync during Login',
          status: 'Success',
          details: `Fetched ${result.remoteUsers?.length || 0} remote users and ${result.remoteJobs?.length || 0} remote job cards.`
        });

        setSuccess('Successfully connected Supabase and synchronized all workshop data!');
      } else {
        // Normal Login (without Supabase linking)
        const users = localDB.getUsers();
        const foundUser = users.find(u => {
          const cleanEmail = u.email.trim().toLowerCase();
          const cleanPhone = u.phoneNumber.trim();
          const digitsPhone = u.phoneNumber.replace(/\D/g, '');

          if (cleanEmail === cleanInput) return true;
          if (cleanPhone === email.trim()) return true;
          if (digitsInput && digitsInput.length >= 5 && digitsPhone === digitsInput) return true;
          return false;
        });

        if (!foundUser) {
          setError('User not found. Check email or phone number or register first.');
          setLoading(false);
          return;
        }

        finalUser = { ...foundUser };
        localDB.setCurrentUser(finalUser);
        setSuccess('Logged in offline successfully!');
      }

      setTimeout(() => {
        if (finalUser) {
          onAuthSuccess(finalUser);
        }
      }, 1000);

    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Required fields validation
    if (!garageName || !phoneNumber || !email || !password || !confirmPassword) {
      setError('Please fill in all required fields.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    // Check if email already registered
    const users = localDB.getUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      setError('Email is already registered. Please log in.');
      setLoading(false);
      return;
    }

    try {
      const newOwner: AppUser = {
        id: Math.random().toString(36).substring(2, 11),
        email: email.trim(),
        name: 'Owner', // Owner representation
        phoneNumber: phoneNumber.trim(),
        garageName: garageName.trim(),
        role: 'owner',
        createdAt: new Date().toISOString()
      };

      // Save user locally
      localDB.saveUser(newOwner);
      localDB.setCurrentUser(newOwner);
      setSuccess('Registered offline successfully!');

      setTimeout(() => {
        onAuthSuccess(newOwner);
      }, 1200);

    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const registeredUsers = localDB.getUsers();
  const activeGarageName = registeredUsers.find(u => u.role === 'owner')?.garageName || 'Aero Jobs';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img 
            src={localDB.getGarageLogo()} 
            alt="Aero Job Card Logo" 
            className="h-24 w-24 object-contain rounded-2xl shadow-xl border border-slate-200/60 bg-white p-1"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/src/assets/images/aero_logo_1782628818729.jpg";
            }}
          />
        </div>
        <h2 id="app-title" className="mt-4 text-center text-3xl font-black font-display text-slate-900 tracking-tight">
          {activeGarageName}
        </h2>
        <p className="mt-1 text-center text-sm text-slate-500 font-medium">
          Job Card Entry & Management
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white shadow-xl shadow-slate-200/50 rounded-3xl border border-slate-100 overflow-hidden sm:px-0">
          
          {/* Beautiful Automotive Workshop Banner */}
          <div className="h-44 w-full relative overflow-hidden">
            <img 
              src={localDB.getGarageBanner()} 
              alt="Automotive Workshop Console" 
              className="w-full h-full object-cover select-none"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/src/assets/images/workshop_login_bg_1782628838111.jpg";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent flex items-end p-5">
              <span className="text-white text-[10px] font-black uppercase tracking-wider bg-blue-600 px-2.5 py-1 rounded-md shadow-md shadow-blue-900/30">
                {activeGarageName} Console
              </span>
            </div>
          </div>

          <div className="py-8 px-4 sm:px-10">
          
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded text-sm text-emerald-700 flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {mode === 'login' ? (
            /* LOGIN FORM */
            <form className="space-y-6" onSubmit={handleLogin} id="login-form">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mail ID (Email) or Phone Number
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="login-email"
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
                    placeholder="name@garage.com or 9876543210"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Option to Link & Sync Supabase */}
              <div className="border border-slate-200/60 rounded-xl p-3 bg-slate-50/50 space-y-3 text-left">
                <div className="flex items-center gap-2">
                  <input
                    id="link-supabase-checkbox"
                    type="checkbox"
                    checked={linkSupabase}
                    onChange={(e) => setLinkSupabase(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="link-supabase-checkbox" className="text-xs font-bold text-slate-700 uppercase tracking-wider select-none cursor-pointer flex items-center gap-1">
                    <Database className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
                    Link & Sync Supabase Database
                  </label>
                </div>

                {linkSupabase && (
                  <div className="space-y-3 pt-1 animate-fade-in">
                    <div>
                      <label htmlFor="login-sync-url" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Supabase Project URL
                      </label>
                      <input
                        id="login-sync-url"
                        type="url"
                        required={linkSupabase}
                        value={syncUrl}
                        onChange={(e) => setSyncUrl(e.target.value)}
                        className="block w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs font-mono"
                        placeholder="https://your-project.supabase.co"
                      />
                    </div>
                    <div>
                      <label htmlFor="login-sync-key" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Supabase Anon Key
                      </label>
                      <input
                        id="login-sync-key"
                        type="password"
                        required={linkSupabase}
                        value={syncKey}
                        onChange={(e) => setSyncKey(e.target.value)}
                        className="block w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs font-mono"
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 italic leading-snug">
                      💡 Enter your Supabase credentials to automatically download all your workshop's existing job cards and users from the cloud.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <button
                  id="btn-login"
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 disabled:opacity-55 cursor-pointer"
                >
                  {loading ? 'Logging in...' : 'Sign In'}
                </button>
              </div>
            </form>
          ) : (
            /* OWNER REGISTRATION FORM */
            <form className="space-y-5" onSubmit={handleRegisterOwner} id="register-form">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name Of Garage *
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Wrench className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="reg-garage"
                    type="text"
                    required
                    value={garageName}
                    onChange={(e) => setGarageName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
                    placeholder="Aero Cars Care"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone Number *
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="reg-phone"
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
                    placeholder="9876543210"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mail ID (Owner Email) *
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
                    placeholder="aerocarscare@gmail.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Console Access Password *
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="reg-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm Password *
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="reg-confirm-password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <button
                  id="btn-register"
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 disabled:opacity-55 cursor-pointer"
                >
                  {loading ? 'Creating Account...' : 'Register Garage Owner'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 border-t border-slate-200 pt-6 text-center">
            {mode === 'login' ? (
              <p className="text-sm text-slate-600">
                Are you a garage owner?{' '}
                <button
                  id="switch-to-register"
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className="font-medium text-blue-600 hover:text-blue-500 underline cursor-pointer"
                >
                  Register Garage
                </button>
              </p>
            ) : (
              <p className="text-sm text-slate-600">
                Already have an account?{' '}
                <button
                  id="switch-to-login"
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className="font-medium text-blue-600 hover:text-blue-500 underline cursor-pointer"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>

          {/* Quick info about demo accounts */}
          <div className="mt-4 text-center">
            <span className="text-[11px] text-slate-500 block bg-slate-50/55 py-2 px-3 rounded-xl border border-slate-100">
              ⚡ <strong>Offline-First Security</strong>: Your business records are fully secured on this device. Download JSON backups or Excel sheets anytime from settings!
            </span>
          </div>

        </div>
        </div>
      </div>
    </div>
  );
}
