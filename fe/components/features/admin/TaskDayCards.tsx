'use client';

import { Calendar, Loader2, Plus, Users } from 'lucide-react';
import type { AdminTaskDay } from '@/lib/services/taskService';
import type { DraftTaskCard } from '@/lib/utils/draftTaskCards';
import { formatTaskTabDate } from '@/lib/utils/taskTabDate';
import { ui } from '@/lib/utils/ui-classes';

const RELATIVE_DAY_LABELS = new Set(['Today', 'Yesterday', 'Tomorrow']);

type TaskDayCardsProps = {
  days: AdminTaskDay[];
  draftCards: DraftTaskCard[];
  isLoading: boolean;
  onSelectDay: (day: AdminTaskDay) => void;
  onSelectDraft: (card: DraftTaskCard) => void;
  onAddTask: () => void;
};

function DraftCard({
  card,
  onSelect,
}: {
  card: DraftTaskCard;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="bg-white border border-gray-200 rounded-xl p-3 min-h-[140px] text-left hover:shadow-md hover:border-brand-primary/30 transition-all flex flex-col justify-between"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-brand-primary">{card.taskCount}</span>
          <span className="text-xs text-gray-500">tasks</span>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[19px] font-semibold text-amber-600 uppercase tracking-wide">Draft</p>
          {card.taskDate && (
            <p className="text-[14px] font-medium text-brand-primary">{card.taskDate}</p>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between gap-2 mt-4">
        <span className="flex items-center gap-1.5 text-[14px] text-gray-500">
          <Users size={15} className="text-brand-primary/70" /> {card.userCount}{' '}
          {card.userCount === 1 ? 'user' : 'users'}
        </span>
        <p className="text-[13px] text-gray-500 shrink-0">
          created : <span className="text-gray-700">{card.createdAtLabel}</span>
        </p>
      </div>
    </button>
  );
}

function TaskDayCard({
  day,
  onSelect,
}: {
  day: AdminTaskDay;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="bg-white border border-gray-200 rounded-xl p-3 min-h-[140px] text-left hover:shadow-md hover:border-brand-primary/30 transition-all flex flex-col justify-between"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-brand-primary">{day.taskCount}</span>
          <span className="text-xs text-gray-500">tasks</span>
        </div>
        <div className="text-right">
          {RELATIVE_DAY_LABELS.has(day.label) ? (
            <>
              <p className="text-lg font-semibold text-gray-800">{day.label}</p>
              <p className="text-xs text-brand-primary font-medium">
                {formatTaskTabDate(day.date)}
              </p>
            </>
          ) : (
            <p className="text-lg font-semibold text-gray-800">{formatTaskTabDate(day.date)}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 mt-4 text-[14px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <Users size={15} className="text-brand-primary/60" /> {day.userCount}{' '}
          {day.userCount === 1 ? 'user' : 'users'}
        </span>
        <span>
          {day.managerCount} {day.managerCount === 1 ? 'manager' : 'managers'}
        </span>
      </div>
    </button>
  );
}

export default function TaskDayCards({
  days,
  draftCards,
  isLoading,
  onSelectDay,
  onSelectDraft,
  onAddTask,
}: TaskDayCardsProps) {
  const hasDrafts = draftCards.length > 0;
  const hasTasks = days.length > 0;
  const isEmpty = !hasDrafts && !hasTasks;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <button type="button" onClick={onAddTask} className={ui.btnPrimary}>
          <Plus size={16} />
          Add Task
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-gray-400" />
        </div>
      )}

      {!isLoading && isEmpty && (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Calendar size={28} className="text-gray-400" />
          </div>
          <p className="text-gray-600 font-medium">No tasks yet</p>
          <p className="text-sm text-gray-400 mt-1">Upload an assignTask.xlsx to get started</p>
        </div>
      )}

      {!isLoading && !isEmpty && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {draftCards.map((card) => (
            <DraftCard key={card.key} card={card} onSelect={() => onSelectDraft(card)} />
          ))}
          {days.map((day) => (
            <TaskDayCard
              key={`${day.date}-${day.label}`}
              day={day}
              onSelect={() => onSelectDay(day)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
