/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, FileSpreadsheet, IndianRupee, Briefcase, TrendingUp, Filter, Search } from 'lucide-react';
import { JobCard, WorkRow } from '../types';
import { localDB } from '../utils/db';

interface BusinessReportProps {
  onBack: () => void;
}

type PeriodFilter = 'All' | 'Today' | 'Week' | 'Month' | 'Custom';
type GroupFilter = 'All' | 'Work';

export default function BusinessReport({ onBack }: BusinessReportProps) {
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [period, setPeriod] = useState<PeriodFilter>('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [group, setGroup] = useState<GroupFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setJobCards(localDB.getJobCards());
  }, []);

  // Filter job cards by date
  const getFilteredCards = (): JobCard[] => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // Start of current week (Sunday or Monday)
    const currentDay = now.getDay();
    const weekStart = new Date(now.setDate(now.getDate() - currentDay)).setHours(0,0,0,0);
    
    // Start of current month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return jobCards.filter(card => {
      const cardTime = new Date(card.createdAt).getTime();

      // Time period filters
      if (period === 'Today') {
        return cardTime >= todayStart;
      } else if (period === 'Week') {
        return cardTime >= weekStart;
      } else if (period === 'Month') {
        return cardTime >= monthStart;
      } else if (period === 'Custom') {
        const start = fromDate ? new Date(fromDate).setHours(0,0,0,0) : 0;
        // Include full day for toDate by setting hours to 23:59:59
        const end = toDate ? new Date(toDate).setHours(23,59,59,999) : Infinity;
        return cardTime >= start && cardTime <= end;
      }
      return true; // All
    });
  };

  const filteredCards = getFilteredCards();

  // Metric computations
  const totalJobs = filteredCards.length;
  const completedJobs = filteredCards.filter(c => c.status === 'Done').length;
  const activeJobs = filteredCards.filter(c => c.status === 'Active').length;
  const openJobs = filteredCards.filter(c => c.status === 'Open').length;
  
  const totalRevenue = filteredCards.reduce((sum, c) => sum + c.totalCost, 0);
  const avgTicketValue = totalJobs > 0 ? Math.round(totalRevenue / totalJobs) : 0;

  // Extract individual work row descriptions and costs
  const getWorkItemsBreakdown = () => {
    const list: Array<{ jbNumber: string; vehicleNumber: string; description: string; cost: number; date: string }> = [];
    filteredCards.forEach(card => {
      card.workRows.forEach(row => {
        list.push({
          jbNumber: card.jbNumber,
          vehicleNumber: card.vehicleNumber,
          description: row.description,
          cost: row.cost,
          date: card.createdAt
        });
      });
    });
    return list;
  };

  const workItems = getWorkItemsBreakdown();

  // Search filtered results
  const searchedCards = filteredCards.filter(c => 
    c.jbNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const searchedWorkItems = workItems.filter(item =>
    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.jbNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-slate-50 min-h-screen pb-16 font-sans">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 flex items-center justify-between z-10">
        <button
          id="btn-report-back"
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-700 hover:text-blue-600 transition font-medium text-sm cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Dashboard</span>
        </button>
        <h2 className="text-lg font-bold font-display text-slate-900">
          Garage Business Report
        </h2>
        <div className="w-10"></div>
      </div>

      <div className="max-w-xl mx-auto px-4 mt-6 space-y-6">
        
        {/* Date Filter & Group Selection Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Filter className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800 font-display">Report Filtering Controls</h3>
          </div>

          {/* Primary Period Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Select Period Interval</label>
            <div className="grid grid-cols-5 gap-1.5 bg-slate-100 p-1 rounded-xl">
              {(['All', 'Today', 'Week', 'Month', 'Custom'] as const).map((p) => (
                <button
                  key={p}
                  id={`period-btn-${p}`}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`py-1.5 rounded-lg text-[11px] font-bold text-center transition cursor-pointer ${
                    period === p
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Picker Fields */}
          {period === 'Custom' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 animate-fade-in">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">FROM DATE</label>
                <input
                  id="filter-from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="block w-full px-2.5 py-1 border border-slate-300 rounded-lg text-xs bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">TO DATE</label>
                <input
                  id="filter-to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="block w-full px-2.5 py-1 border border-slate-300 rounded-lg text-xs bg-white text-slate-900"
                />
              </div>
            </div>
          )}

          {/* Secondary Group/Breakdown Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Breakdown Output View</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="btn-group-all"
                type="button"
                onClick={() => setGroup('All')}
                className={`py-2 px-4 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                  group === 'All'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                📁 All Job Cards (Total Cost)
              </button>
              <button
                id="btn-group-work"
                type="button"
                onClick={() => setGroup('Work')}
                className={`py-2 px-4 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                  group === 'Work'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                🛠️ Individual Work Rows & Cost
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Metric Dashboard Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <IndianRupee className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Total revenue</span>
              <span className="text-lg font-black font-mono text-slate-900">
                ₹{totalRevenue.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
            <div className="p-2.5 bg-slate-50 text-slate-700 rounded-xl">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Avg Ticket</span>
              <span className="text-lg font-black font-mono text-slate-900">
                ₹{avgTicketValue.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Minimalist Funnel Counters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm grid grid-cols-4 gap-2 text-center divide-x divide-slate-100">
          <div>
            <span className="text-xs font-bold text-slate-900 block font-mono">{totalJobs}</span>
            <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Total jobs</span>
          </div>
          <div>
            <span className="text-xs font-bold text-yellow-600 block font-mono">{openJobs}</span>
            <span className="text-[9px] text-yellow-500 uppercase tracking-wider font-semibold">Open</span>
          </div>
          <div>
            <span className="text-xs font-bold text-blue-600 block font-mono">{activeJobs}</span>
            <span className="text-[9px] text-blue-500 uppercase tracking-wider font-semibold">Active</span>
          </div>
          <div>
            <span className="text-xs font-bold text-emerald-600 block font-mono">{completedJobs}</span>
            <span className="text-[9px] text-emerald-500 uppercase tracking-wider font-semibold">Done</span>
          </div>
        </div>

        {/* Result Output List */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1.5">
              <FileSpreadsheet className="h-5 w-5 text-blue-600" />
              <h4 className="font-bold text-slate-800 font-display">
                {group === 'All' ? 'Compiled Job Card Ledger' : 'Itemized Job Work Ledger'}
              </h4>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {group === 'All' ? searchedCards.length : searchedWorkItems.length} records
            </span>
          </div>

          {/* Search bar inside output */}
          <div className="relative rounded-xl">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <input
              id="report-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 text-xs"
              placeholder={group === 'All' ? 'Search by Plate, Name, Job Card...' : 'Search work description...'}
            />
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {group === 'All' ? (
              searchedCards.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No job records found for this period.</p>
              ) : (
                searchedCards.map((card) => (
                  <div key={card.id} className="flex justify-between items-center border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-blue-600">{card.jbNumber}</span>
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase">{card.vehicleNumber}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {card.name} • {new Date(card.createdAt).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-bold text-slate-900 block">
                        ₹{card.totalCost.toLocaleString('en-IN')}
                      </span>
                      <span className={`inline-block text-[9px] font-bold uppercase ${
                        card.status === 'Done' ? 'text-emerald-600' : card.status === 'Active' ? 'text-blue-500' : 'text-yellow-600'
                      }`}>
                        {card.status}
                      </span>
                    </div>
                  </div>
                ))
              )
            ) : (
              searchedWorkItems.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No itemized work records found for this period.</p>
              ) : (
                searchedWorkItems.map((item, index) => (
                  <div key={index} className="flex justify-between items-center border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                    <div>
                      <h5 className="text-xs font-semibold text-slate-800 capitalize leading-relaxed">{item.description}</h5>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {item.jbNumber} • {item.vehicleNumber} • {new Date(item.date).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-900 shrink-0 ml-4">
                      ₹{item.cost.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              )
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
