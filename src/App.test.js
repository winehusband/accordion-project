import React, { useReducer, useMemo, useState, useEffect, useRef } from 'react';
import { ChevronDown, Plus, Calendar, AlertTriangle, Download } from 'lucide-react';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';

// We will need to install this new library for Excel export
import * as XLSX from 'xlsx';

// ===================================================================================
// 1. THE ENGINE'S BLUEPRINTS (DATA & LOGIC)
// ===================================================================================

const assetHierarchy = {
    "Digital": {
      "MailOnline": [ "Native Articles", "Sponsored Articles", "High Impact Display", "Retargeting Campaign", "Homepage Takeover", "EDITS Video" ],
      "Metro": [ "Native Articles", "Full Page", "Sponsored Content", "Digital Display" ],
      "Newsletter": [ "Partner Newsletter", "Travel Database", "Subscriber Campaign" ]
    },
    "Print": {
      "YOU Magazine": [ "Full Page", "16 Page Insert", "Bound-in Insert", "Supplement" ],
      "Daily Mail": [ "Full Page", "Half Page", "Sponsored Content" ],
      "Metro Print": [ "Full Page", "Half Page", "Editorial Content" ]
    },
    "Video": {
      "Digital Video": [ "EDITS Video", "Paired Partner Content", "Distribution Package", "Auto-play Video" ],
      "Social Video": [ "Instagram Stories", "Facebook Video", "LinkedIn Video" ]
    },
    "Mobile": {
      "MailPlus App": [ "Interstitial Ad", "Banner Ad", "Sponsored Content" ],
      "Mobile Web": [ "Mobile Banner", "Edge2Edge", "Sticky Banner" ]
    }
};

const taskTemplate = [
  { id: 1, name: "Brief & Asset Approval", team: "Client", duration: 3 },
  { id: 2, name: "Content Creation", team: "MMM", duration: 5 },
  { id: 3, name: "Client Review & Approval", team: "Client", duration: 2 },
  { id: 4, name: "Publishing & Go-Live", team: "MMM", duration: 1 }
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
      const newAsset = { id: Date.now(), category, platform, asset, startDate: '', tasks: [] };
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
          if (!asset.startDate) return { ...asset, tasks: [] };
          const campaignStartDate = new Date(asset.startDate);
          if (campaignStartDate < today) {
            conflicts.push({ asset: asset.asset, issue: `The selected start date is in the past.` });
          }
          const tasks = [];
          let currentDate = new Date(campaignStartDate);
          taskTemplate.forEach(taskInfo => {
            const taskStartDate = new Date(currentDate);
            const taskEndDate = new Date(taskStartDate);
            taskEndDate.setDate(taskStartDate.getDate() + taskInfo.duration - 1);
            tasks.push({ ...taskInfo, startDate: taskStartDate, endDate: taskEndDate });
            currentDate.setDate(taskEndDate.getDate() + 1);
            if (currentDate.getDay() === 6) { currentDate.setDate(currentDate.getDate() + 2); }
            else if (currentDate.getDay() === 0) { currentDate.setDate(currentDate.getDate() + 1); }
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
// 2. THE "DUMB" HOUSE PARTS (PRESENTATIONAL COMPONENTS)
// ===================================================================================

const AssetSelector = ({ onAssetAdd }) => {
    const [category, setCategory] = useState('');
    const [platform, setPlatform] = useState('');
    const [asset, setAsset] = useState('');
    const platforms = category ? Object.keys(assetHierarchy[category]) : [];
    const assets = category && platform ? assetHierarchy[category][platform] : [];
    const handleAdd = () => {
        if (category && platform && asset) {
            onAssetAdd({ category, platform, asset });
            setCategory(''); setPlatform(''); setAsset('');
        }
    };
    return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-800 mb-3">Add a Campaign Asset</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <select value={category} onChange={(e) => { setCategory(e.target.value); setPlatform(''); setAsset(''); }} className="p-2 border border-slate-300 rounded-md shadow-sm">
                    <option value="">Choose Category...</option>
                    {Object.keys(assetHierarchy).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <select value={platform} onChange={(e) => { setPlatform(e.target.value); setAsset(''); }} disabled={!category} className="p-2 border border-slate-300 rounded-md shadow-sm disabled:bg-slate-200">
                    <option value="">Choose Platform...</option>
                    {platforms.map(plat => <option key={plat} value={plat}>{plat}</option>)}
                </select>
                <select value={asset} onChange={(e) => setAsset(e.target.value)} disabled={!platform} className="p-2 border border-slate-300 rounded-md shadow-sm disabled:bg-slate-200">
                    <option value="">Choose Asset...</option>
                    {assets.map(ast => <option key={ast} value={ast}>{ast}</option>)}
                </select>
                <button onClick={handleAdd} disabled={!asset} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
                    <Plus size={18} /> Add
                </button>
            </div>
        </div>
    );
};

const GanttChart = ({ assets }) => {
  const ganttContainer = useRef(null);
  useEffect(() => {
    gantt.init(ganttContainer.current);
    const formatGanttData = (assets) => {
      const tasks = []; const links = []; let taskIdCounter = 1;
      assets.forEach(asset => {
        const parentId = taskIdCounter++;
        tasks.push({ id: parentId, text: `${asset.asset} (${asset.platform})`, type: 'project', open: true });
        let prevTaskId = null;
        asset.tasks.forEach(task => {
          const currentTaskId = taskIdCounter++;
          tasks.push({ id: currentTaskId, text: task.name, start_date: task.startDate, duration: task.duration, parent: parentId });
          if(prevTaskId) { links.push({id: links.length + 1, source: prevTaskId, target: currentTaskId, type: '0'}) }
          prevTaskId = currentTaskId;
        });
      });
      return { data: tasks, links: links };
    };
    gantt.parse(formatGanttData(assets));
  }, [assets]);
  return <div ref={ganttContainer} style={{ width: '100%', height: '500px' }}></div>;
};

const ProjectAccordionUI = ({ state, handleAssetAdd, handleAssetUpdate, handleAssetRemove, handleGenerateTimeline, handleExportExcel }) => {
    return (
        <div className="bg-slate-100 min-h-screen">
            <div className="max-w-7xl mx-auto p-4 md:p-8">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-800">Project Timeline Accordion</h1>
                    <p className="text-slate-500">Powered by MMM's Project Management</p>
                </header>
                <main className="space-y-8">
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h2 className="text-xl font-semibold text-slate-700 mb-4">1. Build Your Campaign</h2>
                        <AssetSelector onAssetAdd={handleAssetAdd} />
                    </div>
                    {state.selectedAssets.length > 0 && (
                        <div className="bg-white rounded-xl shadow-md p-6">
                            <h2 className="text-xl font-semibold text-slate-700 mb-4">2. Configure Assets</h2>
                            <div className="space-y-4">
                                {state.selectedAssets.map(asset => (
                                    <div key={asset.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-4 bg-slate-50 rounded-lg border">
                                        <div>
                                            <div className="font-semibold text-slate-800">{asset.asset}</div>
                                            <div className="text-sm text-slate-500">{asset.category} → {asset.platform}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm font-medium">Campaign Start Date:</label>
                                            <input type="date" value={asset.startDate} onChange={(e) => handleAssetUpdate(asset.id, { startDate: e.target.value })} className="p-2 border rounded-md w-full"/>
                                        </div>
                                        <button onClick={() => handleAssetRemove(asset.id)} className="text-red-500 hover:text-red-700 font-medium text-sm justify-self-start md:justify-self-end">Remove</button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={handleGenerateTimeline} className="mt-6 w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">Generate Timeline</button>
                        </div>
                    )}
                    {state.showTimeline && (
                        <div className="bg-white rounded-xl shadow-md p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold text-slate-700">3. View Timeline</h2>
                                <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-sm">
                                    <Download size={16} />
                                    Export to Excel
                                </button>
                            </div>
                            {state.timelineConflicts.length > 0 && (
                                <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg mb-6">
                                    <div className="flex items-center gap-3 font-semibold text-yellow-800"><AlertTriangle size={20} /> Conflicts Detected</div>
                                    {state.timelineConflicts.map((c, i) => <div key={i} className="mt-2 text-sm text-yellow-700 pl-8">{c.issue}</div>)}
                                </div>
                            )}
                            <div className="border rounded-lg overflow-hidden"><GanttChart assets={state.selectedAssets} /></div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};


// ===================================================================================
// 3. THE ENGINE ROOM (CONTAINER COMPONENT)
// ===================================================================================

const ProjectAccordionEngine = () => {
    const [state, dispatch] = useReducer(appReducer, initialState);

    const handleAssetAdd = (asset) => dispatch({ type: 'ADD_ASSET', payload: asset });
    const handleAssetRemove = (id) => dispatch({ type: 'REMOVE_ASSET', payload: id });
    const handleAssetUpdate = (id, updates) => dispatch({ type: 'UPDATE_ASSET', payload: { id, updates } });
    const handleGenerateTimeline = () => dispatch({ type: 'GENERATE_TIMELINE' });

    // --- NEW: Logic for exporting to Excel ---
    const handleExportExcel = () => {
        const dataForSheet = [];
        // Add headers
        dataForSheet.push(["Asset", "Platform", "Task", "Team", "Start Date", "End Date", "Duration (Days)"]);

        // Add rows for each task
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

        // Create a new workbook and a worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(dataForSheet);

        // Append the worksheet to the workbook
        XLSX.utils.book_append_sheet(wb, ws, "CampaignTimeline");

        // Trigger the download
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
