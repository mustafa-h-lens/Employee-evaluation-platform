import { supabase } from './supabase';

export interface WeightPair {
  general: number;
  specific: number;
}

const directorateCache = new Map<string, WeightPair>();
const supervisorCache = new Map<string, WeightPair>();
let highMgmtCache: WeightPair | null = null;

// Per-employee directorate weights — used when a director evaluates an
// employee. Falls back to the active period's weights, then 50/50.
// directorateId is optional: pass it when the employee is in MULTIPLE
// directorates (the same person can have separate evaluations per
// directorate, each using the group weights for that specific directorate).
export async function getDirectorateWeightsForEmployee(
  employeeId: string,
  directorateId?: string | null,
): Promise<WeightPair> {
  const cacheKey = `${employeeId}:${directorateId || ''}`;
  const hit = directorateCache.get(cacheKey);
  if (hit) return hit;

  // When a directorate is specified, look up the group ONLY in that
  // directorate (so two evaluations of the same person under different
  // directorates pull each directorate's own group weights independently).
  if (directorateId) {
    const { data: gm } = await supabase
      .from('department_criteria_group_members')
      .select('group:department_criteria_groups(general_weight, specific_weight)')
      .eq('employee_id', employeeId)
      .eq('directorate_id', directorateId)
      .maybeSingle();
    const group = (gm as any)?.group;
    const groupRow = Array.isArray(group) ? group[0] : group;
    if (groupRow) {
      const pair: WeightPair = {
        general: Number(groupRow.general_weight ?? 50),
        specific: Number(groupRow.specific_weight ?? 50),
      };
      directorateCache.set(cacheKey, pair);
      return pair;
    }
  }

  const { data, error } = await supabase.rpc('get_employee_directorate_weights', { p_employee_id: employeeId });
  if (error) {
    console.error('get_employee_directorate_weights RPC failed', error);
    return { general: 50, specific: 50 };
  }
  const row = Array.isArray(data) ? data[0] : data;
  const pair: WeightPair = {
    general: Number(row?.general_weight ?? 50),
    specific: Number(row?.specific_weight ?? 50),
  };
  directorateCache.set(cacheKey, pair);
  return pair;
}

export async function getSupervisorWeightsForEmployee(employeeId: string): Promise<WeightPair> {
  const hit = supervisorCache.get(employeeId);
  if (hit) return hit;
  const { data, error } = await supabase.rpc('get_employee_supervisor_weights', { p_employee_id: employeeId });
  if (error) {
    console.error('get_employee_supervisor_weights RPC failed', error);
    return { general: 50, specific: 50 };
  }
  const row = Array.isArray(data) ? data[0] : data;
  const pair: WeightPair = {
    general: Number(row?.general_weight ?? 50),
    specific: Number(row?.specific_weight ?? 50),
  };
  supervisorCache.set(employeeId, pair);
  return pair;
}

// One global pair for CEO → director evaluations.
export async function getHighManagementWeights(): Promise<WeightPair> {
  if (highMgmtCache) return highMgmtCache;
  const { data, error } = await supabase
    .from('high_management_weight_settings')
    .select('general_weight, specific_weight')
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    console.error('high_management_weight_settings read failed', error);
    return { general: 50, specific: 50 };
  }
  highMgmtCache = { general: Number(data.general_weight), specific: Number(data.specific_weight) };
  return highMgmtCache;
}

// Drop cached values when an admin updates weights so the next reader sees
// the new values without a page reload.
export function invalidateWeightsCache(): void {
  directorateCache.clear();
  supervisorCache.clear();
  highMgmtCache = null;
}
