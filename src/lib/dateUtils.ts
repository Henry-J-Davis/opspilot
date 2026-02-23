export function isOverdue(dueDateIso: string | null, completed: boolean): boolean {
  if (!dueDateIso) return false;
  if (completed) return false;

  const due = new Date(dueDateIso);
  if (Number.isNaN(due.getTime())) return false;

  return due.getTime() < Date.now();
}