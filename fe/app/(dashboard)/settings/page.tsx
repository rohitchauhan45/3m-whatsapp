'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Save, LogOut, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/utils/auth';
import { fetchCronjobs, updateCronjob, CronJob } from '@/lib/services/settingsService';
import { usePageHeader } from '@/lib/utils/page-header-context';

const CRON_LABELS: Record<string, string> = {
  default_task_assign_time: "Task Assign Time",
  default_task_followup_time: "Task Follow-up Time",
  default_task_ontrack_time: "Morning On-Track Check",
};

const CRON_DESCRIPTIONS: Record<string, string> = {
  default_task_assign_time: "Daily time to send task assignments via WhatsApp",
  default_task_followup_time: "Daily time to send follow-up reminders to users",
  default_task_ontrack_time: "Daily time to ask users if accepted tasks are on track (7 AM default)",
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
  } else {
    if (hour24 !== 12) hour24 += 12;
  }
  return `${minute} ${hour24} * * *`;
}

function cronToTimeLabel(cron: string): string {
  const tp = cronToTimeParts(cron);
  return `${tp.hour}:${tp.minute.padStart(2, '0')} ${tp.period}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString());

function ScrollColumn({ items, value, onChange, label }: {
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
        className="flex items-center justify-center px-3 py-2 border border-gray-200 rounded-lg bg-white hover:border-brand-primary/40 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all min-w-[56px]"
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
                onClick={() => { onChange(item.key); setOpen(false); }}
                className={`w-full py-1.5 text-sm font-medium rounded-md transition-all ${
                  value === item.key
                    ? 'bg-brand-primary text-white'
                    : 'text-gray-700 hover:bg-gray-100'
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

export default function SettingsPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const { setBreadcrumb, setOnBack } = usePageHeader();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [timeParts, setTimeParts] = useState<Record<string, TimeParts>>({});

  useEffect(() => {
    setBreadcrumb('');
    setOnBack(null);
    return () => { setBreadcrumb(''); setOnBack(null); };
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const { data, isLoading } = useQuery({
    queryKey: ['cronjobs'],
    queryFn: fetchCronjobs,
  });

  useEffect(() => {
    if (data?.data) {
      const initial: Record<string, TimeParts> = {};
      data.data.forEach((cj) => { initial[cj.id] = cronToTimeParts(cj.time); });
      setTimeParts(initial);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: ({ id, name, time }: { id: string; name: string; time: string }) =>
      updateCronjob(id, name, time),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['cronjobs'] });
      setToast({ message: res.message, type: res.success ? 'success' : 'error' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err.message || 'Failed to update';
      setToast({ message: msg, type: 'error' });
    },
  });

  const updateTime = (id: string, tp: TimeParts) => {
    setTimeParts((prev) => ({ ...prev, [id]: tp }));
  };

  const handleSave = (cj: CronJob) => {
    const tp = timeParts[cj.id];
    if (!tp) return;
    const newCron = timePartsToCron(tp);
    if (newCron === cj.time) return;
    mutation.mutate({ id: cj.id, name: cj.name, time: newCron });
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="max-w-2xl mx-auto pb-20">
      <div className="bg-white border border-gray-200 rounded-2xl mb-6">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
          <Clock size={18} className="text-brand-primary" />
          <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Schedule Settings</h3>
        </div>

        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <RefreshCw size={20} className="animate-spin mr-2" /> Loading...
            </div>
          ) : data?.data?.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No schedules configured. Run the seed script first.</p>
          ) : (
            data?.data?.map((cj) => {
              const tp = timeParts[cj.id];
              if (!tp) return null;
              const currentCron = timePartsToCron(tp);
              const hasChanged = currentCron !== cj.time;

              return (
                <div key={cj.id} className="border border-gray-200 rounded-xl p-5 overflow-visible">
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 text-base">
                      {CRON_LABELS[cj.name] || cj.name}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {CRON_DESCRIPTIONS[cj.name] || 'Custom schedule'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <ScrollColumn
                      label="Hour"
                      items={HOURS.map((h) => ({ key: h, display: h }))}
                      value={tp.hour}
                      onChange={(v) => updateTime(cj.id, { ...tp, hour: v })}
                    />

                    <span className="text-2xl font-bold text-gray-300 self-end mb-3">:</span>

                    <ScrollColumn
                      label="Min"
                      items={MINUTES.map((m) => ({ key: m, display: m.padStart(2, '0') }))}
                      value={tp.minute}
                      onChange={(v) => updateTime(cj.id, { ...tp, minute: v })}
                    />

                    <ScrollColumn
                      label="Period"
                      items={[{ key: 'AM', display: 'AM' }, { key: 'PM', display: 'PM' }]}
                      value={tp.period}
                      onChange={(v) => updateTime(cj.id, { ...tp, period: v as 'AM' | 'PM' })}
                    />

                    <button
                      onClick={() => handleSave(cj)}
                      disabled={mutation.isPending || !hasChanged}
                      className="ml-auto flex items-center gap-2 px-5 py-3 bg-brand-primary text-white rounded-xl text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <Save size={14} />
                      Save
                    </button>
                  </div>

                  <p className="text-xs text-gray-400 mt-3">
                    Currently set to: <span className="font-medium text-gray-600">{cronToTimeLabel(cj.time)}</span>
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className="fixed top-6 right-6 z-50 animate-slide-up">
      <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border ${type === 'success'
        ? 'bg-white border-green-200 text-green-800'
        : 'bg-white border-red-200 text-red-800'
        }`}>
        {type === 'success' ? <CheckCircle2 size={18} className="text-green-500" /> : <XCircle size={18} className="text-red-500" />}
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 text-gray-400 hover:text-gray-600">x</button>
      </div>
    </div>
  );
}
