/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Key, Mail, Phone, Wrench, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { AppUser } from '../types';
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
      const users = localDB.getUsers();
      // Find matching user (email-based or phone-based)
      const cleanInput = email.trim().toLowerCase();
      const digitsInput = email.replace(/\D/g, '');

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

      // Store in current session
      const updatedUser = { ...foundUser };
      localDB.setCurrentUser(updatedUser);
      setSuccess('Logged in offline successfully!');

      setTimeout(() => {
        onAuthSuccess(updatedUser);
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
          Job Card Entry & Real-time Cloud Synchronizer
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
