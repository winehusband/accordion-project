import React, { useReducer, useMemo, useEffect, useRef } from 'react';
import { ChevronDown, Search, Plus, Calendar, AlertTriangle } from 'lucide-react';

// --- GANTT CHART LIBRARY (Corrected Final Import) ---
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';

// --- DATA ---
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

// --- STATE MANAGEMENT ---
const initialState = {
  selectedAssets: [],
  timelineConflicts: [],
  showTimeline: false,
  searchTerm: '',
  showDropdown: false,
  selectedCategory: '',
  selectedPlatform: ''
};

function reducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_DROPDOWN':
      return { ...state, showDropdown: !state.showDropdown, searchTerm: '', selectedCategory: '', selectedPlatform: '' };
    case 'SET_SEARCH_TERM':
      return { ...state, searchTerm: action.payload };
    case 'SET_CATEGORY':
      return { ...state, selectedCategory: action.payload };
    case 'SET_PLATFORM':
      return { ...state, selectedPlatform: action.payload };
    case 'ADD_ASSET': {
      const { category, platform, asset } = action.payload;
      const newAsset = { id: Date.now(), category, platform, asset, goLiveDate: '', tasks: [] };
      return { ...state, selectedAssets: [...state.selectedAssets, newAsset], showDropdown: false };
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

// --- GANTT CHART COMPONENT ---
const GanttChart = ({ assets }) => {
  const ganttContainer = useRef(null);

  useEffect(() => {
    // This effect hook initializes the gantt chart when the component mounts
    gantt.init(ganttContainer.current);

    const formatGanttData = (assets) => {
      const tasks = [];
      const links = [];
      let taskIdCounter = 1;

      assets.forEach(asset => {
        const parentId = taskIdCounter++;
        tasks.push({ id: parentId, text: `${asset.asset} (${asset.platform})`, type: 'project', open: true });
        
        let prevTaskId = null;
        asset.tasks.forEach(task => {
          const currentTaskId = taskIdCounter++;
          tasks.push({
            id: currentTaskId,
            text: task.name,
            start_date: task.startDate,
            duration: task.duration,
            parent: parentId
          });
          if(prevTaskId) {
            links.push({id: links.length + 1, source: prevTaskId, target: currentTaskId, type: '0'})
          }
          prevTaskId = currentTaskId;
        });
      });
      return { data: tasks, links: links };
    };

    gantt.parse(formatGanttData(assets));
  }, [assets]); // Re-render the chart if the assets data changes

  return (
    <div ref={ganttContainer} style={{ width: '100%', height: '500px' }}></div>
  );
};


// --- MAIN APP COMPONENT ---
const ProjectAccordionUX = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const allAssets = useMemo(() => {
    const assets = [];
    Object.entries(assetHierarchy).forEach(([category, platforms]) => {
      Object.entries(platforms).forEach(([platform, assetList]) => {
        assetList.forEach(asset => assets.push({ category, platform, asset }));
      });
    });
    return assets;
  }, []);

  const filteredAssets = useMemo(() => {
    if (!state.searchTerm) return [];
    return allAssets.filter(item =>
      item.asset.toLowerCase().includes(state.searchTerm.toLowerCase())
    );
  }, [allAssets, state.searchTerm]);

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Project Accordion</h1>

        <div className="relative mb-6">
          <button onClick={() => dispatch({ type: 'TOGGLE_DROPDOWN' })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg">
            <Plus size={16} /> Add Asset
          </button>
          {state.showDropdown && (
            <div className="absolute top-12 left-0 bg-white border rounded-lg shadow-lg w-96 z-10 p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search assets..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  value={state.searchTerm}
                  onChange={(e) => dispatch({ type: 'SET_SEARCH_TERM', payload: e.target.value })}
                />
              </div>
              <div>
                {filteredAssets.slice(0, 5).map((item, index) => (
                  <button key={index} onClick={() => dispatch({ type: 'ADD_ASSET', payload: item })} className="w-full text-left p-2 hover:bg-gray-100 rounded">
                    <div>{item.asset}</div><div className="text-sm text-gray-500">{item.category} → {item.platform}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {state.selectedAssets.map(asset => (
            <div key={asset.id} className="flex items-center gap-4 p-3 bg-gray-100 rounded-lg">
              <div className="flex-1">
                <div className="font-medium">{asset.asset}</div>
                <div className="text-sm text-gray-600">{asset.category} → {asset.platform}</div>
              </div>
              <input
                type="date"
                value={asset.goLiveDate}
                onChange={(e) => dispatch({ type: 'UPDATE_ASSET', payload: { id: asset.id, updates: { goLiveDate: e.target.value } } })}
                className="px-2 py-1 border rounded text-sm"
              />
              <button onClick={() => dispatch({ type: 'REMOVE_ASSET', payload: asset.id })} className="text-red-600 hover:text-red-800">Remove</button>
            </div>
          ))}
        </div>

        {state.selectedAssets.length > 0 && (
          <button onClick={() => dispatch({ type: 'GENERATE_TIMELINE' })} className="mt-6 px-6 py-2 bg-green-600 text-white rounded-lg">
            Generate Timeline
          </button>
        )}
        
        {state.showTimeline && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Campaign Timeline</h2>
            {state.timelineConflicts.length > 0 && (
              <div className="p-4 bg-yellow-100 border border-yellow-300 rounded-lg mb-4">
                <div className="flex items-center gap-2 font-bold text-yellow-800"><AlertTriangle size={20} /> Conflicts Detected</div>
                {state.timelineConflicts.map((c, i) => <div key={i} className="mt-2 text-sm">{c.issue}</div>)}
              </div>
            )}
            <GanttChart assets={state.selectedAssets} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectAccordionUX;
