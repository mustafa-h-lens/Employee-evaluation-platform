import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { MobileRow } from '../../components/ui/MobileRow';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Crown, Users, Eye, Filter, Star, Shield, ArrowUp } from 'lucide-react';
import { percentageToRating } from '../../lib/scoring';
import { AllCeoEvaluations } from './AllCeoEvaluations';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { ModernSelect } from '../../components/ui/ModernSelect';

const monthLabels: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
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
    case 'تم الإرسال': case 'بانتظار الموافقة': return 'warning';
    case 'موافقة': case 'اطلع الموظف': case 'اطلع المدير': case 'مغلق': case 'مكتمل': return 'success';
    case 'مرفوض': return 'danger';
    default: return 'default';
  }
};

const getStatusLabel = (status: string, context?: string): string => {
  if (!status || status === 'مسودة') return 'بانتظار التقييم';
  if (status === 'تم الإرسال' && context === 'ceo') return 'بانتظار تقييم الشريك';
  if (status === 'تم الإرسال') return 'بانتظار الموافقة';
  if (status === 'بانتظار الموافقة') return 'بانتظار الموافقة';
  if (['موافقة', 'اطلع الموظف', 'اطلع المدير', 'مغلق', 'مكتمل'].includes(status)) return 'تم اعتماد التقييم';
  if (status === 'مرفوض') return 'التقييم مرفوض';
  return status;
};

interface Period {
  id: string;
  year: number;
  month: number;
}

interface Department {
  id: string;
  name: string;
  directorate_id: string | null;
}

interface DirectorateFilter {
  id: string;
  name: string;
  director_id: string | null;
  secondary_director_id: string | null;
}

interface DirectorEval {
  id: string;
  director_id: string;
  period_id: string;
  director: { id: string; full_name: string; email: string; job_title: string | null } | null;
  evaluator: { full_name: string } | null;
  period: { year: number; month: number } | null;
  status: string;
  final_score_500: number;
  final_score_5: number;
  percentage: number;
  general_rating: string | null;
  evaluator_note: string | null;
  director_note: string | null;
  submitted_at: string | null;
}

interface EvalItem {
  id: string;
  employee_id: string;
  period_id: string;
  directorate_id: string | null;
  employee: { full_name: string; job_title: string; employee_number: string; avatar_url?: string | null } | null;
  manager: { full_name: string } | null;
  department: { name: string } | null;
  directorate: { id: string; name: string } | null;
  period: { year: number; month: number } | null;
  department_id: string;
  status: string;
  final_score_500: number;
  final_score_5: number;
  percentage: number;
  general_rating: string | null;
  manager_note: string | null;
  employee_note: string | null;
  submitted_at: string | null;
}

interface CombinedEmployeeEval {
  key: string;
  employee_id: string;
  period_id: string;
  employee: EvalItem['employee'];
  period: EvalItem['period'];
  evals: EvalItem[];
  avg_percentage: number;
  avg_score_5: number;
  avg_score_500: number;
  avg_rating: string | null;
  source_count: number;
  total_directorates: number;
}

interface SupervisorEval {
  id: string;
  supervisor: { full_name: string } | null;
  employee: { full_name: string; job_title: string; employee_number: string } | null;
  period: { year: number; month: number } | null;
  status: string;
  final_score_500: number;
  final_score_5: number;
  percentage: number;
  general_rating: string | null;
  supervisor_note: string | null;
  employee_note: string | null;
  submitted_at: string | null;
}

interface ScoreDetail {
  criterion_title: string;
  criterion_description: string;
  criterion_weight: number;
  score: number;
  weighted_result: number;
  type: 'general' | 'specific';
}

// Per-evaluator slice of a combined detail modal. When more than one
// evaluator contributed to the same evaluatee + period, the modal shows
// a tab strip — Summary tab uses the averaged figures, per-evaluator
// tabs render the raw scores below from this array.
interface UnderlyingEvalDetail {
  id: string;
  evaluatorName: string;
  scopeLabel: string | null; // e.g. directorate name; CEO→Director leaves null
  scores: ScoreDetail[];
  finalScore500: number;
  finalScore5: number;
  percentage: number;
  generalRating: string | null;
  evaluatorNote: string | null;
  status: string;
}

// Trim whitespace and strip a leading "معيار " prefix so criteria with
// equivalent titles collapse together when averaging across evaluators.
// Mirrors the helper in PendingApprovals.tsx.
const normalizeCriterionTitle = (t: string): string => {
  const trimmed = (t || '').replace(/\s+/g, ' ').trim();
  return trimmed.startsWith('معيار ') ? trimmed.slice('معيار '.length).trim() : trimmed;
};

type TabType = 'ceo' | 'directors' | 'supervisors' | 'ceo-eval';

export const AllEvaluations: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('ceo');
  const [loading, setLoading] = useState(true);

  // Data
  const [directorEvals, setDirectorEvals] = useState<DirectorEval[]>([]);
  const [employeeEvals, setEmployeeEvals] = useState<EvalItem[]>([]);
  const [supervisorEvals, setSupervisorEvals] = useState<SupervisorEval[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [directoratesFilter, setDirectoratesFilter] = useState<DirectorateFilter[]>([]);

  // Filters
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterDirectorate, setFilterDirectorate] = useState('');

  // Detail modal
  const [detailModal, setDetailModal] = useState(false);
  const [detailData, setDetailData] = useState<{
    name: string;
    jobTitle: string;
    period: string;
    scores: ScoreDetail[];
    finalScore500: number;
    finalScore5: number;
    percentage: number;
    generalRating: string | null;
    evaluatorNote: string | null;
    subjectNote: string | null;
    status: string;
    // Populated only for combined cards where >1 evaluator contributed.
    // Drives the per-evaluator tab strip in the modal.
    underlyingEvals?: UnderlyingEvalDetail[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // 'summary' (default, averaged view) or an underlying eval id.
  const [selectedEvalTab, setSelectedEvalTab] = useState<string>('summary');

  const fetchFilters = useCallback(async () => {
    const [{ data: periodsData }, { data: deptsData }, { data: dirsData }] = await Promise.all([
      supabase.from('evaluation_periods').select('id, year, month').order('year', { ascending: false }).order('month', { ascending: false }),
      supabase.from('departments').select('id, name, directorate_id').order('name'),
      supabase.from('directorates').select('id, name, director_id, secondary_director_id').order('name'),
    ]);
    setPeriods(periodsData || []);
    setDepartments(deptsData || []);
    setDirectoratesFilter((dirsData as DirectorateFilter[]) || []);
  }, []);

  const fetchDirectorEvals = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('director_evaluations')
      .select(`
        id, director_id, period_id, status, final_score_500, final_score_5, percentage, general_rating,
        evaluator_note, director_note, submitted_at,
        director:users!director_evaluations_director_id_fkey(id, full_name, email, job_title),
        evaluator:users!director_evaluations_evaluator_id_fkey(full_name),
        period:evaluation_periods(year, month)
      `)
      .order('created_at', { ascending: false });

    if (filterPeriod) query = query.eq('period_id', filterPeriod);

    if (filterDirectorate) {
      const dir = directoratesFilter.find(d => d.id === filterDirectorate);
      if (dir) {
        const directorIds = [dir.director_id, dir.secondary_director_id].filter(Boolean) as string[];
        if (directorIds.length > 0) {
          query = query.in('director_id', directorIds);
        }
      }
    }

    const { data } = await query;
    setDirectorEvals((data as unknown as DirectorEval[]) || []);
    setLoading(false);
  }, [filterPeriod, filterDirectorate, directoratesFilter]);

  const fetchEmployeeEvals = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('evaluations')
      .select(`
        id, employee_id, period_id, directorate_id,
        status, final_score_500, final_score_5, percentage, general_rating,
        manager_note, employee_note, submitted_at, department_id,
        employee:employees(full_name, job_title, employee_number, user:users!employees_user_id_fkey(avatar_url)),
        manager:users!evaluations_manager_id_fkey(full_name),
        department:departments(name),
        directorate:directorates(id, name),
        period:evaluation_periods(year, month)
      `)
      .order('created_at', { ascending: false });

    if (filterPeriod) query = query.eq('period_id', filterPeriod);
    if (filterDirectorate) {
      // Evaluations can be linked to a directorate two ways: directly via
      // evaluations.directorate_id (newer rows where the employee is
      // attached to a directorate without a department) or transitively
      // via department_id when the employee is in a department of that
      // directorate. Match BOTH so directorates with no departments and
      // legacy rows with no directorate_id both surface.
      const deptIds = departments.filter(d => d.directorate_id === filterDirectorate).map(d => d.id);
      if (deptIds.length > 0) {
        query = query.or(`directorate_id.eq.${filterDirectorate},department_id.in.(${deptIds.join(',')})`);
      } else {
        query = query.eq('directorate_id', filterDirectorate);
      }
    }

    const { data } = await query;

    const flat: EvalItem[] = ((data || []) as any[]).map((r: any) => {
      const empJoin = Array.isArray(r.employee) ? r.employee[0] : r.employee;
      const userJoin = empJoin?.user
        ? (Array.isArray(empJoin.user) ? empJoin.user[0] : empJoin.user)
        : null;
      return {
        ...r,
        employee: empJoin
          ? {
              full_name: empJoin.full_name,
              job_title: empJoin.job_title,
              employee_number: empJoin.employee_number,
              avatar_url: userJoin?.avatar_url || null,
            }
          : null,
      };
    });
    setEmployeeEvals(flat);
    setLoading(false);
  }, [filterPeriod, filterDirectorate, departments]);

  const fetchSupervisorEvals = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('supervisor_evaluations')
      .select(`
        id, status, final_score_500, final_score_5, percentage, general_rating,
        supervisor_note, employee_note, submitted_at,
        supervisor:users!supervisor_evaluations_supervisor_id_fkey(full_name),
        employee:employees!supervisor_evaluations_employee_id_fkey(full_name, job_title, employee_number),
        period:evaluation_periods(year, month)
      `)
      .order('created_at', { ascending: false });

    if (filterPeriod) query = query.eq('period_id', filterPeriod);

    const { data } = await query;
    setSupervisorEvals((data as unknown as SupervisorEval[]) || []);
    setLoading(false);
  }, [filterPeriod]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    if (activeTab === 'ceo') {
      fetchDirectorEvals();
    } else if (activeTab === 'directors') {
      fetchEmployeeEvals();
    } else if (activeTab === 'supervisors') {
      fetchSupervisorEvals();
    }
    // 'ceo-eval' tab is handled by embedded AllCeoEvaluations component
  }, [activeTab, fetchDirectorEvals, fetchEmployeeEvals, fetchSupervisorEvals]);

  const resetFilters = () => {
    setFilterPeriod('');
    setFilterDepartment('');
    setFilterDirectorate('');
  };

  const viewDirectorDetail = async (ev: DirectorEval) => {
    setDetailLoading(true);
    setDetailModal(true);

    const { data: scores } = await supabase
      .from('director_evaluation_scores')
      .select(`
        score_1_to_5, weighted_result, criterion_type,
        criterion:evaluation_criteria(title, description, weight),
        dept_criterion:department_criteria(title, description, weight)
      `)
      .eq('evaluation_id', ev.id);

    const scoreDetails: ScoreDetail[] = (scores || []).map((s: any) => ({
      criterion_title: s.criterion_type === 'specific' ? (s.dept_criterion?.title || '') : (s.criterion?.title || ''),
      criterion_description: s.criterion_type === 'specific' ? (s.dept_criterion?.description || '') : (s.criterion?.description || ''),
      criterion_weight: s.criterion_type === 'specific' ? (s.dept_criterion?.weight || 0) : (s.criterion?.weight || 0),
      score: s.score_1_to_5,
      weighted_result: s.weighted_result,
      type: s.criterion_type || 'general',
    }));

    setDetailData({
      name: ev.director?.full_name || '',
      jobTitle: ev.director?.job_title || '',
      period: ev.period ? `${monthLabels[ev.period.month]} ${ev.period.year}` : '',
      scores: scoreDetails,
      finalScore500: ev.final_score_500,
      finalScore5: ev.final_score_5,
      percentage: ev.percentage,
      generalRating: ev.general_rating,
      evaluatorNote: ev.evaluator_note,
      subjectNote: ev.director_note,
      status: ev.status,
    });
    setDetailLoading(false);
  };

  const viewEvalDetail = async (ev: EvalItem) => {
    setDetailLoading(true);
    setDetailModal(true);

    const { data: scores } = await supabase
      .from('evaluation_scores')
      .select(`
        score_1_to_5, weighted_result, criterion_type,
        criterion:evaluation_criteria(title, description, weight),
        dept_criterion:department_criteria(title, description, weight, group:department_criteria_groups(name))
      `)
      .eq('evaluation_id', ev.id);

    const scoreDetails: ScoreDetail[] = (scores || []).map((s: any) => ({
      criterion_title: s.criterion_type === 'specific' ? (s.dept_criterion?.title || '') : (s.criterion?.title || ''),
      criterion_description: s.criterion_type === 'specific' ? (s.dept_criterion?.description || '') : (s.criterion?.description || ''),
      criterion_weight: s.criterion_type === 'specific' ? (s.dept_criterion?.weight || 0) : (s.criterion?.weight || 0),
      score: s.score_1_to_5,
      weighted_result: s.weighted_result,
      type: s.criterion_type || 'general',
    }));

    setDetailData({
      name: ev.employee?.full_name || '',
      jobTitle: ev.employee?.job_title || '',
      period: ev.period ? `${monthLabels[ev.period.month]} ${ev.period.year}` : '',
      scores: scoreDetails,
      finalScore500: ev.final_score_500,
      finalScore5: ev.final_score_5,
      percentage: ev.percentage,
      generalRating: ev.general_rating,
      evaluatorNote: ev.manager_note,
      subjectNote: ev.employee_note,
      status: ev.status,
    });
    setDetailLoading(false);
  };

  const viewSupervisorDetail = async (ev: SupervisorEval) => {
    setDetailLoading(true);
    setDetailModal(true);

    const { data: scores } = await supabase
      .from('supervisor_evaluation_scores')
      .select(`
        score_1_to_5, weighted_result, criterion_type,
        criterion:evaluation_criteria(title, description, weight),
        sup_criterion:supervisor_criteria(title, description, weight)
      `)
      .eq('evaluation_id', ev.id);

    const scoreDetails: ScoreDetail[] = (scores || []).map((s: any) => ({
      criterion_title: s.criterion_type === 'specific' ? (s.sup_criterion?.title || '') : (s.criterion?.title || ''),
      criterion_description: s.criterion_type === 'specific' ? (s.sup_criterion?.description || '') : (s.criterion?.description || ''),
      criterion_weight: s.criterion_type === 'specific' ? (s.sup_criterion?.weight || 0) : (s.criterion?.weight || 0),
      score: s.score_1_to_5,
      weighted_result: s.weighted_result,
      type: s.criterion_type || 'general',
    }));

    setDetailData({
      name: ev.employee?.full_name || '',
      jobTitle: ev.employee?.job_title || '',
      period: ev.period ? `${monthLabels[ev.period.month]} ${ev.period.year}` : '',
      scores: scoreDetails,
      finalScore500: ev.final_score_500,
      finalScore5: ev.final_score_5,
      percentage: ev.percentage,
      generalRating: ev.general_rating,
      evaluatorNote: ev.supervisor_note,
      subjectNote: ev.employee_note,
      status: ev.status,
    });
    setDetailLoading(false);
  };

  // Group employee evaluations by (employee, period) — when an employee is
  // assigned to multiple directorates, each directorate produces a
  // separate evaluation row, but the summary listing should show ONE row
  // whose percentage is the arithmetic mean.
  const [employeeDirCounts, setEmployeeDirCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const empIds = Array.from(new Set(employeeEvals.map(e => e.employee_id).filter(Boolean)));
    if (empIds.length === 0) { setEmployeeDirCounts({}); return; }
    let cancelled = false;
    (async () => {
      const counts: Record<string, number> = {};
      // Pull junction-table assignments in one round-trip; legacy
      // employees.directorate_id falls back to 1.
      const { data: assigns } = await supabase
        .from('employee_directorates')
        .select('employee_id, directorate_id')
        .in('employee_id', empIds);
      const seen = new Map<string, Set<string>>();
      (assigns || []).forEach((a: any) => {
        if (!seen.has(a.employee_id)) seen.set(a.employee_id, new Set());
        seen.get(a.employee_id)!.add(a.directorate_id);
      });
      empIds.forEach(id => { counts[id] = Math.max(seen.get(id)?.size || 0, 1); });
      if (!cancelled) setEmployeeDirCounts(counts);
    })();
    return () => { cancelled = true; };
  }, [employeeEvals]);

  const combinedEmployeeEvals = useMemo<CombinedEmployeeEval[]>(() => {
    const groups = new Map<string, EvalItem[]>();
    employeeEvals.forEach(ev => {
      const key = `${ev.employee_id}__${ev.period_id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ev);
    });
    return Array.from(groups.entries()).map(([key, evals]) => {
      const avg = (k: keyof EvalItem) => evals.reduce((s, e) => s + Number(e[k] || 0), 0) / evals.length;
      const avgPct = avg('percentage');
      return {
        key,
        employee_id: evals[0].employee_id,
        period_id: evals[0].period_id,
        employee: evals[0].employee,
        period: evals[0].period,
        evals,
        avg_percentage: avgPct,
        avg_score_5: avg('final_score_5'),
        avg_score_500: avg('final_score_500'),
        avg_rating: percentageToRating(avgPct),
        source_count: evals.length,
        total_directorates: employeeDirCounts[evals[0].employee_id] || evals.length,
      };
    });
  }, [employeeEvals, employeeDirCounts]);

  const viewCombinedEmployeeDetail = async (combined: CombinedEmployeeEval) => {
    setDetailLoading(true);
    setDetailModal(true);
    setSelectedEvalTab('summary');

    const allIds = combined.evals.map(e => e.id);
    const { data: scores } = await supabase
      .from('evaluation_scores')
      .select(`
        evaluation_id, score_1_to_5, weighted_result, criterion_type,
        criterion:evaluation_criteria(title, description, weight),
        dept_criterion:department_criteria(title, description, weight, group:department_criteria_groups(name))
      `)
      .in('evaluation_id', allIds);

    const titleOf = (s: any): string =>
      s.criterion_type === 'specific' ? (s.dept_criterion?.title || '') : (s.criterion?.title || '');
    const descOf = (s: any): string =>
      s.criterion_type === 'specific' ? (s.dept_criterion?.description || '') : (s.criterion?.description || '');
    const weightOf = (s: any): number =>
      s.criterion_type === 'specific' ? (s.dept_criterion?.weight || 0) : (s.criterion?.weight || 0);

    // Bucket A — per-evaluator score lists for the per-director tabs.
    const perEvalScores = new Map<string, ScoreDetail[]>();
    (scores || []).forEach((s: any) => {
      const arr = perEvalScores.get(s.evaluation_id) ?? [];
      arr.push({
        criterion_title: titleOf(s),
        criterion_description: descOf(s),
        criterion_weight: weightOf(s),
        score: s.score_1_to_5,
        weighted_result: s.weighted_result,
        type: (s.criterion_type || 'general') as 'general' | 'specific',
      });
      perEvalScores.set(s.evaluation_id, arr);
    });

    // Bucket B — averaged across evaluators for the Summary tab. Title
    // normalization collapses "X" / "معيار X" pairs and any whitespace
    // variants. Criteria that exist for only one evaluator (e.g. specific
    // criteria that differ between directorates) just show with count=1.
    const criterionMap = new Map<string, { totalScore: number; totalWeighted: number; count: number; title: string; desc: string; weight: number; type: string }>();
    (scores || []).forEach((s: any) => {
      const rawTitle = titleOf(s);
      const key = `${s.criterion_type}_${normalizeCriterionTitle(rawTitle)}`;
      if (!criterionMap.has(key)) {
        criterionMap.set(key, { totalScore: 0, totalWeighted: 0, count: 0, title: rawTitle, desc: descOf(s), weight: weightOf(s), type: s.criterion_type });
      }
      const entry = criterionMap.get(key)!;
      if (rawTitle && entry.title.startsWith('معيار ') && !rawTitle.startsWith('معيار ')) {
        entry.title = rawTitle;
      }
      entry.totalScore += s.score_1_to_5;
      entry.totalWeighted += s.weighted_result;
      entry.count += 1;
    });

    const summaryScores: ScoreDetail[] = Array.from(criterionMap.values()).map(entry => ({
      criterion_title: entry.title,
      criterion_description: entry.desc,
      criterion_weight: entry.weight,
      score: Math.round((entry.totalScore / entry.count) * 100) / 100,
      weighted_result: entry.totalWeighted / entry.count,
      type: (entry.type || 'general') as 'general' | 'specific',
    }));

    const underlyingEvals: UnderlyingEvalDetail[] = combined.evals.map(ev => ({
      id: ev.id,
      evaluatorName: ev.manager?.full_name || '—',
      scopeLabel: ev.directorate?.name || null,
      scores: perEvalScores.get(ev.id) ?? [],
      finalScore500: ev.final_score_500,
      finalScore5: ev.final_score_5,
      percentage: ev.percentage,
      generalRating: ev.general_rating,
      evaluatorNote: ev.manager_note,
      status: ev.status,
    }));

    setDetailData({
      name: combined.employee?.full_name || '',
      jobTitle: combined.employee?.job_title || '',
      period: combined.period ? `${monthLabels[combined.period.month]} ${combined.period.year}` : '',
      scores: summaryScores,
      finalScore500: combined.avg_score_500,
      finalScore5: combined.avg_score_5,
      percentage: combined.avg_percentage,
      generalRating: combined.avg_rating,
      evaluatorNote: combined.evals.map(e => e.manager_note).filter(Boolean).join(' • '),
      subjectNote: combined.evals.map(e => e.employee_note).filter(Boolean).join(' • '),
      status: combined.evals.length === combined.total_directorates ? combined.evals[0]?.status : 'بانتظار الاكتمال',
      underlyingEvals,
    });
    setDetailLoading(false);
  };

  // Group director evaluations by director+period for combined display
  const combinedDirectorEvals = useMemo(() => {
    const groups = new Map<string, DirectorEval[]>();
    directorEvals.forEach(ev => {
      const key = `${ev.director_id}_${ev.period_id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ev);
    });
    return Array.from(groups.values()).map(evals => {
      const avgPercentage = evals.reduce((sum, e) => sum + (e.percentage || 0), 0) / evals.length;
      const avgScore500 = evals.reduce((sum, e) => sum + (e.final_score_500 || 0), 0) / evals.length;
      const avgScore5 = evals.reduce((sum, e) => sum + (e.final_score_5 || 0), 0) / evals.length;
      return {
        director_id: evals[0].director_id,
        period_id: evals[0].period_id,
        director: evals[0].director,
        period: evals[0].period,
        evals,
        avg_percentage: avgPercentage,
        avg_score_500: avgScore500,
        avg_score_5: avgScore5,
        avg_rating: percentageToRating(avgPercentage),
        status: evals[0].status,
      };
    });
  }, [directorEvals]);

  const viewCombinedDirectorDetail = async (combined: { evals: DirectorEval[]; avg_percentage: number; avg_score_500: number; avg_score_5: number; avg_rating: string | null; director: DirectorEval['director']; period: DirectorEval['period']; status: string }) => {
    setDetailLoading(true);
    setDetailModal(true);
    setSelectedEvalTab('summary');

    const allIds = combined.evals.map(e => e.id);
    const { data: scores } = await supabase
      .from('director_evaluation_scores')
      .select(`
        evaluation_id, score_1_to_5, weighted_result, criterion_type,
        criterion:evaluation_criteria(title, description, weight),
        dept_criterion:department_criteria(title, description, weight)
      `)
      .in('evaluation_id', allIds);

    // Director-specific criteria live in department_criteria (the CEO's
    // private director-criteria, with department/directorate/group all
    // null) and are referenced via department_criterion_id. General
    // criteria come from evaluation_criteria. Resolve each field from the
    // table that matches criterion_type so specific rows keep their own
    // title/weight instead of collapsing into a single empty-title row.
    const titleOf = (s: any): string =>
      s.criterion_type === 'specific' ? (s.dept_criterion?.title || '') : (s.criterion?.title || '');
    const descOf = (s: any): string =>
      s.criterion_type === 'specific' ? (s.dept_criterion?.description || '') : (s.criterion?.description || '');
    const weightOf = (s: any): number =>
      s.criterion_type === 'specific' ? (s.dept_criterion?.weight || 0) : (s.criterion?.weight || 0);

    // Bucket A — per-evaluator score lists for the per-CEO tabs.
    const perEvalScores = new Map<string, ScoreDetail[]>();
    (scores || []).forEach((s: any) => {
      const arr = perEvalScores.get(s.evaluation_id) ?? [];
      arr.push({
        criterion_title: titleOf(s),
        criterion_description: descOf(s),
        criterion_weight: weightOf(s),
        score: s.score_1_to_5,
        weighted_result: s.weighted_result,
        type: (s.criterion_type || 'general') as 'general' | 'specific',
      });
      perEvalScores.set(s.evaluation_id, arr);
    });

    // Bucket B — averaged across evaluators for the Summary tab. Title is
    // normalized (trim + strip "معيار " prefix) so equivalent criteria
    // collapse instead of showing twice.
    const criterionMap = new Map<string, { totalScore: number; totalWeighted: number; count: number; title: string; desc: string; weight: number; type: string }>();
    (scores || []).forEach((s: any) => {
      const rawTitle = titleOf(s);
      const desc = descOf(s);
      const weight = weightOf(s);
      const key = `${s.criterion_type}_${normalizeCriterionTitle(rawTitle)}`;
      if (!criterionMap.has(key)) criterionMap.set(key, { totalScore: 0, totalWeighted: 0, count: 0, title: rawTitle, desc, weight, type: s.criterion_type });
      const entry = criterionMap.get(key)!;
      // Prefer the prefix-free spelling so the merged row reads cleanly.
      if (rawTitle && entry.title.startsWith('معيار ') && !rawTitle.startsWith('معيار ')) {
        entry.title = rawTitle;
      }
      entry.totalScore += s.score_1_to_5;
      entry.totalWeighted += s.weighted_result;
      entry.count += 1;
    });

    const scoreDetails: ScoreDetail[] = Array.from(criterionMap.values()).map(entry => ({
      criterion_title: entry.title,
      criterion_description: entry.desc,
      criterion_weight: entry.weight,
      score: Math.round((entry.totalScore / entry.count) * 100) / 100,
      weighted_result: entry.totalWeighted / entry.count,
      type: (entry.type || 'general') as 'general' | 'specific',
    }));

    const underlyingEvals: UnderlyingEvalDetail[] = combined.evals.map(ev => ({
      id: ev.id,
      evaluatorName: ev.evaluator?.full_name || '—',
      scopeLabel: null,
      scores: perEvalScores.get(ev.id) ?? [],
      finalScore500: ev.final_score_500,
      finalScore5: ev.final_score_5,
      percentage: ev.percentage,
      generalRating: ev.general_rating,
      evaluatorNote: ev.evaluator_note,
      status: ev.status,
    }));

    const evaluatorNames = combined.evals.map(ev => `${ev.evaluator?.full_name} (${ev.percentage?.toFixed(0)}%)`).join(' | ');

    setDetailData({
      name: combined.director?.full_name || '',
      jobTitle: `${combined.director?.job_title || ''} — المقيّمون: ${evaluatorNames}`,
      period: combined.period ? `${monthLabels[combined.period.month]} ${combined.period.year}` : '',
      scores: scoreDetails,
      finalScore500: combined.avg_score_500,
      finalScore5: combined.avg_score_5,
      percentage: combined.avg_percentage,
      generalRating: combined.avg_rating,
      evaluatorNote: combined.evals.map(ev => ev.evaluator_note).filter(Boolean).join('\n---\n') || null,
      subjectNote: combined.evals.find(ev => ev.director_note)?.director_note || null,
      status: combined.status,
      underlyingEvals,
    });
    setDetailLoading(false);
  };

  // Tab-aware view: when the modal is showing a combined card with >1
  // evaluator AND a per-evaluator tab is active, swap the header/scores/
  // notes to the selected evaluator's slice. Summary tab keeps the
  // averaged view.
  const isMultiEval = !!detailData?.underlyingEvals && detailData.underlyingEvals.length > 1;
  const activeEval = isMultiEval && selectedEvalTab !== 'summary'
    ? (detailData!.underlyingEvals!.find(u => u.id === selectedEvalTab) ?? null)
    : null;
  const dispScores = activeEval ? activeEval.scores : (detailData?.scores ?? []);
  const dispPercentage = activeEval ? activeEval.percentage : (detailData?.percentage ?? 0);
  const dispFinalScore5 = activeEval ? activeEval.finalScore5 : (detailData?.finalScore5 ?? 0);
  const dispFinalScore500 = activeEval ? activeEval.finalScore500 : (detailData?.finalScore500 ?? 0);
  const dispRating = activeEval ? activeEval.generalRating : (detailData?.generalRating ?? null);
  const dispEvaluatorNote = activeEval ? activeEval.evaluatorNote : (detailData?.evaluatorNote ?? null);
  // Subject note is per-period, not per-evaluator — always show the
  // unified note from the summary level so the per-evaluator tab doesn't
  // show stale or duplicated text.
  const dispSubjectNote = activeEval ? null : (detailData?.subjectNote ?? null);
  const generalScores = dispScores.filter(s => s.type === 'general');
  const specificScores = dispScores.filter(s => s.type === 'specific');

  // Tab label for an underlying eval — directorate-prefixed when sibling
  // tabs span multiple directorates, otherwise just the evaluator's name.
  const underlyingEvalTabLabel = (u: UnderlyingEvalDetail, siblings: UnderlyingEvalDetail[]): string => {
    const distinctScopes = new Set(siblings.map(s => s.scopeLabel ?? ''));
    return distinctScopes.size > 1 && u.scopeLabel
      ? `${u.scopeLabel} — ${u.evaluatorName}`
      : u.evaluatorName;
  };

  const tabs: { key: TabType; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'ceo', label: 'تقييمات الإدارة العليا', icon: <Crown className="h-4 w-4" />, color: 'amber' },
    { key: 'directors', label: 'تقييمات مدراء الإدارات', icon: <Users className="h-4 w-4" />, color: 'blue' },
    { key: 'supervisors', label: 'تقييمات المشرفين', icon: <Shield className="h-4 w-4" />, color: 'emerald' },
    { key: 'ceo-eval', label: 'تقييمات الموظفين للرؤساء', icon: <ArrowUp className="h-4 w-4" />, color: 'rose' },
  ];

  const renderEvalTable = (evals: EvalItem[], emptyMessage: string) => (
    <Card>
      <CardBody className="p-0">
        {evals.length === 0 ? (
          <EmptyState
            message={emptyMessage}
            icon={<Users className="h-12 w-12 text-ds-faint" />}
          />
        ) : (
          <ResponsiveTable
            desktop={<Table>
            <TableHeader>
              <TableRow>
                <TableHead>الموظف</TableHead>
                <TableHead>الإدارة</TableHead>
                <TableHead>المدير المقيّم</TableHead>
                <TableHead>فترة التقييم</TableHead>
                <TableHead>النتيجة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الإجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evals.map(ev => (
                <TableRow key={ev.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar name={ev.employee?.full_name || ''} avatarUrl={ev.employee?.avatar_url} size="md" />
                      <div>
                        <span className="font-medium text-ds-text">{ev.employee?.full_name}</span>
                        <p className="text-xs text-ds-faint">{ev.employee?.job_title}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-ds-muted">{ev.department?.name || '-'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-ds-muted">{ev.manager?.full_name || '-'}</span>
                  </TableCell>
                  <TableCell>
                    {ev.period && (
                      <span className="text-sm text-ds-muted">{monthLabels[ev.period.month]} {ev.period.year}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ds-text">{ev.percentage?.toFixed(0)}%</span>
                      {ev.general_rating && (
                        <Badge variant={getRatingVariant(ev.general_rating)} size="sm">
                          {ev.general_rating}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(ev.status)} size="sm">{getStatusLabel(ev.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => viewEvalDetail(ev)} className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      <span>عرض التفاصيل</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>}
          mobile={evals.map(ev => (
            <MobileRow
              key={ev.id}
              leading={<UserAvatar name={ev.employee?.full_name || ''} avatarUrl={ev.employee?.avatar_url} size="md" />}
              title={ev.employee?.full_name || '—'}
              subtitle={ev.employee?.job_title || ''}
              statusBadge={<Badge variant={getStatusVariant(ev.status)} size="sm">{getStatusLabel(ev.status)}</Badge>}
              fields={[
                { label: 'الإدارة', value: ev.department?.name || '—' },
                { label: 'المدير المقيّم', value: ev.manager?.full_name || '—' },
                { label: 'الفترة', value: ev.period ? `${monthLabels[ev.period.month]} ${ev.period.year}` : '—' },
                { label: 'النتيجة', value: (
                  <span className="flex items-center gap-1.5">
                    <span className="font-bold text-ds-text">{ev.percentage?.toFixed(0)}%</span>
                    {ev.general_rating && <Badge variant={getRatingVariant(ev.general_rating)} size="sm">{ev.general_rating}</Badge>}
                  </span>
                ) },
              ]}
              onClick={() => viewEvalDetail(ev)}
            />
          ))}
        />
        )}
      </CardBody>
    </Card>
  );

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
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--sc-blue-val)' }}>جميع التقييمات</h1>
        <p className="mt-2" style={{ color: 'var(--sc-blue-label)' }}>عرض جميع تقييمات الإدارة العليا ومدراء الإدارات والمشرفين</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-ds-border pb-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab.key
                ? tab.color === 'amber' ? 'border-amber-600 text-amber-600 bg-ds-warning-bg' : tab.color === 'blue' ? 'border-blue-600 text-blue-600 bg-ds-info-bg' : tab.color === 'rose' ? 'border-rose-600 text-rose-600 bg-ds-danger-bg' : 'border-emerald-600 text-emerald-600 bg-ds-success-bg'
                : 'border-transparent text-ds-faint hover:text-ds-muted hover:bg-ds-bg'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      {activeTab !== 'ceo-eval' && <Card>
        <CardBody>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-ds-faint">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">تصفية:</span>
            </div>
            <ModernSelect
              value={filterPeriod}
              onChange={setFilterPeriod}
              ariaLabel="تصفية بالفترة"
              className="min-w-[200px]"
              options={[
                { value: '', label: 'جميع الفترات' },
                ...periods.map(p => ({ value: p.id, label: `${monthLabels[p.month]} ${p.year}` })),
              ]}
            />
            {activeTab === 'directors' && (
              <ModernSelect
                value={filterDirectorate}
                onChange={setFilterDirectorate}
                ariaLabel="تصفية بالإدارة"
                className="min-w-[200px]"
                options={[
                  { value: '', label: 'جميع الإدارات' },
                  ...directoratesFilter.map(d => ({ value: d.id, label: d.name })),
                ]}
              />
            )}
            {(filterPeriod || filterDepartment || filterDirectorate) && (
              <button
                onClick={resetFilters}
                className="text-sm text-red-500 hover:text-ds-danger-text transition-colors"
              >
                مسح الفلاتر
              </button>
            )}
          </div>
        </CardBody>
      </Card>}

      {/* Content */}
      {loading ? (
        <div className="page-loading-placeholder" aria-hidden="true" />
      ) : activeTab === 'ceo' ? (
        <Card>
          <CardBody className="p-0">
            {combinedDirectorEvals.length === 0 ? (
              <EmptyState
                message="لا توجد تقييمات من الإدارة العليا"
                icon={<Crown className="h-12 w-12 text-ds-faint" />}
              />
            ) : (
              <ResponsiveTable
                desktop={<Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>مدير الإدارة</TableHead>
                    <TableHead>المقيّمون</TableHead>
                    <TableHead>فترة التقييم</TableHead>
                    <TableHead>النتيجة المجمّعة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {combinedDirectorEvals.map(combined => (
                    <TableRow key={`${combined.director_id}_${combined.period_id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar name={combined.director?.full_name || ''} avatarUrl={combined.director?.avatar_url} size="md" />
                          <div>
                            <span className="font-medium text-ds-text">{combined.director?.full_name}</span>
                            <p className="text-xs text-ds-faint">{combined.director?.job_title}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {combined.evals.map(ev => (
                            <span key={ev.id} className="text-sm text-ds-muted">{ev.evaluator?.full_name} ({ev.percentage?.toFixed(0)}%)</span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {combined.period && (
                          <span className="text-sm text-ds-muted">{monthLabels[combined.period.month]} {combined.period.year}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ds-text">{combined.avg_percentage?.toFixed(0)}%</span>
                          {combined.avg_rating && (
                            <Badge variant={getRatingVariant(combined.avg_rating)} size="sm">
                              {combined.avg_rating}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(combined.status)} size="sm">{getStatusLabel(combined.status, 'ceo')}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => viewCombinedDirectorDetail(combined)} className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          <span>عرض التفاصيل</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>}
                mobile={combinedDirectorEvals.map(combined => (
                  <MobileRow
                    key={`${combined.director_id}_${combined.period_id}`}
                    leading={<UserAvatar name={combined.director?.full_name || ''} avatarUrl={combined.director?.avatar_url} size="md" />}
                    title={combined.director?.full_name || '—'}
                    subtitle={combined.director?.job_title || ''}
                    statusBadge={<Badge variant={getStatusVariant(combined.status)} size="sm">{getStatusLabel(combined.status, 'ceo')}</Badge>}
                    fields={[
                      { label: 'الفترة', value: combined.period ? `${monthLabels[combined.period.month]} ${combined.period.year}` : '—' },
                      { label: 'النتيجة', value: (
                        <span className="flex items-center gap-1.5">
                          <span className="font-bold text-ds-text">{combined.avg_percentage?.toFixed(0)}%</span>
                          {combined.avg_rating && <Badge variant={getRatingVariant(combined.avg_rating)} size="sm">{combined.avg_rating}</Badge>}
                        </span>
                      ) },
                    ]}
                    onClick={() => viewCombinedDirectorDetail(combined)}
                  />
                ))}
              />
            )}
          </CardBody>
        </Card>
      ) : activeTab === 'directors' ? (
        <Card>
          <CardBody className="p-0">
            {combinedEmployeeEvals.length === 0 ? (
              <EmptyState
                message="لا توجد تقييمات من مدراء الإدارات"
                icon={<Users className="h-12 w-12 text-ds-faint" />}
              />
            ) : (
              <ResponsiveTable
                desktop={<Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الموظف</TableHead>
                    <TableHead>الإدارات المُقيِّمة</TableHead>
                    <TableHead>فترة التقييم</TableHead>
                    <TableHead>النتيجة المُجمَّعة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {combinedEmployeeEvals.map(c => {
                    const partial = c.source_count < c.total_directorates;
                    return (
                      <TableRow key={c.key}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <UserAvatar name={c.employee?.full_name || ''} avatarUrl={c.employee?.avatar_url} size="md" />
                            <div>
                              <span className="font-medium text-ds-text">{c.employee?.full_name}</span>
                              <p className="text-xs text-ds-faint">{c.employee?.job_title}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            {c.evals.map(ev => (
                              <span key={ev.id} className="text-xs text-ds-muted">
                                {ev.directorate?.name || '—'} ({(ev.percentage || 0).toFixed(0)}%)
                              </span>
                            ))}
                            <Badge variant={partial ? 'warning' : 'default'} size="sm">
                              {c.source_count} من {c.total_directorates} إدارات
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {c.period && (
                            <span className="text-sm text-ds-muted">{monthLabels[c.period.month]} {c.period.year}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ds-text">{c.avg_percentage.toFixed(0)}%</span>
                            {c.avg_rating && (
                              <Badge variant={getRatingVariant(c.avg_rating)} size="sm">
                                {c.avg_rating}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(c.evals[0].status)} size="sm">{getStatusLabel(c.evals[0].status)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => viewCombinedEmployeeDetail(c)} className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            <span>عرض التفاصيل</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>}
                mobile={combinedEmployeeEvals.map(c => {
                  const partial = c.source_count < c.total_directorates;
                  return (
                    <MobileRow
                      key={c.key}
                      leading={<UserAvatar name={c.employee?.full_name || ''} avatarUrl={c.employee?.avatar_url} size="md" />}
                      title={c.employee?.full_name || '—'}
                      subtitle={c.employee?.job_title || ''}
                      statusBadge={<Badge variant={getStatusVariant(c.evals[0].status)} size="sm">{getStatusLabel(c.evals[0].status)}</Badge>}
                      fields={[
                        { label: 'الفترة', value: c.period ? `${monthLabels[c.period.month]} ${c.period.year}` : '—' },
                        { label: 'النتيجة', value: (
                          <span className="flex items-center gap-1.5">
                            <span className="font-bold text-ds-text">{c.avg_percentage.toFixed(0)}%</span>
                            {c.avg_rating && <Badge variant={getRatingVariant(c.avg_rating)} size="sm">{c.avg_rating}</Badge>}
                          </span>
                        ) },
                        { label: 'الإدارات', value: <Badge variant={partial ? 'warning' : 'default'} size="sm">{c.source_count} من {c.total_directorates}</Badge> },
                      ]}
                      onClick={() => viewCombinedEmployeeDetail(c)}
                    />
                  );
                })}
              />
            )}
          </CardBody>
        </Card>
      ) : activeTab === 'supervisors' ? (
        <Card>
          <CardBody className="p-0">
            {supervisorEvals.length === 0 ? (
              <EmptyState
                message="لا توجد تقييمات من المشرفين"
                icon={<Shield className="h-12 w-12 text-ds-faint" />}
              />
            ) : (
              <ResponsiveTable
                desktop={<Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الموظف</TableHead>
                    <TableHead>المشرف</TableHead>
                    <TableHead>فترة التقييم</TableHead>
                    <TableHead>النتيجة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supervisorEvals.map(ev => (
                    <TableRow key={ev.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-ds-success-bg text-ds-success rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                            {ev.employee?.full_name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <span className="font-medium text-ds-text">{ev.employee?.full_name}</span>
                            <p className="text-xs text-ds-faint">{ev.employee?.job_title}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-ds-muted">{ev.supervisor?.full_name || '-'}</span>
                      </TableCell>
                      <TableCell>
                        {ev.period && (
                          <span className="text-sm text-ds-muted">{monthLabels[ev.period.month]} {ev.period.year}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ds-text">{ev.percentage?.toFixed(0)}%</span>
                          {ev.general_rating && (
                            <Badge variant={getRatingVariant(ev.general_rating)} size="sm">
                              {ev.general_rating}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(ev.status)} size="sm">{getStatusLabel(ev.status)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => viewSupervisorDetail(ev)} className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          <span>عرض التفاصيل</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>}
                mobile={supervisorEvals.map(ev => (
                  <MobileRow
                    key={ev.id}
                    leading={
                      <div className="w-10 h-10 bg-ds-success-bg text-ds-success rounded-full flex items-center justify-center font-bold">
                        {ev.employee?.full_name?.charAt(0) || '?'}
                      </div>
                    }
                    title={ev.employee?.full_name || '—'}
                    subtitle={ev.employee?.job_title || ''}
                    statusBadge={<Badge variant={getStatusVariant(ev.status)} size="sm">{getStatusLabel(ev.status)}</Badge>}
                    fields={[
                      { label: 'المشرف', value: ev.supervisor?.full_name || '—' },
                      { label: 'الفترة', value: ev.period ? `${monthLabels[ev.period.month]} ${ev.period.year}` : '—' },
                      { label: 'النتيجة', value: (
                        <span className="flex items-center gap-1.5">
                          <span className="font-bold text-ds-text">{ev.percentage?.toFixed(0)}%</span>
                          {ev.general_rating && <Badge variant={getRatingVariant(ev.general_rating)} size="sm">{ev.general_rating}</Badge>}
                        </span>
                      ) },
                    ]}
                    onClick={() => viewSupervisorDetail(ev)}
                  />
                ))}
              />
            )}
          </CardBody>
        </Card>
      ) : (
        <AllCeoEvaluations embedded />
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={detailModal}
        onClose={() => { setDetailModal(false); setDetailData(null); setSelectedEvalTab('summary'); }}
        title={detailData ? `تفاصيل تقييم: ${detailData.name}` : 'تفاصيل التقييم'}
        size="lg"
      >
        {detailLoading ? (
          <div className="page-loading-placeholder" aria-hidden="true" />
        ) : detailData ? (
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-ds-bg rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-ds-text text-lg">{detailData.name}</p>
                  <p className="text-sm text-ds-muted">{detailData.jobTitle}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-ds-faint">فترة التقييم</p>
                  <p className="font-medium text-ds-text">{detailData.period}</p>
                </div>
              </div>
            </div>

            {/* Per-evaluator tabs — visible only when more than one
                evaluator contributed. Default tab is "الملخص" (the
                averaged view); remaining tabs drill into each evaluator's
                raw scores so duplicate criteria don't appear. */}
            {isMultiEval && (
              <div className="tabs" role="tablist" aria-label="عرض حسب المقيّم">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedEvalTab === 'summary'}
                  className={`tab ${selectedEvalTab === 'summary' ? 'on' : ''}`}
                  onClick={() => setSelectedEvalTab('summary')}
                >
                  الملخص
                </button>
                {detailData.underlyingEvals!.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    role="tab"
                    aria-selected={selectedEvalTab === u.id}
                    className={`tab ${selectedEvalTab === u.id ? 'on' : ''}`}
                    onClick={() => setSelectedEvalTab(u.id)}
                  >
                    {underlyingEvalTabLabel(u, detailData.underlyingEvals!)}
                  </button>
                ))}
              </div>
            )}

            {/* Final Results */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-ds-info-bg rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 mb-1">النتيجة / 500</p>
                <p className="text-lg sm:text-xl font-bold text-ds-info-text">{dispFinalScore500?.toFixed(1)}</p>
              </div>
              <div className="bg-ds-purple-bg rounded-lg p-3 text-center">
                <p className="text-xs text-purple-600 mb-1">النتيجة / 5</p>
                <p className="text-lg sm:text-xl font-bold text-ds-purple-text">{dispFinalScore5?.toFixed(2)}</p>
              </div>
              <div className="bg-ds-info-bg rounded-lg p-3 text-center">
                <p className="text-xs text-teal-600 mb-1">النسبة المئوية</p>
                <p className="text-lg sm:text-xl font-bold text-ds-info-text">{dispPercentage?.toFixed(0)}%</p>
              </div>
              <div className="bg-ds-warning-bg rounded-lg p-3 text-center">
                <p className="text-xs text-amber-600 mb-1">التقدير العام</p>
                {dispRating ? (
                  <Badge variant={getRatingVariant(dispRating)}>{dispRating}</Badge>
                ) : (
                  <span className="text-ds-faint text-sm">-</span>
                )}
              </div>
            </div>

            {/* General Criteria */}
            {generalScores.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-ds-info-text mb-2 flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  المعايير العامة
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
                  <Star className="h-4 w-4" />
                  المعايير الخاصة
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
            {(dispEvaluatorNote || dispSubjectNote) && (
              <div className="space-y-3">
                {dispEvaluatorNote && (
                  <div className="bg-ds-info-bg rounded-lg p-4">
                    <p className="text-xs font-medium text-ds-info-text mb-1">ملاحظات المقيّم</p>
                    <p className="text-sm text-ds-text">{dispEvaluatorNote}</p>
                  </div>
                )}
                {dispSubjectNote && (
                  <div className="bg-ds-bg rounded-lg p-4">
                    <p className="text-xs font-medium text-ds-muted mb-1">ملاحظات المُقيَّم</p>
                    <p className="text-sm text-ds-text">{dispSubjectNote}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
