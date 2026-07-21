const TASK_STATUS_CLASSES: Record<string, string> = {
  completed: 'text-green-600',
  inProgress: 'text-blue-600',
  remark: 'text-red-400',
  cancelled: 'text-red-600',
  blocked: 'text-orange-600',
  hold: 'text-amber-600',
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
