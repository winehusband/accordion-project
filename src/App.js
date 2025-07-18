import React, { useReducer, useMemo, useState, useEffect, useRef } from 'react';
import { ChevronDown, Plus, Calendar, AlertTriangle } from 'lucide-react';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';

// ===================================================================================
// 1. THE ENGINE'S BLUEPRINTS (DATA & LOGIC)
// This section contains all the core data and the reducer function (the "brain").
// It has no visual components.
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
// 2. THE "DUMB" HOUSE PARTS (PRESENTATIONAL COMPONENTS)
// These components are only responsible for looking pretty. They receive all data
// and functions as props and don't have any logic of their own.
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

// This is the main UI for the whole application. It's "dumb".
const ProjectAccordionUI = ({ state, handleAssetAdd, handleAssetUpdate, handleAssetRemove, handleGenerateTimeline }) => {
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
                                            <label className="text-sm font-medium">Go-Live Date:</label>
                                            <input type="date" value={asset.goLiveDate} onChange={(e) => handleAssetUpdate(asset.id, { goLiveDate: e.target.value })} className="p-2 border rounded-md w-full"/>
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
                            <h2 className="text-xl font-semibold text-slate-700 mb-4">3. View Timeline</h2>
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
// This component is the "brain". It contains all the logic and state, and passes
// everything down to the "dumb" UI component.
// ===================================================================================

const ProjectAccordionEngine = () => {
    const [state, dispatch] = useReducer(appReducer, initialState);

    // --- These are the "wires" that connect the engine to the UI ---
    const handleAssetAdd = (asset) => dispatch({ type: 'ADD_ASSET', payload: asset });
    const handleAssetRemove = (id) => dispatch({ type: 'REMOVE_ASSET', payload: id });
    const handleAssetUpdate = (id, updates) => dispatch({ type: 'UPDATE_ASSET', payload: { id, updates } });
    const handleGenerateTimeline = () => dispatch({ type: 'GENERATE_TIMELINE' });

    // It renders the UI component and passes all the necessary data and functions down as props.
    return (
        <ProjectAccordionUI
            state={state}
            handleAssetAdd={handleAssetAdd}
            handleAssetRemove={handleAssetRemove}
            handleAssetUpdate={handleAssetUpdate}
            handleGenerateTimeline={handleGenerateTimeline}
        />
    );
};

// The final export is the Engine, which controls everything.
export default ProjectAccordionEngine;
