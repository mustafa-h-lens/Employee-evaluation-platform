import { supabase } from './supabase';

const cache = new Map<string, number>();

// Wraps the Postgres evaluable_months(employee_id, from_month, to_month)
// helper. Caches per (employee, from, to) so the same report render doesn't
// re-roundtrip per row. fromIso / toIso must be 'YYYY-MM-01' (first of the
// covered months). The DB CHECK constraints assume month-first dates.
export async function getEvaluableMonths(
  employeeId: string,
  fromIso: string,
  toIso: string,
): Promise<number> {
  const key = `${employeeId}:${fromIso}:${toIso}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const { data, error } = await supabase.rpc('evaluable_months', {
    p_employee_id: employeeId,
    p_from: fromIso,
    p_to: toIso,
  });
  if (error) {
    console.error('evaluable_months RPC failed', error);
    return totalMonthsBetween(fromIso, toIso); // safe fallback
  }
  const n = (data as unknown as number) || 0;
  cache.set(key, n);
  return n;
}

// Drop cached values when leaves change, e.g. after EmployeeLeaves page edits.
export function invalidateEvaluableMonthsCache(): void {
  cache.clear();
}

export function totalMonthsBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
}

// Helpers to build the "year-MM-01" range for annual / quarterly windows.
export function annualRange(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-01` };
}

export function quarterlyRange(year: number, quarter: number): { from: string; to: string } {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = quarter * 3;
  const pad = (m: number) => String(m).padStart(2, '0');
  return { from: `${year}-${pad(startMonth)}-01`, to: `${year}-${pad(endMonth)}-01` };
}

// Pulls the leaves that overlap the given window for a single employee. Used
// to render the "تم التقييم في 9 من 12 شهر — إجازة أمومة (مارس–مايو)" chip.
export interface LeaveSummary {
  type_name: string;
  start_month: string;
  end_month: string;
}

export async function getLeavesForEmployeeInRange(
  employeeId: string,
  fromIso: string,
  toIso: string,
): Promise<LeaveSummary[]> {
  const { data } = await supabase
    .from('employee_leaves')
    .select('start_month, end_month, leave_type:employee_leave_types(name)')
    .eq('employee_id', employeeId)
    .lte('start_month', toIso)
    .gte('end_month', fromIso)
    .order('start_month');
  return ((data || []) as any[]).map((r: any) => ({
    type_name: r.leave_type?.name || 'إجازة',
    start_month: r.start_month,
    end_month: r.end_month,
  }));
}
