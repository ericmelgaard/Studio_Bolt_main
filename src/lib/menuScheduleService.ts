import type { MenuSchedule, ScheduleConflict } from '../types/menuScheduling';

type ScheduleLike = Pick<MenuSchedule,
  'schedule_type' | 'recurrence_pattern' | 'recurrence_days_of_week' |
  'recurrence_interval' | 'recurrence_week_of_month' | 'start_date' |
  'end_date' | 'is_active'
>;

export function doesScheduleMatchDate(schedule: ScheduleLike, date: Date): boolean {
  if (!schedule.is_active) return false;

  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (schedule.start_date) {
    const start = parseLocalDate(schedule.start_date);
    if (d < start) return false;
  }
  if (schedule.end_date) {
    const end = parseLocalDate(schedule.end_date);
    if (d > end) return false;
  }

  if (schedule.schedule_type === 'one_time') {
    if (!schedule.start_date) return false;
    const start = parseLocalDate(schedule.start_date);
    return d.getTime() === start.getTime();
  }

  const dayOfWeek = d.getDay();

  switch (schedule.recurrence_pattern) {
    case 'daily':
      return true;

    case 'weekly':
      return schedule.recurrence_days_of_week?.includes(dayOfWeek) ?? false;

    case 'biweekly': {
      if (!schedule.recurrence_days_of_week?.includes(dayOfWeek)) return false;
      if (!schedule.start_date) return true;
      const start = parseLocalDate(schedule.start_date);
      const diffWeeks = Math.floor((d.getTime() - start.getTime()) / (7 * 86400000));
      return diffWeeks % 2 === 0;
    }

    case 'every_n_weeks': {
      if (!schedule.recurrence_days_of_week?.includes(dayOfWeek)) return false;
      const interval = schedule.recurrence_interval ?? 1;
      if (!schedule.start_date) return true;
      const start = parseLocalDate(schedule.start_date);
      const diffWeeks = Math.floor((d.getTime() - start.getTime()) / (7 * 86400000));
      return diffWeeks % interval === 0;
    }

    case 'monthly': {
      const dayOfMonth = d.getDate();
      return schedule.recurrence_days_of_week?.includes(dayOfMonth) ?? false;
    }

    case 'nth_weekday': {
      if (!schedule.recurrence_days_of_week?.includes(dayOfWeek)) return false;
      const weekOfMonth = Math.ceil(d.getDate() / 7);
      return weekOfMonth === (schedule.recurrence_week_of_month ?? 1);
    }

    default:
      return false;
  }
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function resolveActiveMenus(
  schedules: MenuSchedule[],
  date: Date
): MenuSchedule[] {
  const matching = schedules.filter(s => doesScheduleMatchDate(s, date));

  const grouped = new Map<string, MenuSchedule[]>();
  for (const s of matching) {
    const key = `${s.placement_group_id ?? 'null'}|${s.daypart_definition_id ?? 'null'}`;
    const arr = grouped.get(key) ?? [];
    arr.push(s);
    grouped.set(key, arr);
  }

  const winners: MenuSchedule[] = [];
  for (const group of grouped.values()) {
    group.sort((a, b) => scoreSchedule(b) - scoreSchedule(a));
    winners.push(group[0]);
  }
  return winners;
}

function scoreSchedule(s: MenuSchedule): number {
  let score = s.priority ?? 0;
  if (s.schedule_type === 'one_time') score += 100;
  if (s.placement_group_id) score += 1000;
  if (s.daypart_definition_id) score += 500;
  return score;
}

export function findScheduleConflicts(
  schedules: MenuSchedule[],
  startDate: Date,
  endDate: Date
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const d = new Date(startDate);
  while (d <= endDate) {
    const matching = schedules.filter(s => doesScheduleMatchDate(s, d));

    const grouped = new Map<string, MenuSchedule[]>();
    for (const s of matching) {
      const key = `${s.placement_group_id ?? 'null'}|${s.daypart_definition_id ?? 'null'}`;
      const arr = grouped.get(key) ?? [];
      arr.push(s);
      grouped.set(key, arr);
    }

    for (const [key, group] of grouped.entries()) {
      if (group.length > 1) {
        const [pgId, dpId] = key.split('|');
        conflicts.push({
          date: new Date(d),
          schedules: group,
          placementGroupId: pgId === 'null' ? null : pgId,
          daypartId: dpId === 'null' ? null : dpId,
        });
      }
    }

    d.setDate(d.getDate() + 1);
  }
  return conflicts;
}

export function formatScheduleDescription(schedule: ScheduleLike): string {
  if (schedule.schedule_type === 'one_time') {
    return schedule.start_date
      ? `One-time on ${formatDate(schedule.start_date)}`
      : 'One-time (no date)';
  }

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  switch (schedule.recurrence_pattern) {
    case 'daily':
      return 'Every day';
    case 'weekly': {
      const days = (schedule.recurrence_days_of_week ?? []).map(d => DAY_NAMES[d]).join(', ');
      return days ? `Weekly on ${days}` : 'Weekly';
    }
    case 'biweekly': {
      const days = (schedule.recurrence_days_of_week ?? []).map(d => DAY_NAMES[d]).join(', ');
      return days ? `Every 2 weeks on ${days}` : 'Every 2 weeks';
    }
    case 'every_n_weeks': {
      const n = schedule.recurrence_interval ?? 1;
      const days = (schedule.recurrence_days_of_week ?? []).map(d => DAY_NAMES[d]).join(', ');
      return days ? `Every ${n} weeks on ${days}` : `Every ${n} weeks`;
    }
    case 'monthly': {
      const days = (schedule.recurrence_days_of_week ?? []).join(', ');
      return days ? `Monthly on day ${days}` : 'Monthly';
    }
    case 'nth_weekday': {
      const week = schedule.recurrence_week_of_month ?? 1;
      const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th'];
      const days = (schedule.recurrence_days_of_week ?? []).map(d => DAY_NAMES[d]).join(', ');
      return `${ordinals[week] ?? week + 'th'} ${days} of each month`;
    }
    default:
      return 'Custom schedule';
  }
}

function formatDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getNextOccurrences(schedule: ScheduleLike, count: number, from?: Date): Date[] {
  const results: Date[] = [];
  const d = from ? new Date(from) : new Date();
  d.setHours(0, 0, 0, 0);
  let safety = 0;
  while (results.length < count && safety < 365) {
    if (doesScheduleMatchDate(schedule, d)) {
      results.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
    safety++;
  }
  return results;
}
