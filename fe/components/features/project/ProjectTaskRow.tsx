'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ProjectTaskMetrics, ProjectStatusLabel } from '@/components/features/project/projectDisplay';
import {
  formatProjectCompletion,
  type ProjectTaskNode,
} from '@/lib/services/projectService';

type ProjectTaskRowProps = Readonly<{
  task: ProjectTaskNode;
  depth?: number;
  defaultExpanded?: boolean;
  editMode?: boolean;
  onEditSelect?: (task: ProjectTaskNode) => void;
}>;

function ProjectTaskRow({
  task,
  depth = 0,
  defaultExpanded = false,
  editMode = false,
  onEditSelect,
}: ProjectTaskRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = task.children.length > 0;

  const handleRowClick = () => {
    if (editMode && onEditSelect) {
      onEditSelect(task);
      return;
    }
    setExpanded((open) => !open);
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleRowClick}
        className={`flex w-full items-center gap-4 max-md:gap-2 border border-gray-200 bg-white px-4 max-md:px-3 py-3 text-left transition-colors hover:bg-gray-50 ${
          depth > 0 ? 'rounded-lg' : 'rounded-xl'
        } ${editMode ? 'cursor-pointer ring-2 ring-transparent hover:ring-brand-primary/25' : ''}`}
        aria-expanded={editMode ? undefined : expanded}
      >
        <span className="w-16 max-md:w-12 shrink-0 text-sm font-semibold tabular-nums text-brand-primary">
          {task.code}
        </span>
        <span className="min-w-0 flex-1 text-[15px] font-medium text-gray-800 truncate">
          {task.name}
        </span>
        <span className="shrink-0 text-sm font-semibold text-gray-600 tabular-nums">
          {formatProjectCompletion(task.completionPct)}
        </span>
        <ProjectStatusLabel status={task.status} className="text-xs font-semibold shrink-0" />
        <ChevronDown
          size={18}
          className={`shrink-0 text-gray-400 transition-transform ${
            editMode ? 'opacity-30' : expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {!editMode && expanded && (
        <div
          className={`border border-t-0 border-gray-200 bg-gray-50/60 px-4 py-3 ${
            depth > 0 ? 'rounded-b-lg' : 'rounded-b-xl'
          }`}
        >
          <ProjectTaskMetrics task={task} className="mb-3" />
          {hasChildren && (
            <div className="space-y-2 border-t border-gray-200/80 pt-3">
              {task.children.map((child) => (
                <ProjectTaskRow
                  key={child.id}
                  task={child}
                  depth={depth + 1}
                  editMode={editMode}
                  onEditSelect={onEditSelect}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProjectTaskRow;
