import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface LeaveInfo {
  type_name: string;
  start_month: string; // 'YYYY-MM-01'
  end_month: string;   // 'YYYY-MM-01'
}

// Centralized "is this person on leave during this month" lookup. One round
// trip per (period start month) pull, then constant-time .has() / .get()
// per row. Used by every picker and every report so the rule is defined
// in one place.
export function useEmployeeLeaveStatus(periodStartMonth?: string | null) {
  const [byEmployee, setByEmployee] = useState<Map<string, LeaveInfo>>(new Map());
  const [byUser, setByUser] = useState<Map<string, LeaveInfo>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchLeaves = useCallback(async () => {
    if (!periodStartMonth) {
      setByEmployee(new Map());
      setByUser(new Map());
      return;
    }
    setLoading(true);
    try {
      // periodStartMonth comes in as 'YYYY-MM-DD' (typically the 1st);
      // normalize to the first of that month for the comparison.
      const monthFirst = periodStartMonth.slice(0, 7) + '-01';
      const { data } = await supabase
        .from('employee_leaves')
        .select(`
          employee_id, start_month, end_month,
          employee:employees(user_id),
          leave_type:employee_leave_types(name)
        `)
        .lte('start_month', monthFirst)
        .gte('end_month', monthFirst);

      const empMap = new Map<string, LeaveInfo>();
      const userMap = new Map<string, LeaveInfo>();
      ((data || []) as any[]).forEach((r: any) => {
        const info: LeaveInfo = {
          type_name: r.leave_type?.name || 'إجازة',
          start_month: r.start_month,
          end_month: r.end_month,
        };
        empMap.set(r.employee_id, info);
        if (r.employee?.user_id) userMap.set(r.employee.user_id, info);
      });
      setByEmployee(empMap);
      setByUser(userMap);
    } finally {
      setLoading(false);
    }
  }, [periodStartMonth]);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  return {
    loading,
    isOnLeave: (employeeId: string): LeaveInfo | null => byEmployee.get(employeeId) || null,
    isUserOnLeave: (userId: string): LeaveInfo | null => byUser.get(userId) || null,
    refresh: fetchLeaves,
  };
}

export const formatLeaveChip = (info: LeaveInfo): string => {
  const start = new Date(info.start_month).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  const end = new Date(info.end_month).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  return info.start_month === info.end_month
    ? `${info.type_name} (${start})`
    : `${info.type_name} (${start} – ${end})`;
};
