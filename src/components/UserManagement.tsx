/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, UserPlus, Users, ShieldAlert, CheckCircle2, Trash2 } from 'lucide-react';
import { AppUser } from '../types';
import { localDB } from '../utils/db';

interface UserManagementProps {
  currentUser: AppUser;
  onBack: () => void;
}

export default function UserManagement({ currentUser, onBack }: UserManagementProps) {
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [category, setCategory] = useState('Mechanic'); // Staff categories
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Fetch all users in localDB, filter down to staff members of this garage
    const allUsers = localDB.getUsers();
    const staff = allUsers.filter(u => u.role === 'staff' && u.garageName === currentUser.garageName);
    setUsersList(staff);
  }, [currentUser]);

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name || !email || !phoneNumber || !password || !confirmPassword) {
      setError('Please fill in all staff details.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const allUsers = localDB.getUsers();
    if (allUsers.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      setError('Email is already taken by another owner or staff member.');
      return;
    }

    try {
      const newStaff: AppUser = {
        id: Math.random().toString(36).substring(2, 11),
        email: email.trim(),
        name: name.trim(),
        phoneNumber: phoneNumber.trim(),
        garageName: currentUser.garageName, // shares the same garage
        role: 'staff',
        category,
        createdAt: new Date().toISOString()
      };

      localDB.saveUser(newStaff);
      
      // Update local state
      setUsersList([...usersList, newStaff]);
      setSuccess(`Staff account for ${name} (${category}) created successfully!`);
      
      // Reset form
      setName('');
      setEmail('');
      setPhoneNumber('');
      setPassword('');
      setConfirmPassword('');
      setCategory('Mechanic');

    } catch (err: any) {
      setError(err.message || 'Failed to create staff member.');
    }
  };

  const handleDeleteStaff = (emailToDelete: string) => {
    if (window.confirm('Are you sure you want to delete this staff account?')) {
      const allUsers = localDB.getUsers();
      const filtered = allUsers.filter(u => u.email.toLowerCase() !== emailToDelete.toLowerCase());
      localStorage.setItem('aerojobs_users', JSON.stringify(filtered));
      setUsersList(usersList.filter(u => u.email.toLowerCase() !== emailToDelete.toLowerCase()));
      setSuccess('Staff account removed successfully.');
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-16 font-sans">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 flex items-center justify-between z-10">
        <button
          id="btn-usermgmt-back"
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-700 hover:text-blue-600 transition font-medium text-sm cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Dashboard</span>
        </button>
        <h2 className="text-lg font-bold font-display text-slate-900">
          Staff Management
        </h2>
        <div className="w-10"></div>
      </div>

      <div className="max-w-xl mx-auto px-4 mt-6 space-y-6">
        
        {/* Creation Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <UserPlus className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-slate-800 font-display">Create Staff Account</h3>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded text-xs text-red-700 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleCreateStaff} className="space-y-4" id="create-staff-form">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
              <input
                id="staff-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rohan Sharma"
                className="block w-full px-4 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mail ID (Staff Email)</label>
              <input
                id="staff-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rohan@garage.com"
                className="block w-full px-4 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                id="staff-phone"
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="9988776655"
                className="block w-full px-4 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category of User</label>
              <select
                id="staff-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="block w-full px-4 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
              >
                <option value="Mechanic">Mechanic</option>
                <option value="Advisor">Advisor</option>
                <option value="Manager">Garage Manager</option>
                <option value="Electrician">Electrician</option>
                <option value="Helper">Helper</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  id="staff-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full px-4 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                <input
                  id="staff-confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full px-4 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                />
              </div>
            </div>

            <button
              id="btn-save-staff"
              type="submit"
              className="w-full flex items-center justify-center bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 transition font-bold text-xs"
            >
              <span>Register Staff Account</span>
            </button>
          </form>
        </div>

        {/* Existing Users List */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Users className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-slate-800 font-display">Active Staff Members ({usersList.length})</h3>
          </div>

          {usersList.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No staff members registered yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {usersList.map((user) => (
                <div key={user.id} className="py-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{user.name}</h4>
                    <p className="text-xs text-slate-500">{user.email} • {user.phoneNumber}</p>
                    <span className="inline-block mt-1 bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {user.category || 'Staff'}
                    </span>
                  </div>
                  <button
                    id={`btn-delete-staff-${user.id}`}
                    onClick={() => handleDeleteStaff(user.email)}
                    className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
