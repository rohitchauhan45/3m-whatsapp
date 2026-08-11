const TASK_STATUS_CLASSES: Record<string, string> = {
  completed: 'text-green-600',
  inProgress: 'text-blue-600',
  remark: 'text-red-400',
  cancelled: 'text-red-600',
  blocked: 'text-orange-600',
  hold: 'text-amber-600',
  delayed: 'text-orange-600',
  notSend: 'text-red-600',
  pending: 'text-red-600',
  onTrack: 'text-blue-600',
  deleted: 'text-gray-500',
};

export function getTaskStatusClassName(status: string | null | undefined): string {
  const key = status || 'pending';
  return TASK_STATUS_CLASSES[key] ?? TASK_STATUS_CLASSES.pending;
}

const USER_STATUS_CLASSES: Record<string, string> = {
  accept: 'text-green-600',
  decline: 'text-red-600',
  remaining: 'text-amber-600',
};

export function getUserStatusClassName(
  status: string | null | undefined,
  sent?: boolean | null,
): string {
  const displayStatus = status || 'remaining';
  if (displayStatus === 'remaining' && sent !== undefined) {
    return sent ? 'text-red-600' : 'text-gray-500';
  }
  return USER_STATUS_CLASSES[displayStatus] ?? 'text-gray-600';
}

const ON_TRACK_STATUS_CLASSES: Record<string, string> = {
  onTrack: 'text-green-600',
  remark: 'text-amber-600',
  remaining: 'text-gray-500',
  absent: 'text-red-600',
};

export function getOnTrackStatusClassName(status: string | null | undefined): string {
  if (!status) return 'text-gray-500';
  return ON_TRACK_STATUS_CLASSES[status] ?? 'text-gray-600';
}

export function getSentClassName(sent: boolean): string {
  return sent ? 'text-green-600' : 'text-red-600';
}

const PROJECT_TASK_STATUS_TEXT_CLASSES: Record<string, string> = {
  completed: 'text-green-600',
  'in progress': 'text-blue-600',
  pending: 'text-amber-600',
  'on hold': 'text-orange-600',
  cancelled: 'text-red-600',
};

function normalizeProjectTaskStatus(status: string | null | undefined): string {
  return (status ?? 'pending').trim().toLowerCase();
}

export function getProjectTaskStatusTextClassName(status: string | null | undefined): string {
  const key = normalizeProjectTaskStatus(status);
  return PROJECT_TASK_STATUS_TEXT_CLASSES[key] ?? PROJECT_TASK_STATUS_TEXT_CLASSES.pending;
}
