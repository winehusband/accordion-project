import React, { useReducer, useMemo, useState, useEffect, useRef } from 'react';
import { ChevronDown, Plus, Calendar, AlertTriangle, Download } from 'lucide-react';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';
import * as XLSX from 'xlsx';

// ===================================================================================
// 1. THE ENGINE'S BLUEPRINTS (DATA & LOGIC)
// ===================================================================================

const assetHierarchy = {
  "Digital": { "MailOnline": ["Native Articles", "Sponsored Articles", "High Impact Display"], "Metro": ["Native Articles", "Full Page"], "Newsletter": ["Partner Newsletter"] },
  "Print": { "YOU Magazine": ["Full Page", "Supplement"], "Daily Mail": ["Full Page", "Half Page"], "Metro Print": ["Full Page"] },
  "Video": { "Digital Video": ["EDITS Video", "Paired Partner Content"], "Social Video": ["Instagram Stories", "Facebook Video"] },
  "Mobile": { "MailPlus App": ["Interstitial Ad", "Banner Ad"], "Mobile Web": ["Mobile Banner", "Sticky Banner"] }
};

const taskTemplate = [
  { id: 1, name: "Brief & Asset Approval", team: "Client", duration: 3, offset: 7 },
  { id: 2, name: "Content Creation", team: "MMM", duration: 5, offset: 4 },
  { id: 3, name: "Client Review & Approval", team: "Client", duration: 2, offset: 2 },
  { id: 4, name: "Publishing & Go-Live", team: "MMM", duration: 1, offset: 0 }
];

const initialState = {
  selectedAssets: [],
  timelineConflicts: [],
  showTimeline: false,
};

function appReducer(state, action) {
  switch (action.type) {
    case 'ADD_ASSET': {
      const { category, platform, asset } = action.payload;
      const newAsset = { id: Date.now(), category, platform, asset, goLiveDate: '', tasks: [] };
      return { ...state, selectedAssets: [...state.selectedAssets, newAsset] };
    }
    case 'REMOVE_ASSET':
      return { ...state, selectedAssets: state.selectedAssets.filter(a => a.id !== action.payload) };
    case 'UPDATE_ASSET':
      return {
        ...state,
        selectedAssets: state.selectedAssets.map(asset =>
          asset.id === action.payload.id ? { ...asset, ...action.payload.updates } : asset
        ),
      };
    case 'GENERATE_TIMELINE': {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const conflicts = [];
        const updatedAssets = state.selectedAssets.map(asset => {
          if (!asset.goLiveDate) return { ...asset, tasks: [] };
          const goLive = new Date(asset.goLiveDate);
          const leadTime = Math.ceil((goLive - today) / (1000 * 60 * 60 * 24));
          const requiredLeadTime = taskTemplate.reduce((max, task) => Math.max(max, task.offset + task.duration), 0);
          if (leadTime < requiredLeadTime) {
            conflicts.push({ asset: asset.asset, issue: `Go-live date requires ${requiredLeadTime} days lead time, but only ${leadTime} are available.` });
          }
          const tasks = taskTemplate.map(task => {
            const endDate = new Date(goLive);
            endDate.setDate(goLive.getDate() - task.offset);
            const startDate = new Date(endDate);
            startDate.setDate(endDate.getDate() - task.duration + 1);
            return { ...task, startDate, endDate };
          });
          return { ...asset, tasks };
        });
        return { ...state, selectedAssets: updatedAssets, timelineConflicts: conflicts, showTimeline: true };
    }
    default:
      throw new Error();
  }
}

// ===================================================================================
// 2. UI COMPONENT
// ===================================================================================

const ProjectAccordionUI = ({
  state,
  handleAssetAdd,
  handleAssetUpdate,
  handleAssetRemove,
  handleGenerateTimeline,
  handleExportExcel
}) => {
  const [category, setCategory] = useState('');
  const [platform, setPlatform] = useState('');
  const [asset, setAsset] = useState('');

  const platforms = category ? Object.keys(assetHierarchy[category]) : [];
  const assets = category && platform ? assetHierarchy[category][platform] : [];

  const handleAdd = () => {
    if (category && platform && asset) {
      handleAssetAdd({ category, platform, asset });
      setCategory('');
      setPlatform('');
      setAsset('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-7xl mx-auto p-6">
        <header className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900">Project Timeline Planner</h1>
          <p className="text-slate-600">Build, configure and visualise your campaign schedule</p>
        </header>

        <section className="bg-white p-6 rounded-xl shadow-md mb-10">
          <h2 className="text-xl font-semibold mb-4 text-slate-800">1. Select an Asset</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select value={category} onChange={(e) => { setCategory(e.target.value); setPlatform(''); setAsset(''); }} className="p-2 border rounded-md">
              <option value="">Choose Category...</option>
              {Object.keys(assetHierarchy).map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <select value={platform} onChange={(e) => { setPlatform(e.target.value); setAsset(''); }} disabled={!category} className="p-2 border rounded-md">
              <option value="">Choose Platform...</option>
              {platforms.map(plat => <option key={plat} value={plat}>{plat}</option>)}
            </select>
            <select value={asset} onChange={(e) => setAsset(e.target.value)} disabled={!platform} className="p-2 border rounded-md">
              <option value="">Choose Asset...</option>
              {assets.map(ast => <option key={ast} value={ast}>{ast}</option>)}
            </select>
            <button onClick={handleAdd} disabled={!asset} className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300">
              Add Asset
            </button>
          </div>
        </section>

        {state.selectedAssets.length > 0 && (
          <section className="bg-white p-6 rounded-xl shadow-md mb-10">
            <h2 className="text-xl font-semibold mb-4 text-slate-800">2. Configure Assets</h2>
            <div className="space-y-4">
              {state.selectedAssets.map(asset => (
                <div key={asset.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded-lg bg-slate-50">
                  <div className="mb-2 md:mb-0">
                    <div className="font-semibold text-slate-800">{asset.asset}</div>
                    <div className="text-sm text-slate-600">{asset.category} → {asset.platform}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm">Go-Live Date:</label>
                    <input
                      type="date"
                      value={asset.goLiveDate}
                      onChange={(e) => handleAssetUpdate(asset.id, { goLiveDate: e.target.value })}
                      className="p-2 border rounded-md"
                    />
                    <button onClick={() => handleAssetRemove(asset.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Remove</button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleGenerateTimeline} className="mt-6 bg-green-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-green-700">
              Generate Timeline
            </button>
          </section>
        )}

        {state.showTimeline && (
          <section className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-slate-800">3. View Timeline</h2>
              <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-sm">
                <Download size={16} />
                Export to Excel
              </button>
            </div>
            {state.timelineConflicts.length > 0 && (
              <div className="p-4 mb-4 bg-yellow-100 border border-yellow-400 rounded-lg">
                <div className="text-yellow-800 font-bold flex items-center gap-2">
                  <AlertTriangle size={18} /> Timeline Conflicts
                </div>
                <ul className="mt-2 pl-5 list-disc text-sm text-yellow-700">
                  {state.timelineConflicts.map((conflict, index) => (
                    <li key={index}>{conflict.issue}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="border rounded-md overflow-hidden">
              <GanttChart assets={state.selectedAssets} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

// ===================================================================================
// 3. ENGINE (Container)
// ===================================================================================

const ProjectAccordionEngine = () => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const handleAssetAdd = (asset) => dispatch({ type: 'ADD_ASSET', payload: asset });
  const handleAssetRemove = (id) => dispatch({ type: 'REMOVE_ASSET', payload: id });
  const handleAssetUpdate = (id, updates) => dispatch({ type: 'UPDATE_ASSET', payload: { id, updates } });
  const handleGenerateTimeline = () => dispatch({ type: 'GENERATE_TIMELINE' });

  const handleExportExcel = () => {
    const dataForSheet = [];
    dataForSheet.push(["Asset", "Platform", "Task", "Team", "Start Date", "End Date", "Duration (Days)"]);
    state.selectedAssets.forEach(asset => {
      if (asset.tasks && asset.tasks.length > 0) {
        asset.tasks.forEach(task => {
          dataForSheet.push([
            asset.asset,
            asset.platform,
            task.name,
            task.team,
            task.startDate.toLocaleDateString(),
            task.endDate.toLocaleDateString(),
            task.duration
          ]);
        });
      }
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(dataForSheet);
    XLSX.utils.book_append_sheet(wb, ws, "CampaignTimeline");
    XLSX.writeFile(wb, "ProjectTimeline.xlsx");
  };

  return (
    <ProjectAccordionUI
      state={state}
      handleAssetAdd={handleAssetAdd}
      handleAssetRemove={handleAssetRemove}
      handleAssetUpdate={handleAssetUpdate}
      handleGenerateTimeline={handleGenerateTimeline}
      handleExportExcel={handleExportExcel}
    />
  );
};

export default ProjectAccordionEngine;
