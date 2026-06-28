/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, MessageSquare, Search, Trash2, MailCheck } from 'lucide-react';
import { MessageLog as MsgLogType } from '../types';
import { localDB } from '../utils/db';

interface MessageLogProps {
  onBack: () => void;
}

export default function MessageLog({ onBack }: MessageLogProps) {
  const [logs, setLogs] = useState<MsgLogType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setLogs(localDB.getMessageLogs());
  }, []);

  const handleClearLogs = () => {
    if (window.confirm('Are you sure you want to clear the message logs history?')) {
      localStorage.setItem('aerojobs_message_logs', JSON.stringify([]));
      setLogs([]);
    }
  };

  const filteredLogs = logs.filter(log => 
    log.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.jbNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.phoneNumber.includes(searchTerm) ||
    log.recipientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-slate-50 min-h-screen pb-16 font-sans">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 flex items-center justify-between z-10">
        <button
          id="btn-msglog-back"
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-700 hover:text-blue-600 transition font-medium text-sm cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Dashboard</span>
        </button>
        <h2 className="text-lg font-bold font-display text-slate-900">
          Message Log
        </h2>
        {logs.length > 0 ? (
          <button
            id="btn-clear-msglogs"
            onClick={handleClearLogs}
            className="text-xs text-red-600 hover:text-red-800 font-bold transition flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear</span>
          </button>
        ) : (
          <div className="w-10"></div>
        )}
      </div>

      <div className="max-w-xl mx-auto px-4 mt-6 space-y-4">
        
        {/* Search Bar */}
        <div className="relative rounded-xl shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            id="search-msglogs"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
            placeholder="Search by JB Number, Phone or Vehicle..."
          />
        </div>

        {/* Logs List */}
        <div className="space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
              <MessageSquare className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No matching message logs found</p>
              <p className="text-xs text-slate-400 mt-1">SMS copy triggers will log customer communications here.</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">
                      {log.jbNumber}
                    </span>
                    <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md uppercase">
                      {log.vehicleNumber}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(log.timestamp).toLocaleString('en-IN', {
                      hour: 'numeric',
                      minute: 'numeric',
                      day: 'numeric',
                      month: 'short'
                    })}
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <p>
                    <strong className="text-slate-800">Recipient:</strong> {log.recipientName} ({log.phoneNumber})
                  </p>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-mono text-[11px] whitespace-pre-wrap text-slate-700 leading-relaxed max-h-32 overflow-y-auto">
                    {log.message}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold uppercase tracking-wider pt-1">
                  <MailCheck className="h-3.5 w-3.5" />
                  <span>Drafted & Copied Successfully</span>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
