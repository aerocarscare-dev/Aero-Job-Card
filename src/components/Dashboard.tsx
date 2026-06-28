/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Search, MoreVertical, Plus, ChevronDown, ChevronUp, Phone, User, 
  Settings as SettingsIcon, MessageSquare, BarChart3, LogOut, RefreshCw, 
  CheckCircle, IndianRupee, FileText, ArrowLeft, ChevronLeft, ChevronRight
} from 'lucide-react';
import { JobCard, AppUser } from '../types';
import { localDB } from '../utils/db';

interface DashboardProps {
  currentUser: AppUser;
  onLogout: () => void;
  onNavigate: (view: 'dashboard' | 'create_job' | 'edit_job' | 'user_mgmt' | 'report' | 'msg_log' | 'settings') => void;
  setEditCard: (card: JobCard | null) => void;
}

export default function Dashboard({ currentUser, onLogout, onNavigate, setEditCard }: DashboardProps) {
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [activeTab, setActiveTab] = useState<'All' | 'Open' | 'Active' | 'Done'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Expanded job cards tracker (by ID)
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  
  // Action menu dropdown toggle
  const [menuOpen, setMenuOpen] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const CARDS_PER_PAGE = 50;

  const fetchJobCards = () => {
    setJobCards(localDB.getJobCards());
  };

  useEffect(() => {
    fetchJobCards();
  }, []);

  // Toggle detail expansion for a card
  const toggleExpand = (cardId: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  // Log Out handler
  const handleLogoutAction = () => {
    localDB.setCurrentUser(null);
    onLogout();
  };

  // Filter & Search Logic
  const filteredJobs = jobCards.filter(card => {
    // 1. Tab Operational Filter
    if (activeTab !== 'All' && card.status !== activeTab) {
      return false;
    }
    
    // 2. Text Search Filter (Vehicle Plate, Customer Name, JB Number)
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      return (
        card.jbNumber.toLowerCase().includes(query) ||
        card.vehicleNumber.toLowerCase().includes(query) ||
        card.name.toLowerCase().includes(query) ||
        card.phoneNumber.includes(query)
      );
    }
    
    return true;
  });

  // Reset to first page when tab or search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  const totalPages = Math.ceil(filteredJobs.length / CARDS_PER_PAGE);
  const paginatedJobs = filteredJobs.slice(
    (currentPage - 1) * CARDS_PER_PAGE,
    currentPage * CARDS_PER_PAGE
  );

  return (
    <div className="bg-slate-50 min-h-screen pb-24 font-sans relative">
      
      {/* Top Application Header Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between gap-3 max-w-xl mx-auto min-h-[40px]">
          {!isSearching ? (
            <>
              {/* Logo Title with Image Icon */}
              <div className="animate-fade-in flex items-center gap-2.5">
                <img 
                  src={localDB.getGarageLogo()} 
                  alt="Garage Logo" 
                  className="h-9 w-9 object-contain rounded-xl border border-slate-150 shadow-sm shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/src/assets/images/aero_logo_1782628818729.jpg";
                  }}
                />
                <div>
                  <h1 className="text-lg font-black font-display text-slate-900 tracking-tight flex items-center gap-1.5 leading-tight">
                    <span>{currentUser.garageName || 'Aero Jobs'}</span>
                    {currentUser.role === 'owner' ? (
                      <span className="text-[9px] bg-blue-600 text-white font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                        Owner
                      </span>
                    ) : (
                      <span className="text-[9px] bg-slate-600 text-white font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                        Staff
                      </span>
                    )}
                  </h1>
                  <p className="text-[10px] text-slate-500 font-bold leading-none mt-0.5">
                    {currentUser.garageName}
                  </p>
                </div>
              </div>

              {/* Right actions side */}
              <div className="flex items-center gap-1.5">
                {/* Search icon button */}
                <button
                  id="btn-toggle-search"
                  onClick={() => setIsSearching(true)}
                  className="p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  title="Search Jobs"
                >
                  <Search className="h-5 w-5" />
                </button>

                {/* Three-Dot Menu Options */}
                <div className="relative">
                  <button
                    id="three-dot-menu-toggle"
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>

                  {menuOpen && (
                    <>
                      {/* Overlay backdrop */}
                      <div className="absolute inset-0 z-30" onClick={() => setMenuOpen(false)}></div>
                      
                      {/* Dropdown Card */}
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-40 animate-fade-in font-sans">
                        {currentUser.role === 'owner' ? (
                          <>
                            {/* OWNER OPTIONS */}
                            <button
                              id="menu-opt-user"
                              onClick={() => { onNavigate('user_mgmt'); setMenuOpen(false); }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-600 text-left font-semibold cursor-pointer"
                            >
                              <User className="h-4 w-4 text-slate-400" />
                              <span>Staff Management</span>
                            </button>
                            
                            <button
                              id="menu-opt-report"
                              onClick={() => { onNavigate('report'); setMenuOpen(false); }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-600 text-left font-semibold cursor-pointer"
                            >
                              <BarChart3 className="h-4 w-4 text-slate-400" />
                              <span>Business Report</span>
                            </button>
                          </>
                        ) : null}

                        {/* COMMON OPTIONS */}
                        <button
                          id="menu-opt-msglog"
                          onClick={() => { onNavigate('msg_log'); setMenuOpen(false); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-600 text-left font-semibold cursor-pointer"
                        >
                          <MessageSquare className="h-4 w-4 text-slate-400" />
                          <span>Message Log</span>
                        </button>

                        <button
                          id="menu-opt-settings"
                          onClick={() => { onNavigate('settings'); setMenuOpen(false); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-600 text-left font-semibold cursor-pointer"
                        >
                          <SettingsIcon className="h-4 w-4 text-slate-400" />
                          <span>Settings & Cloud</span>
                        </button>

                        <hr className="border-slate-100 my-1" />

                        <button
                          id="menu-opt-logout"
                          onClick={handleLogoutAction}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-600 hover:bg-red-50 text-left font-bold cursor-pointer"
                        >
                          <LogOut className="h-4 w-4 text-red-400" />
                          <span>Log Out</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Active Search Input with Back/Close Button */
            <div className="flex items-center gap-2 w-full animate-fade-in">
              <button
                id="btn-close-search"
                onClick={() => {
                  setIsSearching(false);
                  setSearchQuery('');
                }}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex-1 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="header-search-bar"
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
                  placeholder="Search Vehicle Plate, Customer, JB..."
                />
              </div>
            </div>
          )}
        </div>
      </div>



      {/* Primary Tab Bar Operational Layout: All, Open, Active, Done */}
      <div className="bg-white border-b border-slate-200 sticky top-[69px] z-10 shadow-sm">
        <div className="grid grid-cols-4 max-w-xl mx-auto text-center font-semibold text-xs text-slate-600">
          {(['All', 'Open', 'Active', 'Done'] as const).map((tab) => {
            const count = tab === 'All' 
              ? jobCards.length 
              : jobCards.filter(j => j.status === tab).length;

            return (
              <button
                key={tab}
                id={`dashboard-tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`py-3 relative flex items-center justify-center gap-1.5 cursor-pointer transition ${
                  activeTab === tab 
                    ? 'text-blue-600 font-bold border-b-2 border-blue-600' 
                    : 'hover:text-slate-900'
                }`}
              >
                <span>{tab}</span>
                <span className={`text-[10px] px-1.5 py-0.1 rounded-full font-bold ${
                  activeTab === tab ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Job Card List */}
      <div className="max-w-xl mx-auto px-4 mt-6 space-y-4">
        {filteredJobs.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500">
            <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-bold text-slate-700">No Job Cards found</p>
            <p className="text-xs text-slate-400 mt-1">
              Click the Royal Blue FAB on the bottom left to create your first card!
            </p>
          </div>
        ) : (
          <>
            {paginatedJobs.map((card) => {
              const isExpanded = !!expandedCards[card.id];
              
              // Format time of creation
              const formattedDate = new Date(card.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              });

              return (
                <div 
                  key={card.id} 
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden"
                >
                  {/* Header Information Always Visible */}
                  <div className="p-4 flex items-center justify-between gap-2 border-b border-slate-50">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm font-black text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg">
                          {card.jbNumber}
                        </span>
                        <span className="font-mono text-sm font-black bg-slate-950 text-white px-2 py-0.5 rounded-lg uppercase">
                          {card.vehicleNumber}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold">
                        Created By: {card.createdBy || 'Unknown'} • {formattedDate}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Status Indicator */}
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${
                        card.status === 'Done' 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                          : card.status === 'Active' 
                          ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                          : 'bg-yellow-50 text-yellow-600 border border-yellow-200'
                      }`}>
                        {card.status === 'Open' ? '📂 Open' : card.status === 'Active' ? '⚙️ Active' : '✅ Done'}
                      </span>

                      {/* Down arrow toggler */}
                      <button
                        id={`btn-toggle-expand-${card.id}`}
                        onClick={() => toggleExpand(card.id)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details section */}
                  {isExpanded && (
                    <div className="bg-slate-50/50 p-4 border-t border-slate-100 space-y-4 animate-fade-in text-slate-800">
                      
                      {/* Customer Info Box */}
                      <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">Customer</span>
                          <span className="text-xs font-semibold text-slate-800 block truncate">{card.name}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">Phone Contact</span>
                          {/* Dial direct link using tel: */}
                          <a
                            id={`dial-phone-${card.id}`}
                            href={`tel:${card.phoneNumber}`}
                            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Phone className="h-3 w-3 shrink-0" />
                            <span className="font-mono">{card.phoneNumber}</span>
                          </a>
                        </div>
                      </div>



                      {/* Work Items List */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase pb-1 border-b border-slate-55">
                          Work Items & Costs Breakdown
                        </span>

                        <div className="divide-y divide-slate-100">
                          {card.workRows.length === 0 ? (
                            <p className="text-xs text-slate-500">No work items described.</p>
                          ) : (
                            card.workRows.map((row) => (
                              <div key={row.id} className="py-1.5 flex justify-between gap-4 text-xs font-medium">
                                <span className="text-slate-700 capitalize leading-relaxed">{row.description}</span>
                                
                                {/* ROLE-BASED PRICE DISPLAY CONSTRAINT FOR STAFF */}
                                {currentUser.role !== 'staff' && (
                                  <span className="font-mono text-slate-900 font-bold shrink-0">
                                    ₹{row.cost.toLocaleString('en-IN')}
                                  </span>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        {/* Total Cost Display with Role Constraints */}
                        {currentUser.role !== 'staff' && (
                          <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                            <strong className="text-slate-800">Total Valuation:</strong>
                            <div className="flex items-center text-blue-600 font-black font-mono text-sm bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100">
                              <IndianRupee className="h-3 w-3" />
                              <span>{card.totalCost.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Quick actions inside card detail */}
                      <div className="flex gap-2 justify-end items-center">
                        {currentUser.role === 'owner' && (
                          <button
                            id={`btn-delete-card-${card.id}`}
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete Job Card ${card.jbNumber}? All other cards will be renumbered continuously.`)) {
                                localDB.deleteJobCard(card.id);
                                fetchJobCards();
                              }
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
                          >
                            Delete Card
                          </button>
                        )}

                        {(currentUser.role === 'owner' || card.status !== 'Done') ? (
                          <button
                            id={`btn-edit-card-${card.id}`}
                            onClick={() => {
                              setEditCard(card);
                              onNavigate('edit_job');
                            }}
                            className="bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
                          >
                            Edit / Update Job Status
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl font-semibold" title="Staff cannot edit done status cards.">
                            🔒 Done jobs are view-only
                          </span>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              );
            })}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-sm animate-fade-in font-sans mt-2">
                <button
                  id="btn-pagination-prev"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 disabled:text-slate-300 disabled:pointer-events-none transition cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4 stroke-[3]" />
                  <span>Prev</span>
                </button>
                
                <span className="text-xs font-bold text-slate-500">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  id="btn-pagination-next"
                  onClick={() => {
                    setCurrentPage(prev => Math.min(prev + 1, totalPages));
                  }}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 disabled:text-slate-300 disabled:pointer-events-none transition cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4 stroke-[3]" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Job Card FAB Icon: Royal Blue background, white plus icon, located RIGHT BOTTOM */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          id="fab-create-jobcard"
          onClick={() => {
            setEditCard(null);
            onNavigate('create_job');
          }}
          className="h-14 w-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-2xl hover:bg-blue-700 transition transform hover:scale-105 active:scale-95 cursor-pointer border-2 border-white"
          title="Create New Job Card"
        >
          <Plus className="h-7 w-7 text-white stroke-[3]" />
        </button>
      </div>

    </div>
  );
}
