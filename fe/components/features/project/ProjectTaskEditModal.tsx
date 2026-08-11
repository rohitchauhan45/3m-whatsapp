'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { ui } from '@/lib/utils/ui-classes';
import {
  PROJECT_TASK_STATUS_OPTIONS,
  PROJECT_TASK_TYPE_OPTIONS,
  formatProjectDateRange,
  projectTaskStatusToApi,
  projectTaskTypeToApi,
  type ProjectTaskNode,
  type ProjectTaskStatusValue,
  type ProjectTaskTypeValue,
  type UpdateProjectTaskInput,
} from '@/lib/services/projectService';

const modalCloseRed =
  'rounded-full border border-red-200 bg-red-50 p-2 text-red-500 transition-colors hover:bg-red-100 hover:text-red-600';

type TaskFormState = {
  name: string;
  assigneeName: string;
  type: ProjectTaskTypeValue;
  status: ProjectTaskStatusValue;
  durationDays: string;
  totalQty: string;
  completedQty: string;
  completionPct: string;
};

function buildFormState(task: ProjectTaskNode): TaskFormState {
  return {
    name: task.name,
    assigneeName: task.assigneeName ?? '',
    type: projectTaskTypeToApi(task.type),
    status: projectTaskStatusToApi(task.status),
    durationDays: task.durationDays != null ? String(task.durationDays) : '',
    totalQty: task.totalQty != null ? String(task.totalQty) : '',
    completedQty: task.completedQty != null ? String(task.completedQty) : '',
    completionPct: task.completionPct != null ? String(task.completionPct) : '',
  };
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formToPayload(form: TaskFormState): UpdateProjectTaskInput {
  return {
    name: form.name.trim(),
    assigneeName: form.assigneeName.trim() || null,
    type: form.type,
    status: form.status,
    durationDays: parseOptionalInt(form.durationDays),
    totalQty: parseOptionalNumber(form.totalQty),
    completedQty: parseOptionalNumber(form.completedQty),
    completionPct: parseOptionalNumber(form.completionPct),
  };
}

type ProjectTaskEditModalProps = Readonly<{
  open: boolean;
  task: ProjectTaskNode | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: UpdateProjectTaskInput) => void;
}>;

export default function ProjectTaskEditModal({
  open,
  task,
  isSaving,
  onClose,
  onSave,
}: ProjectTaskEditModalProps) {
  const [form, setForm] = useState<TaskFormState | null>(null);

  useEffect(() => {
    if (task && open) {
      setForm(buildFormState(task));
    } else if (!open) {
      setForm(null);
    }
  }, [task, open]);

  if (!task || !form) return null;

  const handleClose = () => {
    if (!isSaving) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Edit task"
      description={`Task ${task.code}`}
      size="lg"
      closeButtonClassName={modalCloseRed}
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onSave(formToPayload(form))}
            disabled={isSaving || !form.name.trim()}
            className={ui.btnPrimary}
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Updating…
              </>
            ) : (
              'Update'
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-gray-700">Task number</span>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-base text-gray-600">
            {task.code}
          </div>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-gray-700">Name</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
            className={ui.inputEditable}
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Type</span>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, type: e.target.value as ProjectTaskTypeValue } : prev,
                )
              }
              className={ui.inputEditable}
            >
              {PROJECT_TASK_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Status</span>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, status: e.target.value as ProjectTaskStatusValue } : prev,
                )
              }
              className={ui.inputEditable}
            >
              {PROJECT_TASK_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-gray-700">Assignee</span>
          <input
            type="text"
            value={form.assigneeName}
            onChange={(e) =>
              setForm((prev) => (prev ? { ...prev, assigneeName: e.target.value } : prev))
            }
            className={ui.inputEditable}
            placeholder="Assignee name"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Duration (days)</span>
            <input
              type="number"
              min={0}
              value={form.durationDays}
              onChange={(e) =>
                setForm((prev) => (prev ? { ...prev, durationDays: e.target.value } : prev))
              }
              className={ui.inputEditable}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Completion %</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.completionPct}
              onChange={(e) =>
                setForm((prev) => (prev ? { ...prev, completionPct: e.target.value } : prev))
              }
              className={ui.inputEditable}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Total qty</span>
            <input
              type="number"
              min={0}
              step="any"
              value={form.totalQty}
              onChange={(e) =>
                setForm((prev) => (prev ? { ...prev, totalQty: e.target.value } : prev))
              }
              className={ui.inputEditable}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Completed qty</span>
            <input
              type="number"
              min={0}
              step="any"
              value={form.completedQty}
              onChange={(e) =>
                setForm((prev) => (prev ? { ...prev, completedQty: e.target.value } : prev))
              }
              className={ui.inputEditable}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Planned schedule</span>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-base text-gray-600">
              {formatProjectDateRange(task.plannedStart, task.plannedEnd)}
            </div>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Actual schedule</span>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-base text-gray-600">
              {formatProjectDateRange(task.actualStart, task.actualEnd)}
            </div>
          </label>
        </div>
      </div>
    </Modal>
  );
}
