import React, { useReducer, useState, useEffect, useRef } from 'react';
import { AlertTriangle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';

// ===================================================================================
// 1. DATA AND LOGIC
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
// 2. PRESENTATIONAL COMPONENTS (LOVABLE STYLE)
// ===================================================================================

const AssetSelector = ({ onAddAsset }) => {
  const [category, setCategory] = useState('');
  const [platform, setPlatform] = useState('');
  const [asset, setAsset] = useState('');

  const platforms = category ? Object.keys(assetHierarchy[category]) : [];
  const assets = category && platform ? assetHierarchy[category][platform] : [];

  const handleAdd = () => {
    if (category && platform && asset) {
      onAddAsset({ category, platform, asset });
      setCategory('');
      setPlatform('');
      setAsset('');
    }
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl">
      <h2 className="text-white text-xl font-semibold mb-4">Add New Asset</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPlatform(''); setAsset(''); }} className="p-2 rounded">
          <option value="">Select Category</option>
          {Object.keys(assetHierarchy).map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <select value={platform} onChange={(e) => { setPlatform(e.target.value); setAsset(''); }} disabled={!category} className="p-2 rounded">
          <option value="">Select Platform</option>
          {platforms.map(plat => <option key={plat} value={plat}>{plat}</option>)}
        </select>
        <select value={asset} onChange={(e) => setAsset(e.target.value)} disabled={!platform} className="p-2 rounded">
          <option value="">Select Asset</option>
          {assets.map(ast => <option key={ast} value={ast}>{ast}</option>)}
        </select>
        <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Add</button>
      </div>
    </div>
  );
};

const AssetConfigurator = ({ assets, onUpdate, onRemove, onGenerateTimeline }) => (
  <div className="bg-slate-800 p-6 rounded-xl space-y-4">
    <h2 className="text-white text-xl font-semibold">Configure Assets</h2>
    {assets.map(asset => (
      <div key={asset.id} className="bg-slate-700 p-4 rounded flex justify-between items-center">
        <div>
          <p className="text-white font-medium">{asset.asset}</p>
          <p className="text-gray-400 text-sm">{asset.category} → {asset.platform}</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={asset.goLiveDate} onChange={(e) => onUpdate(asset.id, { goLiveDate: e.target.value })} className="p-2 rounded" />
          <button onClick={() => onRemove(asset.id)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
        </div>
      </div>
    ))}
    <button onClick={onGenerateTimeline} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Generate Timeline</button>
  </div>
);

const GanttChart = ({ assets }) => {
  const ganttRef = useRef(null);

  useEffect(() => {
    gantt.config.columns = [
      { name: "text", label: "Task Name", width: '*', tree: true },
      { name: "start_date", label: "Start Date", align: "center" },
      { name: "duration", label: "Duration", align: "center" }
    ];

    gantt.config.order_branch = true;
    gantt.config.order_branch_free = true;
    gantt.config.work_time = true;
    gantt.config.grid_width = 300;

    gantt.init(ganttRef.current);
    gantt.config.columns = [
      { name: "text", label: "Task Name", width: '*', tree: true },
      { name: "start_date", label: "Start Date", align: "center" },
      { name: "duration", label: "Duration", align: "center" }
    ];
    gantt.init(ganttRef.current);
    const tasks = {
      data: assets.flatMap((asset) => {
        const parentId = `asset-${asset.id}`;
        const childTasks = asset.tasks.map((task, tIndex) => ({
          id: `${asset.id}-${tIndex}`,
          text: task.name,
          start_date: task.startDate.toISOString().split('T')[0],
          duration: task.duration,
          parent: parentId,
          assetName: asset.asset
        }));
        return [
          {
            id: parentId,
            text: `${asset.asset} (${asset.platform})`,
            open: true
          },
          ...childTasks
        ];
      }),
      links: assets.flatMap((asset) => {
        return asset.tasks.slice(1).map((task, i) => ({
          id: `${asset.id}-link-${i}`,
          source: `${asset.id}-${i}`,
          target: `${asset.id}-${i + 1}`,
          type: gantt.config.links.finish_to_start
        }));
      })
    };
    gantt.clearAll();
    gantt.parse(tasks);
  }, [assets]);

  return <div ref={ganttRef} style={{ width: '100%', height: '500px' }} className="rounded overflow-hidden bg-white" />;
};

const ProjectAccordionEngine = () => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const handleAssetAdd = (asset) => dispatch({ type: 'ADD_ASSET', payload: asset });
  const handleAssetRemove = (id) => dispatch({ type: 'REMOVE_ASSET', payload: id });
  const handleAssetUpdate = (id, updates) => dispatch({ type: 'UPDATE_ASSET', payload: { id, updates } });
  const handleGenerateTimeline = () => dispatch({ type: 'GENERATE_TIMELINE' });

  const handleExportExcel = () => {
    const dataForSheet = [["Asset", "Platform", "Task", "Team", "Start Date", "End Date", "Duration (Days)"]];
    state.selectedAssets.forEach(asset => {
      if (asset.tasks?.length) {
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
    <div className="min-h-screen bg-slate-900 p-6">
      <header className="text-center mb-12">
        <h1 className="text-5xl font-bold text-white mb-4">Project Timeline Accordion</h1>
        <p className="text-lg text-gray-400">Powered by MMM's Project Management</p>
      </header>

      <div className="max-w-6xl mx-auto space-y-10">
        <AssetSelector onAddAsset={handleAssetAdd} />
        {state.selectedAssets.length > 0 && (
          <AssetConfigurator
            assets={state.selectedAssets}
            onRemove={handleAssetRemove}
            onUpdate={handleAssetUpdate}
            onGenerateTimeline={handleGenerateTimeline}
          />
        )}
        {state.timelineConflicts.length > 0 && (
          <div className="bg-yellow-100 text-yellow-800 p-4 rounded">
            <div className="flex items-center gap-2 font-bold"><AlertTriangle size={18} /> Timeline Conflicts</div>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {state.timelineConflicts.map((c, i) => <li key={i}>{c.issue}</li>)}
            </ul>
          </div>
        )}
        {state.showTimeline && (
          <>
            <div className="bg-white p-4 rounded shadow">
              <GanttChart assets={state.selectedAssets} />
            </div>
            <button onClick={handleExportExcel} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Export to Excel</button>
          </>
        )}
      </div>
    </div>
  );
};

export default ProjectAccordionEngine;
