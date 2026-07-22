'use client';

import { Fragment } from 'react';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import type { TaskPreviewRow } from '@/lib/services/taskService';
import {
  getSharedPreviewDate,
  inputValueToTaskDate,
  taskDateToInputValue,
} from '@/lib/utils/taskImportValidation';
import { ui } from '@/lib/utils/ui-classes';

export type PreviewRow = TaskPreviewRow;

type PreviewGroup = {
  key: string;
  name: string;
  number: string;
  tasks: PreviewRow[];
};

function groupPreviewRows(rows: PreviewRow[]): PreviewGroup[] {
  const map = new Map<string, PreviewGroup>();
  for (const row of rows) {
    const key = `${row.number}|${row.name}`;
    const existing = map.get(key);
    if (existing) {
      existing.tasks.push(row);
    } else {
      map.set(key, { key, name: row.name, number: row.number, tasks: [row] });
    }
  }
  return Array.from(map.values());
}

function editableFieldClass(extra = '') {
  return `${ui.inputEditable} ${extra}`.trim();
}

function createEmptyTaskForGroup(name: string, number: string): PreviewRow {
  return {
    id: `new-${crypto.randomUUID()}`,
    name,
    number,
    taskName: '',
    rawStartTime: '',
    rawEndTime: '',
  };
}

type TaskImportPreviewTableProps = Readonly<{
  rows: PreviewRow[];
  onChange: (rows: PreviewRow[]) => void;
}>;

export default function TaskImportPreviewTable({ rows, onChange }: TaskImportPreviewTableProps) {
  const grouped = groupPreviewRows(rows);

  const updateRow = (
    id: string,
    patch: Partial<Pick<PreviewRow, 'taskName' | 'rawStartTime' | 'rawEndTime'>>,
  ) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const updateGroupUser = (groupKey: string, patch: Partial<Pick<PreviewRow, 'name' | 'number'>>) => {
    onChange(
      rows.map((row) => {
        const key = `${row.number}|${row.name}`;
        if (key !== groupKey) return row;
        return { ...row, ...patch };
      }),
    );
  };

  const removeRow = (id: string) => {
    onChange(rows.filter((row) => row.id !== id));
  };

  const addTaskToGroup = (group: PreviewGroup) => {
    const lastIndex = rows.findLastIndex(
      (row) => `${row.number}|${row.name}` === group.key,
    );
    if (lastIndex === -1) return;

    const next = [...rows];
    next.splice(lastIndex + 1, 0, createEmptyTaskForGroup(group.name, group.number));
    onChange(next);
  };

  const colSpan = 6;
  const previewDate = getSharedPreviewDate(rows);

  const updatePreviewDate = (value: string) => {
    const date = inputValueToTaskDate(value);
    onChange(rows.map((row) => ({ ...row, date })));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl bg-white shadow-sm">
        <div className="flex items-center gap-2 shrink-0">
          <CalendarDays size={18} className={ui.textAccent} />
          <label htmlFor="preview-task-date" className="text-sm font-semibold text-gray-800">
            Task date
          </label>
        </div>
        <input
          id="preview-task-date"
          type="date"
          value={taskDateToInputValue(previewDate)}
          onChange={(e) => updatePreviewDate(e.target.value)}
          className={`${editableFieldClass('sm:w-auto')} cursor-pointer`}
        />
        {previewDate && (
          <span className={`text-base font-medium ${ui.textAccent}`}>{previewDate}</span>
        )}
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white min-h-[420px] shadow-sm">
        <table className="w-full text-lg table-fixed">
          <colgroup>
            <col style={{ width: '16%' }} />
            <col style={{ width: '35%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '3%' }} />
            <col style={{ width: '7%' }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-50 text-left text-sm uppercase tracking-wide text-gray-500 border-b border-gray-200">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">End</th>
              <th className="px-0 py-3" aria-label="Remove task" />
              <th className="px-1 py-3" aria-label="Add task" />
            </tr>
          </thead>
          <tbody>
            {grouped.map((group, groupIndex) => (
              <Fragment key={group.tasks[0]?.id ?? group.key}>
                {group.tasks.map((task, taskIndex) => (
                  <tr
                    key={task.id}
                    className={`border-t border-gray-100 hover:bg-brand-pastel-blue/30 ${
                      taskIndex === group.tasks.length - 1 ? 'border-b-[6px] border-b-gray-100' : ''
                    }`}
                  >
                    {taskIndex === 0 && (
                      <td
                        rowSpan={group.tasks.length}
                        className="px-4 py-3 align-top border-r border-gray-100 bg-slate-50/80"
                      >
                        <div className="space-y-2">
                          <input
                            value={group.name}
                            onChange={(e) => updateGroupUser(group.key, { name: e.target.value })}
                            placeholder="User name"
                            className={editableFieldClass('font-medium text-gray-900')}
                          />
                          <input
                            value={group.number}
                            onChange={(e) => updateGroupUser(group.key, { number: e.target.value })}
                            placeholder="10-digit mobile"
                            inputMode="numeric"
                            className={editableFieldClass(`font-semibold ${ui.textAccent}`)}
                          />
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <input
                        value={task.taskName}
                        onChange={(e) => updateRow(task.id, { taskName: e.target.value })}
                        placeholder="Task name"
                        className={editableFieldClass('font-medium text-gray-900')}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={task.rawStartTime}
                        onChange={(e) => updateRow(task.id, { rawStartTime: e.target.value })}
                        placeholder="9am"
                        className={editableFieldClass('text-gray-800')}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={task.rawEndTime}
                        onChange={(e) => updateRow(task.id, { rawEndTime: e.target.value })}
                        placeholder="5pm"
                        className={editableFieldClass('text-gray-800')}
                      />
                    </td>
                    <td className="pl-1 pr-0 py-3 align-middle">
                      <button
                        type="button"
                        onClick={() => removeRow(task.id)}
                        className="rounded-md p-1 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                        aria-label="Remove task"
                      >
                        <Trash2 size={16} strokeWidth={2.5} />
                      </button>
                    </td>
                    {taskIndex === 0 && (
                      <td
                        rowSpan={group.tasks.length}
                        className="px-1 py-3 align-bottom whitespace-nowrap"
                      >
                        <button
                          type="button"
                          onClick={() => addTaskToGroup(group)}
                          className={ui.btnGhostBlue}
                        >
                          <Plus size={14} strokeWidth={2.5} />
                          Add task
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {groupIndex < grouped.length - 1 && (
                  <tr>
                    <td colSpan={colSpan} className="h-4 p-0 bg-gray-50/80 border-0" />
                  </tr>
                )}
              </Fragment>
            ))}
            {grouped.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="h-[380px] align-middle text-center text-gray-400">
                  No tasks to preview
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
