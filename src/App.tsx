/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppUser, JobCard } from './types';
import { localDB } from './utils/db';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import CreateJobCard from './components/CreateJobCard';
import UserManagement from './components/UserManagement';
import BusinessReport from './components/BusinessReport';
import MessageLog from './components/MessageLog';
import Settings from './components/Settings';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [view, setView] = useState<'dashboard' | 'create_job' | 'edit_job' | 'user_mgmt' | 'report' | 'msg_log' | 'settings'>('dashboard');
  const [editCard, setEditCard] = useState<JobCard | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for active login session on mount
  useEffect(() => {
    const user = localDB.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
    setLoading(false);
  }, []);

  const handleAuthSuccess = (user: AppUser) => {
    setCurrentUser(user);
    setView('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('dashboard');
    setEditCard(null);
  };

  const handleSaveJob = () => {
    setView('dashboard');
    setEditCard(null);
  };

  const renderAppContent = () => {
    if (!currentUser) {
      return <Auth onAuthSuccess={handleAuthSuccess} />;
    }

    return (
      <>
        {view === 'dashboard' && (
          <Dashboard
            currentUser={currentUser}
            onLogout={handleLogout}
            onNavigate={setView}
            setEditCard={setEditCard}
          />
        )}

        {view === 'create_job' && (
          <CreateJobCard
            currentUser={currentUser}
            onBack={() => setView('dashboard')}
            onSave={handleSaveJob}
          />
        )}

        {view === 'edit_job' && (
          <CreateJobCard
            currentUser={currentUser}
            editCard={editCard}
            onBack={() => { setView('dashboard'); setEditCard(null); }}
            onSave={handleSaveJob}
          />
        )}

        {view === 'user_mgmt' && (
          <UserManagement
            currentUser={currentUser}
            onBack={() => setView('dashboard')}
          />
        )}

        {view === 'report' && (
          <BusinessReport
            onBack={() => setView('dashboard')}
          />
        )}

        {view === 'msg_log' && (
          <MessageLog
            onBack={() => setView('dashboard')}
          />
        )}

        {view === 'settings' && (
          <Settings
            currentUser={currentUser}
            onUpdateUser={setCurrentUser}
            onBack={() => setView('dashboard')}
          />
        )}
      </>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans">
        <div className="text-center space-y-2">
          <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-semibold text-slate-400">Loading Aero Jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative w-full overflow-x-hidden">
      {/* Ambient top decoration */}
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-slate-100 to-transparent z-0 pointer-events-none"></div>

      {/* Main interactive view port */}
      <div className="flex-1 flex flex-col relative z-10 w-full">
        {renderAppContent()}
      </div>
    </div>
  );
}
