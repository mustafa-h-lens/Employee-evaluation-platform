import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { BarChart3, Search, User, Calendar, Star, MessageSquare, FileText, ChevronDown, Crown, UserCheck, X } from 'lucide-react';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { ModernSelect } from '../../components/ui/ModernSelect';
import { getEvaluableMonths, getLeavesForEmployeeInRange, annualRange, quarterlyRange, LeaveSummary } from '../../lib/leaves';

const monthLabels: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
};

const quarterLabels: Record<number, string> = {
  1: 'الربع الأول (يناير - مارس)',
  2: 'الربع الثاني (أبريل - يونيو)',
  3: 'الربع الثالث (يوليو - سبتمبر)',
  4: 'الربع الرابع (أكتوبر - ديسمبر)',
};

const getRatingVariant = (rating: string | null): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
  switch (rating) {
    case 'ممتاز': return 'success';
    case 'جيد جدًا': return 'info';
    case 'جيد': return 'warning';
    case 'يحتاج تحسين': return 'danger';
    default: return 'default';
  }
};

const getStatusVariant = (status: string): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
  switch (status) {
    case 'بانتظار الموافقة': return 'warning';
    case 'موافقة': case 'تم الإرسال': case 'اطلع المدير': case 'اطلع الموظف': case 'مغلق': case 'مكتمل': return 'success';
    case 'مرفوض': return 'danger';
    default: return 'default';
  }
};

const getStatusLabel = (status: string): string => {
  if (status === 'بانتظار الموافقة') return 'بانتظار اعتماد التقييم';
  if (['موافقة', 'تم الإرسال', 'اطلع المدير', 'اطلع الموظف', 'مغلق', 'مكتمل'].includes(status)) return 'تم اعتماد التقييم';
  if (status === 'مرفوض') return 'مرفوض';
  if (!status || status === 'مسودة') return 'بانتظار التقييم';
  return status;
};

interface PersonOption {
  id: string;
  full_name: string;
  job_title: string;
  role: string;
  email: string;
}

interface EmployeeOption {
  id: string;
  full_name: string;
  job_title: string;
  employee_number: string;
  department: { name: string } | null;
}

interface DirectorEvalRecord {
  id: string;
  status: string;
  final_score_500: number;
  final_score_5: number;
  percentage: number;
  general_rating: string | null;
  evaluator_note: string | null;
  director_note: string | null;
  ceo_comment: string | null;
  submitted_at: string | null;
  period: { year: number; month: number } | null;
}

interface EmployeeEvalRecord {
  id: string;
  status: string;
  final_score_500: number;
  final_score_5: number;
  percentage: number;
  general_rating: string | null;
  manager_note: string | null;
  employee_note: string | null;
  ceo_comment: string | null;
  submitted_at: string | null;
  period: { year: number; month: number } | null;
  manager: { full_name: string } | null;
  department: { name: string } | null;
  // 'director' = director→employee evaluation; 'supervisor' =
  // supervisor→employee evaluation (pulled from supervisor_evaluations).
  source: 'director' | 'supervisor';
}

interface ScoreDetail {
  criterion_title: string;
  criterion_description: string;
  criterion_weight: number;
  score: number;
  weighted_result: number;
  type: 'general' | 'specific';
}

type PeriodMode = 'monthly' | 'quarterly' | 'annual';
type ViewTab = 'directors' | 'employees';

export const CeoReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ViewTab>('directors');

  // People selection
  const [directors, setDirectors] = useState<PersonOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<PersonOption | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  // Close the search dropdown when the user clicks anywhere outside the
  // search wrapper. Without this, the list stayed open until the user
  // clicked the input again or picked a result.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Period filters
  const [periodMode, setPeriodMode] = useState<PeriodMode>('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(0);

  // Data
  const [directorEvals, setDirectorEvals] = useState<DirectorEvalRecord[]>([]);
  const [employeeEvals, setEmployeeEvals] = useState<EmployeeEvalRecord[]>([]);
  const [scores, setScores] = useState<Record<string, ScoreDetail[]>>({});
  const [loading, setLoading] = useState(false);
  const [years, setYears] = useState<number[]>([]);

  useEffect(() => {
    const fetchPeople = async () => {
      // Directors list = the union of:
      //   1) Users whose users.role = 'director' (the simple case)
      //   2) Anyone assigned as directorate.director_id / secondary_director_id
      // (regardless of their users.role — CEO users frequently serve as
      // directorate directors too in this org, and a flat .eq('role',
      // 'director') filter dropped them, leaving the dropdown empty).
      const [{ data: roleDirs }, { data: dirAssignments }, { data: emps }] = await Promise.all([
        supabase
          .from('users')
          .select('id, full_name, job_title, role, email')
          .eq('role', 'director')
          .order('full_name'),
        supabase
          .from('directorates')
          .select('director_id, secondary_director_id'),
        supabase
          .from('employees')
          .select('id, full_name, job_title, employee_number, department:departments(name)')
          .eq('status', 'active')
          .order('full_name'),
      ]);

      const seenIds = new Set<string>();
      const merged: any[] = [];
      ((roleDirs || []) as any[]).forEach(u => {
        if (!seenIds.has(u.id)) { seenIds.add(u.id); merged.push(u); }
      });

      const extraIds = new Set<string>();
      ((dirAssignments || []) as any[]).forEach(d => {
        if (d.director_id && !seenIds.has(d.director_id)) extraIds.add(d.director_id);
        if (d.secondary_director_id && !seenIds.has(d.secondary_director_id)) extraIds.add(d.secondary_director_id);
      });

      if (extraIds.size > 0) {
        const { data: extraUsers } = await supabase
          .from('users')
          .select('id, full_name, job_title, role, email')
          .in('id', Array.from(extraIds));
        ((extraUsers || []) as any[]).forEach(u => {
          if (!seenIds.has(u.id)) { seenIds.add(u.id); merged.push(u); }
        });
      }

      merged.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
      setDirectors(merged as PersonOption[]);
      setEmployees((emps || []) as unknown as EmployeeOption[]);
    };

    const fetchYears = async () => {
      const { data } = await supabase
        .from('evaluation_periods')
        .select('year')
        .order('year', { ascending: false });
      if (data) {
        const uniqueYears = [...new Set(data.map(p => p.year))];
        setYears(uniqueYears);
        if (uniqueYears.length > 0 && !uniqueYears.includes(selectedYear)) {
          setSelectedYear(uniqueYears[0]);
        }
      }
    };

    fetchPeople();
    fetchYears();
  }, []);

  // Reset selection when tab changes
  useEffect(() => {
    setSelectedPerson(null);
    setSelectedEmployee(null);
    setSearchQuery('');
    setDirectorEvals([]);
    setEmployeeEvals([]);
    setScores({});
  }, [activeTab]);

  const filteredPeople = activeTab === 'employees'
    ? []
    : directors.filter(p =>
        p.full_name.includes(searchQuery) || p.email.includes(searchQuery)
      );

  const filteredEmployees = activeTab === 'employees'
    ? employees.filter(e =>
        e.full_name.includes(searchQuery) || e.employee_number.includes(searchQuery)
      )
    : [];

  // Fetch evaluations
  const fetchData = useCallback(async () => {
    if (activeTab !== 'employees' && !selectedPerson) return;
    if (activeTab === 'employees' && !selectedEmployee) return;
    setLoading(true);

    let periodQuery = supabase
      .from('evaluation_periods')
      .select('id, year, month')
      .eq('year', selectedYear);

    if (periodMode === 'monthly' && selectedMonth > 0) {
      periodQuery = periodQuery.eq('month', selectedMonth);
    } else if (periodMode === 'quarterly' && selectedQuarter > 0) {
      const startMonth = (selectedQuarter - 1) * 3 + 1;
      const endMonth = selectedQuarter * 3;
      periodQuery = periodQuery.gte('month', startMonth).lte('month', endMonth);
    }

    const { data: periods } = await periodQuery;
    const periodIds = (periods || []).map(p => p.id);

    if (periodIds.length === 0) {
      setDirectorEvals([]);
      setEmployeeEvals([]);
      setScores({});
      setLoading(false);
      return;
    }

    if (activeTab === 'directors') {
      const { data: evals } = await supabase
        .from('director_evaluations')
        .select(`
          id, status, final_score_500, final_score_5, percentage, general_rating,
          evaluator_note, director_note, ceo_comment, submitted_at,
          period:evaluation_periods(year, month)
        `)
        .eq('director_id', selectedPerson!.id)
        .in('period_id', periodIds)
        .order('submitted_at', { ascending: false });

      const evalList = (evals as unknown as DirectorEvalRecord[]) || [];
      setDirectorEvals(evalList);

      // Fetch scores
      const scoresMap: Record<string, ScoreDetail[]> = {};
      await Promise.all(evalList.map(async (ev) => {
        const { data: scoreData } = await supabase
          .from('director_evaluation_scores')
          .select(`
            score_1_to_5, weighted_result, criterion_type,
            criterion:evaluation_criteria(title, description, weight)
          `)
          .eq('evaluation_id', ev.id);

        scoresMap[ev.id] = (scoreData || []).map((s: any) => ({
          criterion_title: s.criterion?.title || '',
          criterion_description: s.criterion?.description || '',
          criterion_weight: s.criterion?.weight || 0,
          score: s.score_1_to_5,
          weighted_result: s.weighted_result,
          type: s.criterion_type || 'general',
        }));
      }));
      setScores(scoresMap);
    } else {
      // Employees tab — pull BOTH director→employee and
      // supervisor→employee evaluations so an employee assessed only by
      // a supervisor (تقييم المشرف) still shows up.
      const [{ data: dirEvals }, { data: supEvals }] = await Promise.all([
        supabase
          .from('evaluations')
          .select(`
            id, status, final_score_500, final_score_5, percentage, general_rating,
            manager_note, employee_note, ceo_comment, submitted_at,
            period:evaluation_periods(year, month),
            manager:users!evaluations_manager_id_fkey(full_name),
            department:departments(name)
          `)
          .eq('employee_id', selectedEmployee!.id)
          .in('period_id', periodIds)
          .in('status', ['بانتظار الموافقة', 'موافقة', 'مرفوض', 'تم الإرسال', 'اطلع الموظف', 'مغلق'])
          .order('submitted_at', { ascending: false }),
        supabase
          .from('supervisor_evaluations')
          .select(`
            id, status, final_score_500, final_score_5, percentage, general_rating,
            supervisor_note, employee_note, submitted_at,
            period:evaluation_periods(year, month),
            supervisor:users!supervisor_evaluations_supervisor_id_fkey(full_name)
          `)
          .eq('employee_id', selectedEmployee!.id)
          .in('period_id', periodIds)
          .in('status', ['تم الإرسال', 'اطلع الموظف', 'مغلق'])
          .order('submitted_at', { ascending: false }),
      ]);

      const dirList: EmployeeEvalRecord[] = ((dirEvals || []) as any[]).map(e => ({ ...e, source: 'director' as const }));
      const supList: EmployeeEvalRecord[] = ((supEvals || []) as any[]).map(e => ({
        id: e.id,
        status: e.status,
        final_score_500: e.final_score_500,
        final_score_5: e.final_score_5,
        percentage: e.percentage,
        general_rating: e.general_rating,
        manager_note: e.supervisor_note,
        employee_note: e.employee_note,
        ceo_comment: null,
        submitted_at: e.submitted_at,
        period: e.period,
        manager: e.supervisor,
        department: null,
        source: 'supervisor' as const,
      }));

      const evalList = [...dirList, ...supList].sort((a, b) =>
        (b.submitted_at || '').localeCompare(a.submitted_at || ''));
      setEmployeeEvals(evalList);

      const scoresMap: Record<string, ScoreDetail[]> = {};
      await Promise.all(evalList.map(async (ev) => {
        if (ev.source === 'supervisor') {
          const { data: scoreData } = await supabase
            .from('supervisor_evaluation_scores')
            .select(`
              score_1_to_5, weighted_result, criterion_type,
              criterion:evaluation_criteria(title, description, weight),
              sup_criterion:supervisor_criteria(title, description, weight)
            `)
            .eq('evaluation_id', ev.id);
          scoresMap[ev.id] = (scoreData || []).map((s: any) => ({
            criterion_title: s.criterion_type === 'specific' ? (s.sup_criterion?.title || '') : (s.criterion?.title || ''),
            criterion_description: s.criterion_type === 'specific' ? (s.sup_criterion?.description || '') : (s.criterion?.description || ''),
            criterion_weight: s.criterion_type === 'specific' ? (s.sup_criterion?.weight || 0) : (s.criterion?.weight || 0),
            score: s.score_1_to_5,
            weighted_result: s.weighted_result,
            type: s.criterion_type || 'general',
          }));
          return;
        }

        const { data: scoreData } = await supabase
          .from('evaluation_scores')
          .select(`
            score_1_to_5, weighted_result, criterion_type,
            criterion:evaluation_criteria(title, description, weight),
            dept_criterion:department_criteria(title, description, weight, group:department_criteria_groups(name))
          `)
          .eq('evaluation_id', ev.id);

        scoresMap[ev.id] = (scoreData || []).map((s: any) => ({
          criterion_title: s.criterion_type === 'specific' ? (s.dept_criterion?.title || '') : (s.criterion?.title || ''),
          criterion_description: s.criterion_type === 'specific' ? (s.dept_criterion?.description || '') : (s.criterion?.description || ''),
          criterion_weight: s.criterion_type === 'specific' ? (s.dept_criterion?.weight || 0) : (s.criterion?.weight || 0),
          score: s.score_1_to_5,
          weighted_result: s.weighted_result,
          type: s.criterion_type || 'general',
        }));
      }));
      setScores(scoresMap);
    }

    setLoading(false);
  }, [selectedPerson, selectedEmployee, selectedYear, periodMode, selectedMonth, selectedQuarter, activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentEvals: any[] = activeTab === 'directors' ? directorEvals : employeeEvals;

  // For the employees tab, collapse multi-directorate rows for the same
  // period into a single per-period entry whose percentage is the
  // arithmetic mean across directorates. Director evaluations don't carry
  // directorate_id so the directors tab is a pass-through.
  const collapsedEvals = React.useMemo(() => {
    if (activeTab !== 'employees') return currentEvals;
    const byPeriod = new Map<string, any[]>();
    currentEvals.forEach((e: any) => {
      // Key includes the source so a director eval and a supervisor
      // eval in the same period stay as two separate cards instead of
      // being averaged together (only multi-directorate director evals
      // should collapse into one mean).
      const key = `${e.source || 'director'}::${e.period_id || `${e.period?.year}-${e.period?.month}`}`;
      if (!byPeriod.has(key)) byPeriod.set(key, []);
      byPeriod.get(key)!.push(e);
    });
    return Array.from(byPeriod.values()).map(group => {
      const avg = (k: string) => group.reduce((s, x) => s + Number(x[k] || 0), 0) / group.length;
      return {
        ...group[0],
        percentage: avg('percentage'),
        final_score_5: avg('final_score_5'),
        final_score_500: avg('final_score_500'),
      };
    });
  }, [currentEvals, activeTab]);

  // Resolve the employees.id of the currently selected person so we can call
  // the leave-aware helpers. Directors are picked by users.id (selectedPerson),
  // employees by employees.id (selectedEmployee).
  const [evaluableMonths, setEvaluableMonths] = useState<number | null>(null);
  const [windowLeaves, setWindowLeaves] = useState<LeaveSummary[]>([]);

  useEffect(() => {
    const run = async () => {
      const inWindow = periodMode === 'annual' || (periodMode === 'quarterly' && selectedQuarter > 0);
      if (!inWindow) { setEvaluableMonths(null); setWindowLeaves([]); return; }
      let employeeId: string | null = null;
      if (activeTab === 'employees' && selectedEmployee) {
        employeeId = selectedEmployee.id;
      } else if (activeTab === 'directors' && selectedPerson) {
        const { data: emp } = await supabase
          .from('employees').select('id').eq('user_id', selectedPerson.id).maybeSingle();
        employeeId = emp?.id || null;
      }
      if (!employeeId) { setEvaluableMonths(null); setWindowLeaves([]); return; }
      const range = periodMode === 'annual'
        ? annualRange(selectedYear)
        : quarterlyRange(selectedYear, selectedQuarter);
      const [n, leaves] = await Promise.all([
        getEvaluableMonths(employeeId, range.from, range.to),
        getLeavesForEmployeeInRange(employeeId, range.from, range.to),
      ]);
      setEvaluableMonths(n);
      setWindowLeaves(leaves);
    };
    run();
  }, [activeTab, selectedPerson, selectedEmployee, periodMode, selectedYear, selectedQuarter]);

  const denominator = (evaluableMonths !== null && evaluableMonths > 0)
    ? evaluableMonths
    : collapsedEvals.length;

  const inWindow = periodMode === 'annual' || (periodMode === 'quarterly' && selectedQuarter > 0);
  const summary = inWindow && collapsedEvals.length > 0 && denominator > 0
    ? (() => {
        const sum = collapsedEvals.reduce(
          (acc: any, e: any) => ({
            pct: acc.pct + e.percentage,
            s5: acc.s5 + e.final_score_5,
            s500: acc.s500 + e.final_score_500,
          }),
          { pct: 0, s5: 0, s500: 0 },
        );
        const avgPercentage = sum.pct / denominator;
        return {
          avgPercentage,
          avgScore5: sum.s5 / denominator,
          avgScore500: sum.s500 / denominator,
          count: collapsedEvals.length,
          evaluableMonths: evaluableMonths ?? collapsedEvals.length,
          totalMonths: periodMode === 'annual' ? 12 : 3,
          get generalRating() {
            if (avgPercentage >= 90) return 'ممتاز';
            if (avgPercentage >= 80) return 'جيد جدًا';
            if (avgPercentage >= 70) return 'جيد';
            return 'يحتاج تحسين';
          },
        };
      })()
    : null;
  const fullyOnLeave = inWindow && evaluableMonths === 0 && windowLeaves.length > 0;

  const hasSelection = activeTab === 'employees' ? !!selectedEmployee : !!selectedPerson;

  const renderEvalCard = (ev: any) => {
    const evalScores = scores[ev.id] || [];
    const generalScores = evalScores.filter(s => s.type === 'general');
    const specificScores = evalScores.filter(s => s.type === 'specific');

    let evaluatorNote: string | null = null;
    let subjectNote: string | null = null;
    let evaluatorLabel = 'ملاحظات المقيّم';
    let subjectLabel = 'رد مدير الإدارة';
    let subtitle: string | null = null;

    if (activeTab === 'directors') {
      evaluatorNote = ev.evaluator_note;
      subjectNote = ev.director_note;
      evaluatorLabel = 'ملاحظات المقيّم';
      subjectLabel = 'رد مدير الإدارة';
    } else {
      const isSup = ev.source === 'supervisor';
      evaluatorNote = ev.manager_note;
      subjectNote = ev.employee_note;
      evaluatorLabel = isSup ? 'ملاحظات المشرف' : 'ملاحظات المدير';
      subjectLabel = 'رد الموظف';
      subtitle = ev.manager ? `${isSup ? 'المشرف المقيّم' : 'المقيّم'}: ${ev.manager.full_name}` : null;
    }

    const isSupCard = activeTab === 'employees' && ev.source === 'supervisor';

    return (
      <Card key={ev.id}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-ds-overlay p-2 rounded-lg">
                <Calendar className="h-5 w-5 text-ds-muted" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ds-text">
                  {ev.period ? `${monthLabels[ev.period.month]} ${ev.period.year}` : 'غير محدد'}
                </h2>
                {subtitle && <p className="text-xs text-ds-faint">{subtitle}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'employees' && (
                <Badge variant={isSupCard ? 'info' : 'primary'} size="sm">
                  {isSupCard ? 'تقييم المشرف' : 'تقييم المدير'}
                </Badge>
              )}
              <Badge variant={getStatusVariant(ev.status)} size="sm">{getStatusLabel(ev.status)}</Badge>
            </div>
          </div>
        </CardHeader>

        <CardBody className="space-y-5">
          {/* Final Results */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-ds-info-bg rounded-lg p-3 text-center">
              <p className="text-xs text-blue-600 mb-1">النتيجة / 500</p>
              <p className="text-lg sm:text-xl font-bold text-ds-info-text">{ev.final_score_500?.toFixed(1)}</p>
            </div>
            <div className="bg-ds-purple-bg rounded-lg p-3 text-center">
              <p className="text-xs text-purple-600 mb-1">النتيجة / 5</p>
              <p className="text-lg sm:text-xl font-bold text-ds-purple-text">{ev.final_score_5?.toFixed(2)}</p>
            </div>
            <div className="bg-ds-info-bg rounded-lg p-3 text-center">
              <p className="text-xs text-teal-600 mb-1">النسبة المئوية</p>
              <p className="text-lg sm:text-xl font-bold text-ds-info-text">{ev.percentage?.toFixed(0)}%</p>
            </div>
            <div className="bg-ds-warning-bg rounded-lg p-3 text-center">
              <p className="text-xs text-amber-600 mb-1">التقدير العام</p>
              {ev.general_rating ? (
                <Badge variant={getRatingVariant(ev.general_rating)}>{ev.general_rating}</Badge>
              ) : <span className="text-ds-faint text-sm">-</span>}
            </div>
          </div>

          {/* General Criteria */}
          {generalScores.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-ds-info-text mb-2 flex items-center gap-2">
                <Star className="h-4 w-4" /> المعايير العامة
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-ds-info-bg">
                    <tr>
                      <th className="px-4 py-2 text-right text-xs font-medium text-ds-info-text">المعيار</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-ds-info-text">الوزن</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-ds-info-text">الدرجة</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-ds-info-text">النتيجة الموزونة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ds-border-subtle">
                    {generalScores.map((s, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2">
                          <p className="font-medium text-ds-text">{s.criterion_title}</p>
                          <p className="text-xs text-ds-faint">{s.criterion_description}</p>
                        </td>
                        <td className="px-4 py-2 text-ds-muted">{s.criterion_weight}%</td>
                        <td className="px-4 py-2 font-bold text-ds-text">{s.score}/5</td>
                        <td className="px-4 py-2 font-bold text-blue-600">{s.weighted_result?.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Specific Criteria */}
          {specificScores.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-ds-success-text mb-2 flex items-center gap-2">
                <Star className="h-4 w-4" /> المعايير الخاصة
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-ds-success-bg">
                    <tr>
                      <th className="px-4 py-2 text-right text-xs font-medium text-ds-success-text">المعيار</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-ds-success-text">الوزن</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-ds-success-text">الدرجة</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-ds-success-text">النتيجة الموزونة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ds-border-subtle">
                    {specificScores.map((s, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2">
                          <p className="font-medium text-ds-text">{s.criterion_title}</p>
                          <p className="text-xs text-ds-faint">{s.criterion_description}</p>
                        </td>
                        <td className="px-4 py-2 text-ds-muted">{s.criterion_weight}%</td>
                        <td className="px-4 py-2 font-bold text-ds-text">{s.score}/5</td>
                        <td className="px-4 py-2 font-bold text-emerald-600">{s.weighted_result?.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          {(evaluatorNote || subjectNote || ev.ceo_comment) && (
            <div className="space-y-3">
              {evaluatorNote && (
                <div className="bg-ds-info-bg rounded-lg p-4">
                  <p className="text-xs font-medium text-ds-info-text mb-1 flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> {evaluatorLabel}
                  </p>
                  <p className="text-sm text-ds-text">{evaluatorNote}</p>
                </div>
              )}
              {subjectNote && (
                <div className="bg-ds-info-bg rounded-lg p-4">
                  <p className="text-xs font-medium text-ds-info-text mb-1 flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> {subjectLabel}
                  </p>
                  <p className="text-sm text-ds-text">{subjectNote}</p>
                </div>
              )}
              {ev.ceo_comment && (
                <div className="bg-ds-danger-bg rounded-lg p-4">
                  <p className="text-xs font-medium text-ds-danger-text mb-1 flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> ملاحظات الإدارة العليا
                  </p>
                  <p className="text-sm text-ds-text">{ev.ceo_comment}</p>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  const tabColor = activeTab === 'directors' ? 'purple' : 'emerald';

  const selectedLabel = activeTab === 'directors' ? 'اختر مدير الإدارة' : 'اختر الموظف';
  const emptyLabel = activeTab === 'directors' ? 'اختر مدير إدارة لعرض تقرير الأداء' : 'اختر موظف لعرض تقرير الأداء';
  const roleLabel = activeTab === 'directors' ? 'مدير إدارة' : 'موظف';

  const selectedInfo = activeTab === 'employees'
    ? selectedEmployee
      ? { name: selectedEmployee.full_name, title: selectedEmployee.job_title, extra: selectedEmployee.department?.name || '' }
      : null
    : selectedPerson
      ? { name: selectedPerson.full_name, title: selectedPerson.job_title, extra: '' }
      : null;

  return (
    <div className="space-y-6">
      <div
        className="rounded-ds-xl p-4 sm:p-5 lg:p-8"
        style={{
          background: 'var(--sc-blue-grad)',
          border: '1px solid var(--sc-blue-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--sc-blue-val)' }}>تقارير الأداء</h1>
        <p className="mt-2" style={{ color: 'var(--sc-blue-label)' }}>تقارير مفصلة عن أداء مديري الإدارات والموظفين</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-ds-border pb-0">
        {([
          { key: 'directors' as ViewTab, label: 'مديري الإدارات', icon: <Crown className="h-4 w-4" /> },
          { key: 'employees' as ViewTab, label: 'الموظفين', icon: <UserCheck className="h-4 w-4" /> },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600 bg-ds-info-bg'
                : 'border-transparent text-ds-faint hover:text-ds-muted hover:bg-ds-bg'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Filters — `!overflow-visible` lets the dropdown panel escape
          the card's clip; `card-flat` removes the .card hover lift +
          box-shadow transition that otherwise repaints/wiggles the
          dropdown as the cursor moves through it (flickering cursor). */}
      <Card className="!overflow-visible card-flat">
        <CardBody>
          <div className="flex items-center gap-4 flex-wrap">
            {/* Searchable dropdown */}
            <div className="relative flex-1 min-w-[280px]" ref={searchWrapRef}>
              <label className="block text-sm font-medium text-ds-muted mb-1">{selectedLabel}</label>
              <div className="relative">
                <input
                  type="text"
                  value={
                    activeTab === 'employees'
                      ? (selectedEmployee ? selectedEmployee.full_name : searchQuery)
                      : (selectedPerson ? selectedPerson.full_name : searchQuery)
                  }
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedPerson(null);
                    setSelectedEmployee(null);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => {
                    // Allow the user to search again even when a person is
                    // already selected — clearing the selection here makes
                    // the dropdown's gating condition pass on focus, so the
                    // list reappears immediately.
                    if (selectedEmployee || selectedPerson) {
                      setSearchQuery('');
                      setSelectedEmployee(null);
                      setSelectedPerson(null);
                    }
                    setDropdownOpen(true);
                  }}
                  placeholder="ابحث بالاسم..."
                  className="w-full px-4 py-2 pr-10 pl-16 border border-ds-border bg-ds-input text-ds-text placeholder:text-ds-faint rounded-lg focus:ring-2 focus:ring-ds-accent focus:border-ds-accent outline-none"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ds-faint pointer-events-none" />
                {(searchQuery || selectedEmployee || selectedPerson) && (
                  <button
                    type="button"
                    aria-label="مسح البحث"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedEmployee(null);
                      setSelectedPerson(null);
                      setDropdownOpen(true);
                    }}
                    className="absolute left-9 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-ds-overlay text-ds-faint hover:text-ds-text"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label="فتح القائمة"
                  onClick={() => setDropdownOpen(o => !o)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-ds-overlay text-ds-faint hover:text-ds-text"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {dropdownOpen && !selectedPerson && !selectedEmployee && (
                <div className="absolute z-20 mt-1 w-full bg-ds-surface border border-ds-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {activeTab === 'employees' ? (
                    filteredEmployees.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-ds-faint">لا توجد نتائج</div>
                    ) : (
                      filteredEmployees.map(emp => (
                        <button
                          key={emp.id}
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setSearchQuery('');
                            setDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ds-info-bg text-right transition-colors border-b border-ds-border-subtle last:border-0"
                        >
                          <UserAvatar name={emp.full_name} avatarUrl={(emp as any).avatar_url} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ds-text truncate">{emp.full_name}</p>
                            <p className="text-xs text-ds-faint">{emp.job_title} {emp.department?.name ? `— ${emp.department.name}` : ''}</p>
                          </div>
                        </button>
                      ))
                    )
                  ) : (
                    filteredPeople.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-ds-faint">لا توجد نتائج</div>
                    ) : (
                      filteredPeople.map(person => (
                        <button
                          key={person.id}
                          onClick={() => {
                            setSelectedPerson(person);
                            setSearchQuery('');
                            setDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ds-info-bg text-right transition-colors border-b border-ds-border-subtle last:border-0"
                        >
                          <UserAvatar name={person.full_name} avatarUrl={(person as any).avatar_url} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ds-text truncate">{person.full_name}</p>
                            <p className="text-xs text-ds-faint">{person.job_title}</p>
                          </div>
                        </button>
                      ))
                    )
                  )}
                </div>
              )}
            </div>

            {/* Year */}
            <div>
              <label className="block text-sm font-medium text-ds-muted mb-1">السنة</label>
              <ModernSelect
                value={String(selectedYear)}
                onChange={(v) => setSelectedYear(Number(v))}
                ariaLabel="السنة"
                className="min-w-[140px]"
                options={years.map(y => ({ value: String(y), label: String(y) }))}
              />
            </div>

            {/* Period mode */}
            <div>
              <label className="block text-sm font-medium text-ds-muted mb-1">نوع التقرير</label>
              <div className="flex rounded-lg border border-ds-border overflow-hidden">
                {([
                  { key: 'monthly' as PeriodMode, label: 'شهري' },
                  { key: 'quarterly' as PeriodMode, label: 'ربعي' },
                  { key: 'annual' as PeriodMode, label: 'سنوي' },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setPeriodMode(tab.key);
                      setSelectedMonth(0);
                      setSelectedQuarter(0);
                    }}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      periodMode === tab.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-ds-surface text-ds-muted hover:bg-ds-bg'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {periodMode === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-ds-muted mb-1">الشهر</label>
                <ModernSelect
                  value={String(selectedMonth)}
                  onChange={(v) => setSelectedMonth(Number(v))}
                  ariaLabel="الشهر"
                  className="min-w-[180px]"
                  options={[
                    { value: '0', label: 'جميع الأشهر' },
                    ...Object.entries(monthLabels).map(([m, label]) => ({ value: m, label })),
                  ]}
                />
              </div>
            )}

            {periodMode === 'quarterly' && (
              <div>
                <label className="block text-sm font-medium text-ds-muted mb-1">الربع</label>
                <ModernSelect
                  value={String(selectedQuarter)}
                  onChange={(v) => setSelectedQuarter(Number(v))}
                  ariaLabel="الربع"
                  className="min-w-[260px]"
                  options={[
                    { value: '0', label: 'جميع الأرباع' },
                    ...Object.entries(quarterLabels).map(([q, label]) => ({ value: q, label })),
                  ]}
                />
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* No person selected */}
      {!hasSelection && (
        <Card>
          <CardBody className="text-center py-16">
            <User className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-ds-faint text-lg">{emptyLabel}</p>
          </CardBody>
        </Card>
      )}

      {/* Person selected */}
      {hasSelection && (
        <>
          {/* Person info */}
          <Card>
            <CardBody className={`bg-${tabColor}-50`}>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 bg-${tabColor}-200 rounded-full flex items-center justify-center`}>
                  <User className={`h-7 w-7 text-${tabColor}-700`} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1">
                  <div>
                    <p className={`text-sm text-${tabColor}-600`}>الاسم</p>
                    <p className={`font-semibold text-${tabColor}-900`}>{selectedInfo?.name}</p>
                  </div>
                  <div>
                    <p className={`text-sm text-${tabColor}-600`}>المسمى الوظيفي</p>
                    <p className={`font-semibold text-${tabColor}-900`}>{selectedInfo?.title}</p>
                  </div>
                  {activeTab === 'employees' && selectedInfo?.extra ? (
                    <div>
                      <p className="text-sm text-emerald-600">الإدارة</p>
                      <p className="font-semibold text-ds-success-text">{selectedInfo.extra}</p>
                    </div>
                  ) : (
                    <div>
                      <p className={`text-sm text-${tabColor}-600`}>الدور</p>
                      <p className={`font-semibold text-${tabColor}-900`}>{roleLabel}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          {loading ? (
            <div className="page-loading-placeholder" aria-hidden="true" />
          ) : currentEvals.length === 0 ? (
            <Card>
              <CardBody className="text-center py-16">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-ds-faint text-lg">لا توجد تقييمات في الفترة المحددة</p>
              </CardBody>
            </Card>
          ) : (
            <>
              {/* Full-window leave: render a friendly chip and skip the summary */}
              {fullyOnLeave && (
                <Card className="border-ds-warning-border">
                  <CardBody>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-amber-600" />
                      <div className="text-sm">
                        <p className="font-semibold text-ds-warning-text">في إجازة طوال هذه الفترة — لا يوجد تقييم</p>
                        <p className="text-xs text-ds-warning-text">{windowLeaves.map(l => l.type_name).join('، ')}</p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Summary */}
              {!fullyOnLeave && summary && (
                <Card className="border-ds-info-border">
                  <CardHeader className="bg-ds-info-bg">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                      <h2 className="text-lg font-semibold text-ds-info-text">
                        {periodMode === 'annual' ? `الملخص السنوي — ${selectedYear}` : `ملخص ${quarterLabels[selectedQuarter]} — ${selectedYear}`}
                      </h2>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <div className="space-y-4">
                      {windowLeaves.length > 0 && (
                        <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-3 flex items-start gap-2">
                          <Calendar className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-ds-warning-text">
                            تم احتساب المتوسط على <span className="font-bold">{summary.evaluableMonths}</span> من <span className="font-bold">{summary.totalMonths}</span> شهر — استُبعدت أشهر الإجازة:{' '}
                            <span className="font-medium">{windowLeaves.map(l => l.type_name).join('، ')}</span>
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-ds-info-bg rounded-lg p-4 text-center">
                          <p className="text-xs text-blue-600 mb-1">عدد التقييمات</p>
                          <p className="text-2xl font-bold text-ds-info-text">{summary.count}</p>
                        </div>
                        <div className="bg-ds-purple-bg rounded-lg p-4 text-center">
                          <p className="text-xs text-purple-600 mb-1">متوسط / 500</p>
                          <p className="text-2xl font-bold text-ds-purple-text">{summary.avgScore500.toFixed(0)}</p>
                        </div>
                        <div className="bg-ds-info-bg rounded-lg p-4 text-center">
                          <p className="text-xs text-indigo-600 mb-1">متوسط / 5</p>
                          <p className="text-2xl font-bold text-ds-info-text">{summary.avgScore5.toFixed(2)}</p>
                        </div>
                        <div className="bg-ds-info-bg rounded-lg p-4 text-center">
                          <p className="text-xs text-teal-600 mb-1">متوسط النسبة</p>
                          <p className="text-2xl font-bold text-ds-info-text">{summary.avgPercentage.toFixed(1)}%</p>
                        </div>
                        <div className="bg-ds-warning-bg rounded-lg p-4 text-center">
                          <p className="text-xs text-amber-600 mb-1">التقدير العام</p>
                          <Badge variant={getRatingVariant(summary.generalRating)} size="lg">
                            {summary.generalRating}
                          </Badge>
                        </div>
                      </div>

                      {/* Performance trend */}
                      <div>
                        <h3 className="text-sm font-medium text-ds-muted mb-3">مسار الأداء</h3>
                        <div className="flex items-end gap-2 h-32">
                          {collapsedEvals
                            .slice()
                            .sort((a, b) => (a.period?.month || 0) - (b.period?.month || 0))
                            .map(ev => (
                              <div key={ev.id} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-xs font-bold text-ds-muted">{ev.percentage.toFixed(0)}%</span>
                                <div
                                  className={`w-full rounded-t-md transition-all ${
                                    ev.percentage >= 90 ? 'bg-green-500' :
                                    ev.percentage >= 80 ? 'bg-blue-500' :
                                    ev.percentage >= 70 ? 'bg-amber-500' : 'bg-red-500'
                                  }`}
                                  style={{ height: `${Math.max(ev.percentage * 0.9, 10)}%` }}
                                ></div>
                                <span className="text-[10px] text-ds-faint">
                                  {ev.period ? monthLabels[ev.period.month] : ''}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Individual evaluations */}
              {currentEvals
                .slice()
                .sort((a, b) => (b.period?.month || 0) - (a.period?.month || 0))
                .map(ev => renderEvalCard(ev))}
            </>
          )}
        </>
      )}

      {/* Click outside to close dropdown */}
      {dropdownOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
      )}
    </div>
  );
};
