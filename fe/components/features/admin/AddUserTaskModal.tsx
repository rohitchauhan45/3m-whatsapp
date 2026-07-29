'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Loader2, Plus, Trash2 } from 'lucide-react';
import Modal, { ModalDetailGrid } from '@/components/ui/Modal';
import type { TaskPreviewRow } from '@/lib/services/taskService';
import {
  digitsOnlyPhone,
  inputValueToTaskDate,
  isValidIndianMobile10,
  INDIAN_MOBILE_10_ERROR,
  taskDateToInputValue,
  validatePreviewRows,
} from '@/lib/utils/taskImportValidation';
import { editableFieldClass, createEmptyTaskForGroup } from '@/components/features/admin/TaskImportPreviewTable';
import { ui } from '@/lib/utils/ui-classes';

type TaskLine = {
  id: string;
  taskName: string;
  rawStartTime: string;
  rawEndTime: string;
};

type UserFormState = {
  name: string;
  number: string;
  managerName: string;
  managerMobile: string;
  date: string;
  tasks: TaskLine[];
};

function emptyUserForm(defaultDate = ''): UserFormState {
  const empty = createEmptyTaskForGroup('', '');
  return {
    name: '',
    number: '',
    managerName: '',
    managerMobile: '',
    date: defaultDate,
    tasks: [
      {
        id: empty.id,
        taskName: '',
        rawStartTime: '',
        rawEndTime: '',
      },
    ],
  };
}

function defaultTomorrowDateLabel(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const d = String(tomorrow.getDate()).padStart(2, '0');
  const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const y = tomorrow.getFullYear();
  return `${d}-${m}-${y}`;
}

function buildPreviewRows(form: UserFormState): TaskPreviewRow[] {
  const name = form.name.trim();
  const number = digitsOnlyPhone(form.number);
  const managerName = form.managerName.trim();
  const managerMobile = digitsOnlyPhone(form.managerMobile);

  return form.tasks.map((task) => ({
    id: task.id,
    name,
    number,
    taskName: task.taskName.trim(),
    rawStartTime: task.rawStartTime.trim(),
    rawEndTime: task.rawEndTime.trim(),
    date: form.date,
    managerName,
    managerMobile,
    startRow: 0,
  }));
}

type AddUserTaskModalProps = Readonly<{
  open: boolean;
  onClose: () => void;
  onSubmit: (rows: TaskPreviewRow[]) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  defaultDate?: string;
}>;

export default function AddUserTaskModal({
  open,
  onClose,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Create',
  defaultDate = '',
}: AddUserTaskModalProps) {
  const [form, setForm] = useState<UserFormState>(() =>
    emptyUserForm(defaultDate || defaultTomorrowDateLabel()),
  );

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    setForm(emptyUserForm(defaultDate.trim() || defaultTomorrowDateLabel()));
  }, [open, defaultDate]);

  const updateTask = (id: string, patch: Partial<Pick<TaskLine, 'taskName' | 'rawStartTime' | 'rawEndTime'>>) => {
    setForm((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  };

  const addTaskLine = () => {
    const empty = createEmptyTaskForGroup(form.name, form.number);
    setForm((prev) => ({
      ...prev,
      tasks: [
        ...prev.tasks,
        {
          id: empty.id,
          taskName: '',
          rawStartTime: '',
          rawEndTime: '',
        },
      ],
    }));
  };

  const removeTaskLine = (id: string) => {
    setForm((prev) => {
      if (prev.tasks.length <= 1) return prev;
      return { ...prev, tasks: prev.tasks.filter((t) => t.id !== id) };
    });
  };

  const handleSubmit = () => {
    const rows = buildPreviewRows(form);
    const validation = validatePreviewRows(rows);
    const errors = [...validation.errors];

    if (!form.managerName.trim()) {
      errors.push('Manager name is required.');
    }
    const managerDigits = digitsOnlyPhone(form.managerMobile);
    if (!isValidIndianMobile10(managerDigits)) {
      errors.push(`Manager mobile: ${INDIAN_MOBILE_10_ERROR}`);
    }

    if (errors.length > 0) {
      return { ok: false as const, errors };
    }

    onSubmit(rows);
    return { ok: true as const, errors: [] };
  };

  const [localError, setLocalError] = useState<string | null>(null);

  const onCreateClick = () => {
    setLocalError(null);
    const result = handleSubmit();
    if (!result.ok) {
      setLocalError(result.errors.join('\n'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !isSubmitting && onClose()}
      title="Add User"
      size="xl"
      headerRight={
        <div className="flex items-center gap-2 shrink-0">
          <CalendarDays size={16} className={ui.textAccent} />
          <input
            type="date"
            value={taskDateToInputValue(form.date)}
            onChange={(e) => {
              const date = inputValueToTaskDate(e.target.value);
              setForm((prev) => ({ ...prev, date }));
            }}
            className={`${editableFieldClass('text-sm py-1.5')} cursor-pointer w-auto`}
            aria-label="Task date"
          />
        </div>
      }
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {localError ? (
            <p className="text-sm text-red-600 whitespace-pre-line">{localError}</p>
          ) : (
            <span />
          )}
          <div className="flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onCreateClick}
              disabled={isSubmitting}
              className={ui.btnPrimary}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating…
                </>
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <ModalDetailGrid>
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm">
            <p className="mb-1.5 text-sm font-medium text-gray-500">User name</p>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="User name"
              className={editableFieldClass('font-medium text-gray-900')}
            />
          </div>
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm">
            <p className="mb-1.5 text-sm font-medium text-gray-500">Mobile number</p>
            <input
              type="text"
              value={form.number}
              onChange={(e) => setForm((prev) => ({ ...prev, number: e.target.value }))}
              placeholder="10-digit mobile"
              inputMode="numeric"
              className={editableFieldClass(`font-semibold ${ui.textAccent}`)}
            />
          </div>
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm">
            <p className="mb-1.5 text-sm font-medium text-gray-500">Manager name</p>
            <input
              type="text"
              value={form.managerName}
              onChange={(e) => setForm((prev) => ({ ...prev, managerName: e.target.value }))}
              placeholder="Manager name"
              className={editableFieldClass()}
            />
          </div>
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm">
            <p className="mb-1.5 text-sm font-medium text-gray-500">Manager mobile</p>
            <input
              type="text"
              value={form.managerMobile}
              onChange={(e) => setForm((prev) => ({ ...prev, managerMobile: e.target.value }))}
              placeholder="10-digit mobile"
              inputMode="numeric"
              className={editableFieldClass()}
            />
          </div>
        </ModalDetailGrid>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-800">Tasks</p>
          {form.tasks.map((task) => (
            <div
              key={task.id}
              className="grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
            >
              <div>
                <p className="mb-1.5 text-sm font-medium text-gray-500">Task name</p>
                <input
                  type="text"
                  value={task.taskName}
                  onChange={(e) => updateTask(task.id, { taskName: e.target.value })}
                  placeholder="Task name"
                  className={editableFieldClass('font-medium text-gray-900')}
                />
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium text-gray-500">Start</p>
                <input
                  type="text"
                  value={task.rawStartTime}
                  onChange={(e) => updateTask(task.id, { rawStartTime: e.target.value })}
                  placeholder="9am"
                  className={editableFieldClass('text-gray-800')}
                />
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium text-gray-500">End</p>
                <input
                  type="text"
                  value={task.rawEndTime}
                  onChange={(e) => updateTask(task.id, { rawEndTime: e.target.value })}
                  placeholder="5pm"
                  className={editableFieldClass('text-gray-800')}
                />
              </div>
              <div className="flex sm:justify-center sm:pb-1">
                <button
                  type="button"
                  onClick={() => removeTaskLine(task.id)}
                  disabled={form.tasks.length <= 1}
                  className="rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-30"
                  aria-label="Remove task"
                >
                  <Trash2 size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addTaskLine} className={ui.btnGhostBlue}>
            <Plus size={14} strokeWidth={2.5} />
            Add task
          </button>
        </div>
      </div>
    </Modal>
  );
}
