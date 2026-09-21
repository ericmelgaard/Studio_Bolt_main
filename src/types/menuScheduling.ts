export interface MenuSchedule {
  id: string;
  menu_id: string;
  schedule_type: 'one_time' | 'recurring';
  recurrence_pattern: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'every_n_weeks' | 'nth_weekday' | null;
  recurrence_days_of_week: number[] | null;
  recurrence_interval: number | null;
  recurrence_week_of_month: number | null;
  start_date: string | null;
  end_date: string | null;
  priority: number;
  is_active: boolean;
  placement_group_id: string | null;
  daypart_definition_id: string | null;
  custom_start_time: string | null;
  custom_end_time: string | null;
  source: string | null;
  source_ref: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  menu?: {
    id: string;
    name: string;
    brand_id: number | null;
    status: string;
    menu_type: string | null;
  };
}

export interface CalendarViewMode {
  type: 'day' | 'week' | 'month';
}

export interface CalendarDay {
  date: Date;
  isToday: boolean;
  isCurrentMonth: boolean;
  schedules: MenuSchedule[];
  hasGap: boolean;
  hasConflict: boolean;
}

export interface ScheduleConflict {
  date: Date;
  schedules: MenuSchedule[];
  placementGroupId: string | null;
  daypartId: string | null;
}

export interface ScheduleGap {
  date: Date;
  placementGroupId: string | null;
  daypartId: string | null;
}

export interface CreateScheduleForm {
  schedule_type: 'one_time' | 'recurring';
  recurrence_pattern: MenuSchedule['recurrence_pattern'];
  recurrence_days_of_week: number[];
  recurrence_interval: number;
  recurrence_week_of_month: number;
  start_date: string;
  end_date: string;
  priority: number;
  placement_group_id: string;
  daypart_definition_id: string;
  custom_start_time: string;
  custom_end_time: string;
  notes: string;
}
