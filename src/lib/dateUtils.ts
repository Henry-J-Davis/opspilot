export function isOverdue(
  dueDate: string | Date | null | undefined,
  completed: boolean
): boolean {
  if (!dueDate) return false;
  if (completed) return false;

  let due: Date;
  if (typeof dueDate === "string") {
    due = new Date(dueDate);
  } else {
    due = dueDate;
  }
  if (isNaN(due.getTime())) return false;

  // We consider overdue if current date/time is after the end of due date day in user's local timezone.
  // So we get the due date's local day end (23:59:59.999) and compare current local time.

  // Create a Date object at local time for due date's day end
  const dueLocal = new Date(due);
  dueLocal.setHours(23, 59, 59, 999);

  const now = new Date();

  return now > dueLocal;
}