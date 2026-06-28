/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Camera, Check, ArrowLeft, MessageSquare, Copy, ExternalLink, IndianRupee } from 'lucide-react';
import { JobCard, WorkRow, AppUser, MessageTemplate } from '../types';
import { localDB } from '../utils/db';

interface CreateJobCardProps {
  currentUser: AppUser;
  editCard?: JobCard | null;
  onBack: () => void;
  onSave: () => void;
}

export default function CreateJobCard({ currentUser, editCard, onBack, onSave }: CreateJobCardProps) {
  const [jbNumber, setJbNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [workRows, setWorkRows] = useState<WorkRow[]>([{ id: '1', description: '', cost: 0 }]);
  const [status, setStatus] = useState<'Open' | 'Active' | 'Done'>('Open');
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  
  const [isCopyingSms, setIsCopyingSms] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const [matchingVehicles, setMatchingVehicles] = useState<{ vehicleNumber: string; name: string }[]>([]);

  // Message template integration states
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [customSmsText, setCustomSmsText] = useState<string>('');

  // Load message templates
  useEffect(() => {
    const loadedTemplates = localDB.getMessageTemplates();
    setTemplates(loadedTemplates);
    if (loadedTemplates.length > 0) {
      // Intelligently auto-match template based on job status if possible
      let initialTplId = 'tpl-general';
      if (status === 'Done') {
        initialTplId = 'tpl-ready';
      } else if (status === 'Active') {
        initialTplId = 'tpl-estimate';
      }
      
      const foundTpl = loadedTemplates.find(t => t.id === initialTplId) || loadedTemplates[0];
      setSelectedTemplateId(foundTpl.id);
    }
  }, []);

  // Effect to find matching vehicles when phoneNumber changes for multi-vehicle support
  useEffect(() => {
    const cleanPhone = phoneNumber.trim();
    if (cleanPhone.length >= 3) {
      const cards = localDB.getJobCards();
      const matches: { vehicleNumber: string; name: string }[] = [];
      const seenVehicles = new Set<string>();
      
      // Look up previous job cards with this phone number
      const reversedCards = [...cards].reverse();
      for (const card of reversedCards) {
        if (card.phoneNumber.trim() === cleanPhone) {
          const vehicleKey = card.vehicleNumber.trim().toUpperCase();
          if (!seenVehicles.has(vehicleKey)) {
            seenVehicles.add(vehicleKey);
            matches.push({
              vehicleNumber: card.vehicleNumber,
              name: card.name
            });
          }
        }
      }
      setMatchingVehicles(matches);
      
      // Auto-fill customer name if it's currently empty and we found a match
      if (matches.length > 0 && !name.trim()) {
        setName(matches[0].name);
      }
    } else {
      setMatchingVehicles([]);
    }
  }, [phoneNumber]);

  // Load either existing card for edit or auto-generate next JB number for create
  useEffect(() => {
    if (editCard) {
      setJbNumber(editCard.jbNumber);
      setVehicleNumber(editCard.vehicleNumber);
      setName(editCard.name);
      setPhoneNumber(editCard.phoneNumber);
      setWorkRows(editCard.workRows.length > 0 ? editCard.workRows : [{ id: '1', description: '', cost: 0 }]);
      setStatus(editCard.status);
      setVehiclePhoto(editCard.vehiclePhoto);
    } else {
      setJbNumber(localDB.getNextJbNumber());
    }
  }, [editCard]);

  // Calculate dynamic total cost
  const totalCost = workRows.reduce((sum, row) => sum + (Number(row.cost) || 0), 0);

  // Helper to compile template placeholders dynamically
  const compileTemplateText = (content: string) => {
    return content
      .replace(/{customer}/g, name.trim() || '[Customer Name]')
      .replace(/{vehicle}/g, vehicleNumber.trim().toUpperCase() || '[Vehicle Number]')
      .replace(/{jbNumber}/g, jbNumber)
      .replace(/{status}/g, status === 'Open' ? 'Open' : status === 'Active' ? 'Active' : 'Done')
      .replace(/{totalCost}/g, String(totalCost))
      .replace(/{garage}/g, currentUser.garageName || 'Garage');
  };

  // Compile selected template when fields or template changes
  useEffect(() => {
    if (selectedTemplateId && templates.length > 0) {
      const activeTpl = templates.find(t => t.id === selectedTemplateId);
      if (activeTpl) {
        setCustomSmsText(compileTemplateText(activeTpl.content));
      }
    }
  }, [selectedTemplateId, templates, name, vehicleNumber, jbNumber, status, totalCost]);

  // Add a new row for work descriptions
  const handleAddRow = () => {
    const newId = Math.random().toString(36).substring(2, 9);
    setWorkRows([...workRows, { id: newId, description: '', cost: 0 }]);
  };

  // Remove a work description row
  const handleRemoveRow = (id: string) => {
    if (workRows.length === 1) return; // Always keep at least one row
    setWorkRows(workRows.filter(row => row.id !== id));
  };

  // Update specific work row field
  const handleUpdateRow = (id: string, field: 'description' | 'cost', value: string | number) => {
    setWorkRows(
      workRows.map(row => {
        if (row.id === id) {
          return {
            ...row,
            [field]: field === 'cost' ? Number(value) || 0 : value,
          };
        }
        return row;
      })
    );
  };

  // Handle Photo Attachment with base64 compression using canvas
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Shrink the image to an optimal size to stay within localStorage constraints
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const base64Str = canvas.toDataURL('image/jpeg', 0.7); // compress to 70% quality JPEG
          setVehiclePhoto(base64Str);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Format SMS Copy Message
  const generateSmsText = () => {
    const itemsText = workRows
      .filter(row => row.description)
      .map(row => `- ${row.description}: Rs.${row.cost}`)
      .join('\n');

    return `*AERO JOBS - ${currentUser.garageName || 'Garage'}*\n` +
      `Job Card: ${jbNumber}\n` +
      `Vehicle: ${vehicleNumber}\n` +
      `Status: ${status}\n` +
      (itemsText ? `Work Details:\n${itemsText}\n` : '') +
      `Estimated Cost: INR ${totalCost}\n` +
      `Phone: ${phoneNumber}\n` +
      `Thank you for choosing us! Please contact us for details.`;
  };

  // Launch Local SMS App & copy to clipboard to make copy-pasting incredibly simple
  const handleSmsAction = () => {
    const text = customSmsText || generateSmsText();
    
    // Copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 3000);
    });

    // Save message sending activity
    localDB.saveMessageLog({
      id: Math.random().toString(36).substring(2, 9),
      jbNumber,
      vehicleNumber,
      phoneNumber,
      recipientName: name,
      message: text,
      timestamp: new Date().toISOString(),
      status: 'Sent'
    });

    // Create custom local URI protocol link
    const encodedText = encodeURIComponent(text);
    const smsUri = `sms:${phoneNumber}?body=${encodedText}`;
    
    // Trigger local SMS protocol
    window.location.href = smsUri;
  };

  // Save Job Card to database
  const handleSaveJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNumber.trim() || !name.trim() || !phoneNumber.trim()) {
      alert('Please fill out Vehicle Number, Customer Name, and Phone Number.');
      return;
    }

    const jobCardData: JobCard = {
      id: editCard?.id || Math.random().toString(36).substring(2, 11),
      jbNumber,
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      name: name.trim(),
      phoneNumber: phoneNumber.trim(),
      workRows: workRows.filter(row => row.description.trim() !== ''),
      totalCost,
      smsSent: editCard?.smsSent || false,
      smsText: customSmsText || generateSmsText(),
      status,
      vehiclePhoto,
      createdBy: currentUser.name || 'Owner',
      createdById: currentUser.id,
      createdAt: editCard?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      synced: false, // Mark for cloud synchronization
    };

    localDB.saveJobCard(jobCardData);
    onSave();
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-16 font-sans">
      {/* Top Header Navigation */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 flex items-center justify-between z-10">
        <button
          id="btn-back-to-dashboard"
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-700 hover:text-blue-600 transition font-medium text-sm cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>
        <h2 className="text-lg font-bold font-display text-slate-900">
          {editCard ? `Edit Job Card ${jbNumber}` : `New Job Card ${jbNumber}`}
        </h2>
        <div className="w-10"></div> {/* Spacer to center heading */}
      </div>

      <div className="max-w-xl mx-auto px-4 mt-6">
        <form onSubmit={handleSaveJob} className="space-y-6" id="job-card-form">
          
          {/* Customer & Vehicle Info Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-2 font-display">
              Primary Vehicle & Customer Details
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vehicle Plate Number *
              </label>
              <input
                id="form-vehicle-number"
                type="text"
                required
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="KA-03-HA-1234"
                className="block w-full px-4 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm uppercase font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Name *
              </label>
              <input
                id="form-customer-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ramesh Kumar"
                className="block w-full px-4 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Phone Number *
              </label>
              <input
                id="form-customer-phone"
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="9876543210"
                className="block w-full px-4 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-mono"
              />

              {/* Multi-vehicle search matching list */}
              {matchingVehicles.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50/70 border border-blue-100 rounded-xl animate-fade-in">
                  <span className="block text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-2">
                    🚗 Registered Vehicles under this Phone ({matchingVehicles.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {matchingVehicles.map((v, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setVehicleNumber(v.vehicleNumber);
                          setName(v.name);
                        }}
                        className="text-xs bg-white hover:bg-blue-600 hover:text-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <span>{v.vehicleNumber}</span>
                        <span className="font-normal font-sans text-slate-500 text-[10px]">({v.name})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dynamic Work Rows Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider font-display">
                Work Descriptions & Estimations
              </h3>
              <button
                id="btn-add-description-row"
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition text-xs font-semibold cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Row</span>
              </button>
            </div>

            <div className="space-y-3">
              {workRows.map((row, index) => (
                <div key={row.id} className="flex gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex-1">
                    <input
                      id={`work-desc-${row.id}`}
                      type="text"
                      placeholder="e.g. Engine Oil Replacement"
                      value={row.description}
                      onChange={(e) => handleUpdateRow(row.id, 'description', e.target.value)}
                      className="block w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                  <div className="w-24 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                      <IndianRupee className="h-3 w-3 text-slate-400" />
                    </div>
                    <input
                      id={`work-cost-${row.id}`}
                      type="number"
                      placeholder="Cost"
                      value={row.cost || ''}
                      onChange={(e) => handleUpdateRow(row.id, 'cost', e.target.value)}
                      className="block w-full pl-6 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono text-right"
                    />
                  </div>
                  {workRows.length > 1 && (
                    <button
                      id={`btn-remove-row-${row.id}`}
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition shrink-0 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Total display */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-700">Estimated Total:</span>
              <div className="flex items-center text-slate-900 font-bold font-mono text-base">
                <IndianRupee className="h-4 w-4 text-slate-800" />
                <span>{totalCost.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Job Status Option */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider font-display">
              Job Operational Status
            </h3>
            <div className="grid grid-cols-3 gap-2.5">
              {(['Open', 'Active', 'Done'] as const).map((s) => (
                <button
                  key={s}
                  id={`status-selector-${s}`}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`py-2.5 px-4 text-xs font-bold rounded-xl border text-center transition cursor-pointer ${
                    status === s
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {s === 'Open' ? '📂 Open' : s === 'Active' ? '⚙️ Active' : '✅ Done'}
                </button>
              ))}
            </div>
          </div>

          {/* Vehicle Optional Photo Upload removed */}
          <div className="hidden">
            <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider font-display">
              Vehicle Inspection Photo (Optional)
            </h3>
            
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl p-4 bg-slate-50 hover:bg-slate-100/55 transition relative overflow-hidden min-h-[140px]">
              {vehiclePhoto ? (
                <div className="w-full relative flex flex-col items-center">
                  <img
                    src={vehiclePhoto}
                    alt="Vehicle preview"
                    className="max-h-48 object-cover rounded-xl"
                  />
                  <button
                    id="btn-remove-photo"
                    type="button"
                    onClick={() => setVehiclePhoto(null)}
                    className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full shadow hover:bg-red-700 transition cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-2 w-full h-full py-4 text-center">
                  <Camera className="h-10 w-10 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-700">Capture or Upload Inspection Image</span>
                  <span className="text-[10px] text-slate-400">JPEG, PNG accepted (auto-optimized)</span>
                  <input
                    id="upload-vehicle-photo"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
                {/* Send SMS Actions */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <MessageSquare className="h-4.5 w-4.5 text-blue-600" />
                <span>Send SMS Updates</span>
              </h3>
              <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Local SMS App Protocol</span>
            </div>
            
            <p className="text-[11px] text-slate-500 leading-normal">
              Choose a message template, inspect or customize the compiled text, then copy and launch your native SMS client instantly.
            </p>

            {/* Template Dropdown */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Select Message Template
              </label>
              <select
                id="select-sms-template"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full text-xs font-semibold border border-slate-200 px-3 py-2 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 transition cursor-pointer"
              >
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Editable Draft Area */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  SMS Text Message Draft (Editable)
                </label>
                <span className="text-[9px] text-slate-400 font-mono font-medium">
                  {customSmsText.length} characters
                </span>
              </div>
              <textarea
                id="textarea-sms-draft"
                rows={4}
                value={customSmsText}
                onChange={(e) => setCustomSmsText(e.target.value)}
                className="w-full text-xs font-medium border border-slate-200 px-3 py-2.5 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 transition font-mono leading-relaxed"
                placeholder="SMS content will appear here..."
              />
            </div>

            <button
              id="btn-sms-trigger"
              type="button"
              onClick={handleSmsAction}
              className="w-full flex items-center justify-center gap-2 bg-slate-950 text-white py-2.5 rounded-xl hover:bg-slate-800 transition text-xs font-bold cursor-pointer"
            >
              <Copy className="h-4 w-4" />
              <span>{copiedText ? 'Copied! Launching SMS App...' : 'Copy Draft & Launch SMS App'}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>      </div>

          {/* Form Save Button */}
          <div className="pt-2">
            <button
              id="btn-save-jobcard"
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition font-bold text-sm shadow-md shadow-blue-100 cursor-pointer"
            >
              <Check className="h-5 w-5" />
              <span>Save Job Card Details</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
