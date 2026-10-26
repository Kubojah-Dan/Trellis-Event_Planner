export interface DateValidationIssue {
  field: string;
  message: string;
  code: 'INVALID_FORMAT' | 'INVALID_TIMEZONE' | 'DUE_AFTER_EVENT' | 'PAST_EVENT_DATE' | 'CHRONOLOGY_ERROR';
}

export interface DateValidationResult {
  isValid: boolean;
  issues: DateValidationIssue[];
}

export function isValidISODate(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const parsed = Date.parse(dateStr);
  return !isNaN(parsed);
}

export function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface DatedItem {
  id: string;
  title: string;
  dueAt?: string; // ISO date string
}

export function validateEventChronology(
  eventDateStr?: string,
  timezone: string = 'UTC',
  tasks: DatedItem[] = []
): DateValidationResult {
  const issues: DateValidationIssue[] = [];

  if (timezone && !isValidTimezone(timezone)) {
    issues.push({
      field: 'timezone',
      message: `Invalid IANA timezone: "${timezone}".`,
      code: 'INVALID_TIMEZONE',
    });
  }

  if (eventDateStr) {
    if (!isValidISODate(eventDateStr)) {
      issues.push({
        field: 'eventDate',
        message: `Invalid ISO date format for eventDate: "${eventDateStr}".`,
        code: 'INVALID_FORMAT',
      });
    } else {
      const eventTime = new Date(eventDateStr).getTime();

      for (const task of tasks) {
        if (task.dueAt) {
          if (!isValidISODate(task.dueAt)) {
            issues.push({
              field: `task.${task.id}.dueAt`,
              message: `Task "${task.title}" has an invalid due date format: "${task.dueAt}".`,
              code: 'INVALID_FORMAT',
            });
          } else {
            const taskTime = new Date(task.dueAt).getTime();
            // Milestone preparation tasks must not be scheduled AFTER the main event date
            if (taskTime > eventTime + 86400000) { // allow 24h grace for same-day wrap-up
              issues.push({
                field: `task.${task.id}.dueAt`,
                message: `Task "${task.title}" is due after the celebration date (${task.dueAt} > ${eventDateStr}).`,
                code: 'DUE_AFTER_EVENT',
              });
            }
          }
        }
      }
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

export function calculateDaysRemaining(eventDateStr: string, fromDate: Date = new Date()): {
  daysRemaining: number;
  isPast: boolean;
  formattedCountdown: string;
} {
  if (!isValidISODate(eventDateStr)) {
    return { daysRemaining: 0, isPast: false, formattedCountdown: 'Date to be confirmed' };
  }

  const target = new Date(eventDateStr).getTime();
  const current = fromDate.getTime();
  const diffMs = target - current;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      daysRemaining: diffDays,
      isPast: true,
      formattedCountdown: `${Math.abs(diffDays)} days ago`,
    };
  }

  if (diffDays === 0) {
    return {
      daysRemaining: 0,
      isPast: false,
      formattedCountdown: 'Today!',
    };
  }

  return {
    daysRemaining: diffDays,
    isPast: false,
    formattedCountdown: `${diffDays} days to go`,
  };
}
