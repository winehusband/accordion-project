import React, { useEffect, useRef } from 'react';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';

const GanttChart = ({ assets }) => {
  const ganttContainer = useRef(null);

  useEffect(() => {
    gantt.init(ganttContainer.current);
    const formatGanttData = (assets) => {
      const tasks = [];
      const links = [];
      let taskIdCounter = 1;

      assets.forEach(asset => {
        const parentId = taskIdCounter++;
        tasks.push({
          id: parentId,
          text: `${asset.asset} (${asset.platform})`,
          type: 'project',
          open: true
        });

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

          if (prevTaskId) {
            links.push({
              id: links.length + 1,
              source: prevTaskId,
              target: currentTaskId,
              type: '0'
            });
          }

          prevTaskId = currentTaskId;
        });
      });

      return { data: tasks, links: links };
    };

    gantt.parse(formatGanttData(assets));
  }, [assets]);

  return <div ref={ganttContainer} style={{ width: '100%', height: '500px' }} />;
};

export default GanttChart;
