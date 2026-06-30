'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Save, RefreshCw } from 'lucide-react';
import { fetchCronjobs, updateCronjob, CronJob } from '@/lib/services/settingsService';
import { queryKeys } from '@/lib/query-keys';
import { cachedQueryOptions } from '@/lib/query-config';
import { useToast } from '@/lib/providers/toast-provider';

const CRON_LABELS: Record<string, string> = {
  default_task_assign_time: 'Task Assign Time',
  default_task_followup_time: 'Task Follow-up Time',
  default_task_ontrack_time: 'Morning On-Track Check',
  default_remaining_status_delay: 'Remaining Status Delay',
  default_start_task_early: 'Start Task Early',
};

const CRON_DESCRIPTIONS: Record<string, string> = {
  default_task_assign_time: 'Daily time to send task assignments via WhatsApp',
  default_task_followup_time: 'Daily time to send follow-up reminders to users',
  default_task_ontrack_time: 'Daily time to ask users if accepted tasks are on track',
  default_remaining_status_delay:
    'Minutes after task assign before sending remaining status to manager',
  default_start_task_early:
    'Minutes before task start time to send on-track / remark message to user',
};

const CORE_CRON_KEYS = [
  'default_task_assign_time',
  'default_task_followup_time',
  'default_task_ontrack_time',
] as const;

const MINUTE_SETTING_KEYS = [
  'default_remaining_status_delay',
  'default_start_task_early',
] as const;

const CORE_CRON_DEFAULTS: Record<(typeof CORE_CRON_KEYS)[number], string> = {
  default_task_assign_time: '0 21 * * *',
  default_task_followup_time: '0 10 * * *',
  default_task_ontrack_time: '0 7 * * *',
};

const MINUTE_SETTING_DEFAULTS: Record<(typeof MINUTE_SETTING_KEYS)[number], string> = {
  default_remaining_status_delay: '30',
  default_start_task_early: '10',
};

interface TimeParts {
  hour: string;
  minute: string;
  period: 'AM' | 'PM';
}

function cronToTimeParts(cron: string): TimeParts {
  const parts = cron.split(' ');
  const minute = parseInt(parts[0]) || 0;
  const hour24 = parseInt(parts[1]) || 0;
  const period: 'AM' | 'PM' = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  return { hour: hour12.toString(), minute: minute.toString(), period };
}

function timePartsToCron(tp: TimeParts): string {
  let hour24 = parseInt(tp.hour);
  const minute = parseInt(tp.minute) || 0;
  if (tp.period === 'AM') {
    if (hour24 === 12) hour24 = 0;
  } else if (hour24 !== 12) {
    hour24 += 12;
  }
  return `${minute} ${hour24} * * *`;
}

function cronToTimeLabel(cron: string): string {
  const tp = cronToTimeParts(cron);
  return `${tp.hour}:${tp.minute.padStart(2, '0')} ${tp.period}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString());

function ScrollColumn({
  items,
  value,
  onChange,
  label,
}: {
  items: { key: string; display: string }[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const displayValue = items.find((i) => i.key === value)?.display || value;

  return (
    <div className="relative flex flex-col items-center" ref={ref}>
      <span className="text-[10px] uppercase text-gray-400 font-bold mb-1.5">{label}</span>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center px-3 py-2 border border-gray-200 rounded-lg bg-white hover:border-brand-primary/40 min-w-[56px]"
      >
        <span className="text-base font-bold text-gray-900">{displayValue}</span>
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-xl p-1.5">
          <div className={`${items.length <= 4 ? '' : 'h-[160px]'} overflow-y-auto w-14 rounded-lg`}>
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onChange(item.key);
                  setOpen(false);
                }}
                className={`w-full py-1.5 text-sm font-medium rounded-md ${
                  value === item.key ? 'bg-brand-primary text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {item.display}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScheduleSettings() {
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();
  const [timeParts, setTimeParts] = useState<Record<string, TimeParts>>({});
  const [minuteValues, setMinuteValues] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.cronjobs,
    queryFn: fetchCronjobs,
    ...cachedQueryOptions,
  });

  const cronJobsToRender: CronJob[] = (() => {
    const existing = data?.data ?? [];
    const map = new Map(existing.map((cj) => [cj.name, cj]));
    for (const key of CORE_CRON_KEYS) {
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: key,
          time: CORE_CRON_DEFAULTS[key],
          createdAt: '',
          updatedAt: '',
          updateById: '',
        });
      }
    }
    return CORE_CRON_KEYS.map((key) => map.get(key)!);
  })();

  const minuteSettingsToRender: CronJob[] = (() => {
    const existing = data?.data ?? [];
    const map = new Map(existing.map((cj) => [cj.name, cj]));
    for (const key of MINUTE_SETTING_KEYS) {
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: key,
          time: MINUTE_SETTING_DEFAULTS[key],
          createdAt: '',
          updatedAt: '',
          updateById: '',
        });
      }
    }
    return MINUTE_SETTING_KEYS.map((key) => map.get(key)!);
  })();

  useEffect(() => {
    if (cronJobsToRender.length) {
      const initial: Record<string, TimeParts> = {};
      cronJobsToRender.forEach((cj) => {
        initial[cj.id] = cronToTimeParts(cj.time);
      });
      setTimeParts(initial);
    }
    if (minuteSettingsToRender.length) {
      const initialMinutes: Record<string, string> = {};
      minuteSettingsToRender.forEach((cj) => {
        initialMinutes[cj.id] = cj.time;
      });
      setMinuteValues(initialMinutes);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: ({ id, name, time }: { id: string; name: string; time: string }) =>
      updateCronjob(id, name, time),
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.cronjobs,
        refetchType: 'active',
      });
      showToast(res.message, res.success ? 'success' : 'error');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as Error)?.message ||
        'Failed to update';
      showError(msg);
    },
  });

  const handleSave = (cj: CronJob) => {
    const tp = timeParts[cj.id];
    if (!tp) return;
    const newCron = timePartsToCron(tp);
    if (newCron === cj.time) return;
    mutation.mutate({ id: cj.id, name: cj.name, time: newCron });
  };

  const handleSaveMinutes = (cj: CronJob) => {
    const raw = minuteValues[cj.id]?.trim() ?? '';
    const minutes = parseInt(raw, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      showError('Enter a positive number of minutes (e.g. 10, 20, 30)');
      return;
    }
    const normalized = String(minutes);
    if (normalized === cj.time) return;
    mutation.mutate({ id: cj.id, name: cj.name, time: normalized });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <RefreshCw size={20} className="animate-spin mr-2" /> Loading schedules...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-gray-700">
        <Clock size={18} className="text-brand-primary" />
        <p className="text-sm font-medium">Configure WhatsApp cron schedules</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {cronJobsToRender.map((cj) => {
        const tp = timeParts[cj.id];
        if (!tp) return null;
        const hasChanged = timePartsToCron(tp) !== cj.time;

        return (
          <div key={cj.id} className="border border-gray-200 rounded-xl p-5 bg-gray-50/40">
            <div className="mb-4">
              <h4 className="font-semibold text-gray-900">{CRON_LABELS[cj.name] || cj.name}</h4>
              <p className="text-xs text-gray-500 mt-0.5">
                {CRON_DESCRIPTIONS[cj.name] || 'Custom schedule'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ScrollColumn
                label="Hour"
                items={HOURS.map((h) => ({ key: h, display: h }))}
                value={tp.hour}
                onChange={(v) => setTimeParts((prev) => ({ ...prev, [cj.id]: { ...tp, hour: v } }))}
              />
              <span className="text-2xl font-bold text-gray-300 self-end mb-3">:</span>
              <ScrollColumn
                label="Min"
                items={MINUTES.map((m) => ({ key: m, display: m.padStart(2, '0') }))}
                value={tp.minute}
                onChange={(v) => setTimeParts((prev) => ({ ...prev, [cj.id]: { ...tp, minute: v } }))}
              />
              <ScrollColumn
                label="Period"
                items={[
                  { key: 'AM', display: 'AM' },
                  { key: 'PM', display: 'PM' },
                ]}
                value={tp.period}
                onChange={(v) =>
                  setTimeParts((prev) => ({
                    ...prev,
                    [cj.id]: { ...tp, period: v as 'AM' | 'PM' },
                  }))
                }
              />
              <button
                onClick={() => handleSave(cj)}
                disabled={mutation.isPending || !hasChanged}
                className="ml-auto flex items-center gap-2 px-5 py-3 bg-brand-primary text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                <Save size={14} />
                Save
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Current: <span className="font-medium text-gray-600">{cronToTimeLabel(cj.time)}</span>
            </p>
          </div>
        );
      })}

      {minuteSettingsToRender.map((cj) => {
        const value = minuteValues[cj.id] ?? cj.time;
        const hasChanged = value.trim() !== cj.time;

        return (
          <div key={cj.id} className="border border-gray-200 rounded-xl p-5 bg-gray-50/40">
            <div className="mb-4">
              <h4 className="font-semibold text-gray-900">{CRON_LABELS[cj.name] || cj.name}</h4>
              <p className="text-xs text-gray-500 mt-0.5">
                {CRON_DESCRIPTIONS[cj.name] || 'Custom setting'}
              </p>
            </div>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase text-gray-400 font-bold">Minutes</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={value}
                  onChange={(e) =>
                    setMinuteValues((prev) => ({ ...prev, [cj.id]: e.target.value }))
                  }
                  className="w-28 rounded-lg border border-gray-200 px-3 py-2.5 text-base font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  placeholder="30"
                />
              </div>
              <button
                onClick={() => handleSaveMinutes(cj)}
                disabled={mutation.isPending || !hasChanged}
                className="ml-auto flex items-center gap-2 px-5 py-3 bg-brand-primary text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                <Save size={14} />
                Save
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Current: <span className="font-medium text-gray-600">{cj.time} min</span>
            </p>
          </div>
        );
      })}
      </div>
    </div>
  );
}
