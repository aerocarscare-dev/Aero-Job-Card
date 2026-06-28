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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center md:p-6 overflow-hidden select-none relative">
      {/* Background ambient radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 z-0 pointer-events-none"></div>

      {/* Decorative tech grid lines for desktop */}
      <div className="hidden md:block absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35 z-0 pointer-events-none"></div>

      {/* Dynamic preview top headers */}
      <div className="hidden md:flex absolute top-4 left-6 items-center gap-2.5 text-slate-500 font-mono text-[11px] z-20 select-none">
        <img 
          src={localDB.getGarageLogo()} 
          alt="Aero Logo" 
          className="h-5 w-5 object-contain rounded"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/src/assets/images/aero_logo_1782628818729.jpg";
          }}
        />
        <span className="font-bold text-slate-400">{(currentUser?.garageName || 'Aero Cars').toUpperCase()} WORKSHOP CONSOLE</span>
      </div>
      
      <div className="hidden md:flex absolute top-4 right-6 items-center gap-3 text-slate-500 font-mono text-[11px] z-20 select-none">
        <span className="text-blue-400/90 font-semibold bg-blue-950/40 border border-blue-900/40 px-2 py-0.5 rounded">PREVIEW MODEL: 9*16</span>
        <span>|</span>
        <span>RATIO: 390x844 (iPhone 15)</span>
      </div>

      {/* Smartphone Device Frame Mockup */}
      <div className="w-full h-screen md:h-[844px] md:w-[390px] bg-slate-900 md:rounded-[48px] md:border-[12px] md:border-slate-800 md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] md:ring-4 md:ring-slate-700/30 overflow-hidden relative flex flex-col z-10 transition-all duration-300">
        
        {/* Notch dynamic island overlay */}
        <div className="hidden md:block absolute top-2 left-1/2 transform -translate-x-1/2 w-28 h-6 bg-slate-950 rounded-full z-50 shadow-inner">
          <div className="flex justify-between items-center px-4 h-full">
            <div className="w-1.5 h-1.5 bg-slate-900 rounded-full"></div>
            <div className="w-8 h-1 bg-slate-900 rounded-full"></div>
            <div className="w-2.5 h-2.5 bg-slate-900/60 rounded-full flex items-center justify-center">
              <div className="w-1 h-1 bg-blue-950 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Dynamic status bar for device on desktop */}
        <div className="hidden md:flex justify-between items-center px-6 pt-3 pb-2 text-[11px] text-slate-600 font-mono font-bold bg-white select-none z-30 border-b border-slate-50">
          <span>09:41</span>
          <div className="flex items-center gap-1.5">
            <span>5G</span>
            <div className="w-5 h-2.5 border border-slate-400 rounded-sm p-0.5 flex items-center">
              <div className="h-full w-4 bg-slate-600 rounded-2xs"></div>
            </div>
          </div>
        </div>

        {/* Main interactive viewport wrapper inside the mockup */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 relative flex flex-col">
          {renderAppContent()}
        </div>
      </div>
    </div>
  );
}
