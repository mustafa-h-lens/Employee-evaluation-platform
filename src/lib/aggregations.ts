import { supabase } from './supabase';

// Per-period summary across all directorate-scoped evaluations for an
// employee. Reports / employee-facing pages read from this view so an
// employee with two directorate-scoped evaluations in the same period
// shows up as ONE row whose percentage is the arithmetic mean of both.
// Per-directorate rows are still kept in `evaluations` for approval and
// audit; they're only collapsed at the summary layer.
export interface EmployeePeriodSummary {
  employee_id: string;
  period_id: string;
  source_count: number;        // how many directorate evals contribute
  percentage: number;
  final_score_5: number;
  final_score_500: number;
  general_rating: string;
  directorate_ids: string[] | null;
  source_evaluation_ids: string[];
  submitted_at: string | null;
  created_at: string;
}

export async function fetchEmployeePeriodSummaries(filters: {
  employeeId?: string;
  periodId?: string;
  periodIds?: string[];
}): Promise<EmployeePeriodSummary[]> {
  let q = supabase.from('employee_period_evaluations').select('*');
  if (filters.employeeId) q = q.eq('employee_id', filters.employeeId);
  if (filters.periodId) q = q.eq('period_id', filters.periodId);
  if (filters.periodIds && filters.periodIds.length > 0) q = q.in('period_id', filters.periodIds);
  const { data, error } = await q;
  if (error) {
    console.error('employee_period_evaluations read failed', error);
    return [];
  }
  return (data || []) as unknown as EmployeePeriodSummary[];
}

const dirCountCache = new Map<string, number>();

// How many directorates the employee is currently assigned to. Used by
// summary UIs to render "1 من 2 إدارات" when only some directorates have
// submitted yet.
export async function getEmployeeDirectorateCount(employeeId: string): Promise<number> {
  const hit = dirCountCache.get(employeeId);
  if (hit !== undefined) return hit;
  const { data, error } = await supabase.rpc('employee_directorate_count', { p_employee_id: employeeId });
  if (error) {
    console.error('employee_directorate_count RPC failed', error);
    return 1;
  }
  const n = Number(data ?? 1);
  dirCountCache.set(employeeId, n);
  return n;
}

export function invalidateAggregationsCache(): void {
  dirCountCache.clear();
}
