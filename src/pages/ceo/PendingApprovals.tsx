import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TextArea } from '../../components/ui/Input';
import { Modal, ModalFooter } from '../../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { CheckCircle, XCircle, Eye, Clock, FileText, Star, Filter, Users, Crown, UserCog, Shield } from 'lucide-react';
import { percentageToRating } from '../../lib/scoring';
import { UserAvatar } from '../../components/ui/UserAvatar';

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
    case 'موافقة': case 'اطلع الموظف': case 'مغلق': return 'success';
    case 'مرفوض': return 'danger';
    default: return 'default';
  }
};

const getStatusLabel = (status: string): string => {
  if (status === 'تم الإرسال') return 'بانتظار الموافقة';
  if (status === 'بانتظار الموافقة') return 'بانتظار الموافقة';
  if (status === 'موافقة' || status === 'اطلع الموظف' || status === 'مغلق') return 'تمت الموافقة';
  if (status === 'مرفوض') return 'مرفوض';
  return status;
};

interface EvalItem {
  id: string;
  employee_id?: string;
  period_id?: string;
  directorate_id?: string | null;
  employee: { full_name: string; job_title: string; employee_number: string } | null;
  manager: { full_name: string } | null;
  department: { name: string } | null;
  period: { year: number; month: number } | null;
  status: string;
  final_score_500: number;
  final_score_5: number;
  percentage: number;
  general_rating: string | null;
  manager_note: string | null;
  employee_note: string | null;
  ceo_comment: string | null;
  submitted_at: string | null;
}

interface CombinedEmployeeEval {
  // Stable composite key for React rendering / detail open state
  groupKey: string;
  ids: string[];
  primary: EvalItem; // representative row (latest submitted_at)
  manager_label: string;
  percentage: number;
  final_score_500: number;
  final_score_5: number;
  general_rating: string | null;
  status: string;
}

const COMBINED_EMP_STATUS_PRIORITY = [
  'موافقة', 'بانتظار الموافقة', 'تم الإرسال', 'مرفوض',
];

const pickEmpCombinedStatus = (statuses: string[]): string => {
  for (const s of COMBINED_EMP_STATUS_PRIORITY) if (statuses.includes(s)) return s;
  return statuses[0];
};

interface DirectorEvalItem {
  id: string;
  director_id: string;
  period_id: string;
  director: { full_name: string; job_title: string } | null;
  evaluator: { full_name: string } | null;
  period: { year: number; month: number } | null;
  status: string;
  final_score_500: number;
  final_score_5: number;
  percentage: number;
  general_rating: string | null;
  evaluator_note: string | null;
  director_note: string | null;
  ceo_comment: string | null;
  submitted_at: string | null;
}

interface CombinedDirectorEval {
  director_id: string;
  period_id: string;
  director: { full_name: string; job_title: string } | null;
  period: { year: number; month: number } | null;
  evals: DirectorEvalItem[];
  avg_percentage: number;
  avg_score_500: number;
  avg_score_5: number;
  avg_rating: string | null;
  status: string;
}

interface SupervisorEvalItem {
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

// Per-evaluator slice surfaced inside a combined approval modal so the
// CEO can see each evaluator's raw scores and note instead of only the
// averaged Summary view.
interface UnderlyingEvalDetail {
  id: string;
  evaluatorName: string;
  scopeLabel: string | null; // directorate name for combined-employee; null for combined-director
  scores: ScoreDetail[];
  finalScore500: number;
  finalScore5: number;
  percentage: number;
  generalRating: string | null;
  evaluatorNote: string | null;
  status: string;
}

// Trim whitespace + strip leading "معيار " prefix so equivalent criteria
// from different evaluators collapse together in the averaged Summary
// view. Mirrors the helper in AllEvaluations.tsx.
const normalizeCriterionTitle = (t: string): string => {
  const trimmed = (t || '').replace(/\s+/g, ' ').trim();
  return trimmed.startsWith('معيار ') ? trimmed.slice('معيار '.length).trim() : trimmed;
};

type MainTab = 'ceo' | 'directors' | 'supervisors';
type StatusFilter = 'pending' | 'rejected' | 'approved' | 'all';

export const PendingApprovals: React.FC = () => {
  const { user } = useAuth();
  const [mainTab, setMainTab] = useState<MainTab>('ceo');
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('pending');

  // Employee evaluations (directors evaluating employees)
  const [evaluations, setEvaluations] = useState<EvalItem[]>([]);
  const [empLoading, setEmpLoading] = useState(true);

  // CEO → Director evaluations
  const [directorEvals, setDirectorEvals] = useState<DirectorEvalItem[]>([]);
  const [dirLoading, setDirLoading] = useState(true);

  // Supervisor evaluations
  const [supervisorEvals, setSupervisorEvals] = useState<SupervisorEvalItem[]>([]);
  const [supLoading, setSupLoading] = useState(true);

  // Directorates that have a secondary director — pending evaluations from
  // these must wait for BOTH directors to submit before reaching the CEO.
  // A solo submission would otherwise short-circuit the average and let
  // one director unilaterally push to approval.
  const [coDirectorateIds, setCoDirectorateIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('directorates')
        .select('id')
        .not('secondary_director_id', 'is', null);
      setCoDirectorateIds(new Set((data || []).map((d: any) => d.id)));
    })();
  }, []);

  // Group employee evaluations by (employee_id, period_id) so the two rows
  // produced by co-directors of the same directorate collapse into one
  // "الإدارة العليا" entry with averaged scores.
  const combinedEmployeeEvals = useMemo<CombinedEmployeeEval[]>(() => {
    const groups = new Map<string, EvalItem[]>();
    evaluations.forEach(ev => {
      const key = `${ev.employee_id || ev.id}::${ev.period_id || ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ev);
    });
    const out: CombinedEmployeeEval[] = [];
    groups.forEach((rows, key) => {
      if (rows.length === 1) {
        const r = rows[0];
        // Co-directorate guard: if the directorate has a secondary
        // director and this is still pending CEO review, hide the row
        // until the partner submits and the pair averages. Approved or
        // rejected solo rows still surface so historical audit isn't
        // erased.
        const isPending = r.status === 'تم الإرسال' || r.status === 'بانتظار الموافقة';
        if (isPending && r.directorate_id && coDirectorateIds.has(r.directorate_id)) {
          return;
        }
        out.push({
          groupKey: key,
          ids: [r.id],
          primary: r,
          manager_label: r.manager?.full_name || '-',
          percentage: r.percentage,
          final_score_500: r.final_score_500,
          final_score_5: r.final_score_5,
          general_rating: r.general_rating,
          status: r.status,
        });
        return;
      }
      const avg = (k: 'percentage' | 'final_score_500' | 'final_score_5') =>
        rows.reduce((s, r) => s + (r[k] || 0), 0) / rows.length;
      const newest = rows.reduce((a, b) =>
        (a.submitted_at && b.submitted_at && new Date(a.submitted_at).getTime() > new Date(b.submitted_at).getTime()) ? a : b
      );
      const status = pickEmpCombinedStatus(rows.map(r => r.status));
      out.push({
        groupKey: key,
        ids: rows.map(r => r.id),
        primary: newest,
        manager_label: 'الإدارة العليا',
        percentage: avg('percentage'),
        final_score_500: avg('final_score_500'),
        final_score_5: avg('final_score_5'),
        general_rating: newest.general_rating,
        status,
      });
    });
    // Preserve original order: most-recent submission first
    return out.sort((a, b) => {
      const ta = a.primary.submitted_at ? new Date(a.primary.submitted_at).getTime() : 0;
      const tb = b.primary.submitted_at ? new Date(b.primary.submitted_at).getTime() : 0;
      return tb - ta;
    });
  }, [evaluations, coDirectorateIds]);

  // Detail modal
  const [detailModal, setDetailModal] = useState(false);
  const [detailEval, setDetailEval] = useState<EvalItem | null>(null);
  const [detailDirEval, setDetailDirEval] = useState<DirectorEvalItem | null>(null);
  // `detailScores` holds the averaged criterion list for the Summary tab.
  // `detailPerEvalScores` is keyed by underlying eval id and feeds the
  // per-evaluator tabs. `detailUnderlyingEvals` carries identity + headline
  // figures for each evaluator so the tab strip can render labels and
  // switch the modal header values.
  const [detailScores, setDetailScores] = useState<ScoreDetail[]>([]);
  const [detailPerEvalScores, setDetailPerEvalScores] = useState<Record<string, ScoreDetail[]>>({});
  const [detailUnderlyingEvals, setDetailUnderlyingEvals] = useState<UnderlyingEvalDetail[]>([]);
  const [selectedEvalTab, setSelectedEvalTab] = useState<string>('summary');
  const [detailLoading, setDetailLoading] = useState(false);
  // When opening a combined employee evaluation, the modal displays an
  // averaged view but each director's note is shown separately.
  const [detailEmpCombined, setDetailEmpCombined] = useState<{
    ids: string[];
    avg_percentage: number;
    avg_score_500: number;
    avg_score_5: number;
    notes: { name: string; note: string }[];
    employee_note: string | null;
    ceo_comment: string | null;
  } | null>(null);

  // Reject modal
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; type: 'employee' | 'director' | 'supervisor' } | null>(null);
  // For combined employee evaluations: which underlying rows the user wants
  // to reject. Empty list = single eval (skip the picker).
  const [rejectEvaluators, setRejectEvaluators] = useState<{ id: string; name: string; selected: boolean }[]>([]);
  const [rejectComment, setRejectComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Reset filter when switching tabs
  useEffect(() => {
    setActiveFilter('pending');
  }, [mainTab]);

  const fetchEmployeeEvaluations = useCallback(async () => {
    setEmpLoading(true);

    let query = supabase
      .from('evaluations')
      .select(`
        id, employee_id, period_id, directorate_id, status, final_score_500, final_score_5, percentage, general_rating,
        manager_note, employee_note, ceo_comment, submitted_at,
        employee:employees(full_name, job_title, employee_number),
        manager:users!evaluations_manager_id_fkey(full_name),
        department:departments(name),
        period:evaluation_periods(year, month)
      `)
      .order('submitted_at', { ascending: false });

    if (activeFilter === 'pending') {
      query = query.in('status', ['تم الإرسال', 'بانتظار الموافقة']);
    } else if (activeFilter === 'rejected') {
      query = query.eq('status', 'مرفوض');
    } else if (activeFilter === 'approved') {
      query = query.eq('status', 'موافقة');
    } else {
      query = query.in('status', ['تم الإرسال', 'بانتظار الموافقة', 'موافقة', 'مرفوض']);
    }

    const { data } = await query;
    setEvaluations((data as unknown as EvalItem[]) || []);
    setEmpLoading(false);
  }, [activeFilter]);

  const fetchDirectorEvaluations = useCallback(async () => {
    setDirLoading(true);

    let query = supabase
      .from('director_evaluations')
      .select(`
        id, director_id, period_id, status, final_score_500, final_score_5, percentage, general_rating,
        evaluator_note, director_note, ceo_comment, submitted_at,
        director:users!director_evaluations_director_id_fkey(full_name, job_title),
        evaluator:users!director_evaluations_evaluator_id_fkey(full_name),
        period:evaluation_periods(year, month)
      `)
      .eq('evaluation_type', 'ceo_director')
      .order('submitted_at', { ascending: false });

    if (activeFilter === 'pending') {
      query = query.eq('status', 'بانتظار الموافقة');
    } else if (activeFilter === 'rejected') {
      query = query.eq('status', 'مرفوض');
    } else if (activeFilter === 'approved') {
      query = query.eq('status', 'موافقة');
    } else {
      query = query.in('status', ['بانتظار الموافقة', 'موافقة', 'مرفوض']);
    }

    const { data } = await query;
    setDirectorEvals((data as unknown as DirectorEvalItem[]) || []);
    setDirLoading(false);
  }, [activeFilter]);

  const fetchSupervisorEvaluations = useCallback(async () => {
    setSupLoading(true);

    let query = supabase
      .from('supervisor_evaluations')
      .select(`
        id, status, final_score_500, final_score_5, percentage, general_rating,
        supervisor_note, employee_note, submitted_at,
        supervisor:users!supervisor_evaluations_supervisor_id_fkey(full_name),
        employee:employees!supervisor_evaluations_employee_id_fkey(full_name, job_title, employee_number),
        period:evaluation_periods(year, month)
      `)
      .order('submitted_at', { ascending: false });

    if (activeFilter === 'pending') {
      query = query.eq('status', 'تم الإرسال');
    } else if (activeFilter === 'rejected') {
      query = query.eq('status', 'مرفوض');
    } else if (activeFilter === 'approved') {
      query = query.in('status', ['اطلع الموظف', 'مغلق']);
    } else {
      query = query.in('status', ['تم الإرسال', 'اطلع الموظف', 'مغلق', 'مرفوض']);
    }

    const { data } = await query;
    setSupervisorEvals((data as unknown as SupervisorEvalItem[]) || []);
    setSupLoading(false);
  }, [activeFilter]);

  useEffect(() => {
    if (mainTab === 'ceo') {
      fetchDirectorEvaluations();
    } else if (mainTab === 'directors') {
      fetchEmployeeEvaluations();
    } else {
      fetchSupervisorEvaluations();
    }
  }, [mainTab, activeFilter, fetchEmployeeEvaluations, fetchDirectorEvaluations, fetchSupervisorEvaluations]);

  // View employee evaluation detail
  const viewEmpDetail = async (ev: EvalItem) => {
    setDetailLoading(true);
    setDetailModal(true);
    setDetailEval(ev);
    setDetailDirEval(null);
    setDetailEmpCombined(null);

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

    setDetailScores(scoreDetails);
    setDetailLoading(false);
  };

  // Open the combined "الإدارة العليا" view for an employee that two
  // co-directors evaluated. Averages criterion scores for the Summary tab
  // and exposes per-evaluator slices so the CEO can drill into each
  // director's individual scores via the tab strip.
  const viewCombinedEmpDetail = async (group: CombinedEmployeeEval) => {
    setDetailLoading(true);
    setDetailModal(true);
    setDetailDirEval(null);
    setSelectedEvalTab('summary');

    // Pull every underlying eval row in full so we have manager names,
    // directorate scope, percentages, and notes — needed both for the
    // existing notes block and for the new per-evaluator tabs.
    const { data: fullRows } = await supabase
      .from('evaluations')
      .select(`
        id, status, final_score_500, final_score_5, percentage, general_rating,
        manager_note, employee_note, ceo_comment, submitted_at,
        employee:employees(full_name, job_title, employee_number),
        manager:users!evaluations_manager_id_fkey(full_name),
        department:departments(name),
        directorate:directorates(id, name),
        period:evaluation_periods(year, month)
      `)
      .in('id', group.ids);

    const rows = (fullRows as unknown as (EvalItem & { directorate?: { id: string; name: string } | null })[]) || [];
    const primary = rows.find(r => r.id === group.primary.id) || rows[0] || group.primary;

    setDetailEval({
      ...primary,
      manager: { full_name: 'الإدارة العليا' },
      percentage: group.percentage,
      final_score_500: group.final_score_500,
      final_score_5: group.final_score_5,
      general_rating: group.general_rating,
      manager_note: null,
      status: group.status,
    });

    setDetailEmpCombined({
      ids: group.ids,
      avg_percentage: group.percentage,
      avg_score_500: group.final_score_500,
      avg_score_5: group.final_score_5,
      notes: rows
        .map(r => ({ name: r.manager?.full_name || '', note: r.manager_note || '' }))
        .filter(n => n.note),
      employee_note: rows.find(r => r.employee_note)?.employee_note || null,
      ceo_comment: rows.find(r => r.ceo_comment)?.ceo_comment || null,
    });

    const { data: scores } = await supabase
      .from('evaluation_scores')
      .select(`
        evaluation_id, score_1_to_5, weighted_result, criterion_type,
        criterion_id, department_criterion_id,
        criterion:evaluation_criteria(title, description, weight),
        dept_criterion:department_criteria(title, description, weight, group:department_criteria_groups(name))
      `)
      .in('evaluation_id', group.ids);

    const titleOf = (s: any): string =>
      s.criterion_type === 'specific' ? (s.dept_criterion?.title || '') : (s.criterion?.title || '');
    const descOf = (s: any): string =>
      s.criterion_type === 'specific' ? (s.dept_criterion?.description || '') : (s.criterion?.description || '');
    const weightOf = (s: any): number =>
      s.criterion_type === 'specific' ? (s.dept_criterion?.weight || 0) : (s.criterion?.weight || 0);

    // Bucket A — per-evaluator score lists (no averaging) for the tabs.
    const perEval = new Map<string, ScoreDetail[]>();
    (scores || []).forEach((s: any) => {
      const arr = perEval.get(s.evaluation_id) ?? [];
      arr.push({
        criterion_title: titleOf(s),
        criterion_description: descOf(s),
        criterion_weight: weightOf(s),
        score: s.score_1_to_5,
        weighted_result: s.weighted_result,
        type: (s.criterion_type || 'general') as 'general' | 'specific',
      });
      perEval.set(s.evaluation_id, arr);
    });
    setDetailPerEvalScores(Object.fromEntries(perEval));

    // Bucket B — averaged for the Summary tab. Title normalization
    // collapses "X" / "معيار X" pairs that surface as different rows.
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

    const scoreDetails: ScoreDetail[] = Array.from(criterionMap.values()).map(entry => ({
      criterion_title: entry.title,
      criterion_description: entry.desc,
      criterion_weight: entry.weight,
      score: Math.round((entry.totalScore / entry.count) * 100) / 100,
      weighted_result: entry.totalWeighted / entry.count,
      type: (entry.type || 'general') as 'general' | 'specific',
    }));

    const underlyingEvals: UnderlyingEvalDetail[] = rows.map(r => ({
      id: r.id,
      evaluatorName: r.manager?.full_name || '—',
      scopeLabel: r.directorate?.name || null,
      scores: perEval.get(r.id) ?? [],
      finalScore500: r.final_score_500,
      finalScore5: r.final_score_5,
      percentage: r.percentage,
      generalRating: r.general_rating,
      evaluatorNote: r.manager_note,
      status: r.status,
    }));
    setDetailUnderlyingEvals(underlyingEvals);

    setDetailScores(scoreDetails);
    setDetailLoading(false);
  };

  // View director evaluation detail
  const viewDirDetail = async (ev: DirectorEvalItem) => {
    setDetailLoading(true);
    setDetailModal(true);
    setDetailDirEval(ev);
    setDetailEval(null);

    const { data: scores } = await supabase
      .from('director_evaluation_scores')
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

    setDetailScores(scoreDetails);
    setDetailLoading(false);
  };

  // View supervisor evaluation detail
  const [detailSupEval, setDetailSupEval] = useState<SupervisorEvalItem | null>(null);

  const viewSupDetail = async (ev: SupervisorEvalItem) => {
    setDetailLoading(true);
    setDetailModal(true);
    setDetailSupEval(ev);
    setDetailEval(null);
    setDetailDirEval(null);

    // Fetch raw scores first; resolve criterion titles/weights in a second
    // pass. Splitting the queries keeps the criteria sections rendering
    // even if a single embedded join hits an RLS edge case.
    const { data: scores } = await supabase
      .from('supervisor_evaluation_scores')
      .select('score_1_to_5, weighted_result, criterion_type, criterion_id, supervisor_criterion_id')
      .eq('evaluation_id', ev.id);

    const rows = (scores as any[]) || [];
    const generalIds = Array.from(new Set(rows.filter(r => r.criterion_type !== 'specific' && r.criterion_id).map(r => r.criterion_id)));
    const specificIds = Array.from(new Set(rows.filter(r => r.criterion_type === 'specific' && r.supervisor_criterion_id).map(r => r.supervisor_criterion_id)));

    const [{ data: genCrit }, { data: supCrit }] = await Promise.all([
      generalIds.length
        ? supabase.from('evaluation_criteria').select('id, title, description, weight').in('id', generalIds)
        : Promise.resolve({ data: [] as any[] }),
      specificIds.length
        ? supabase.from('supervisor_criteria').select('id, title, description, weight').in('id', specificIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const genMap = new Map((genCrit || []).map((c: any) => [c.id, c]));
    const supMap = new Map((supCrit || []).map((c: any) => [c.id, c]));

    const scoreDetails: ScoreDetail[] = rows.map((s: any) => {
      const c = s.criterion_type === 'specific' ? supMap.get(s.supervisor_criterion_id) : genMap.get(s.criterion_id);
      return {
        criterion_title: c?.title || '',
        criterion_description: c?.description || '',
        criterion_weight: c?.weight || 0,
        score: s.score_1_to_5,
        weighted_result: s.weighted_result,
        type: s.criterion_type || 'general',
      };
    });

    setDetailScores(scoreDetails);
    setDetailLoading(false);
  };

  const handleApprove = async (id: string, type: 'employee' | 'director' | 'supervisor') => {
    if (!user) return;
    setActionLoading(true);

    const table = type === 'employee' ? 'evaluations' : type === 'director' ? 'director_evaluations' : 'supervisor_evaluations';
    const approvedStatus = type === 'supervisor' ? 'اطلع الموظف' : 'موافقة';

    // Co-director directorates produce two evaluation rows for the same
    // (employee, period). Either director's approval covers both — flip
    // every sibling row to "موافقة" in one shot.
    let idsToApprove: string[] = [id];
    if (type === 'employee') {
      const { data: target } = await supabase
        .from('evaluations')
        .select('employee_id, period_id')
        .eq('id', id)
        .maybeSingle();
      if (target) {
        const { data: siblings } = await supabase
          .from('evaluations')
          .select('id')
          .eq('employee_id', target.employee_id)
          .eq('period_id', target.period_id)
          .in('status', ['تم الإرسال', 'بانتظار الموافقة']);
        idsToApprove = (siblings || []).map(s => s.id);
        if (idsToApprove.length === 0) idsToApprove = [id];
      }
    }

    await supabase
      .from(table)
      .update({
        status: approvedStatus,
        ...(type !== 'supervisor' ? { ceo_comment: null, ceo_reviewed_at: new Date().toISOString(), ceo_reviewer_id: user.id } : {}),
      })
      .in('id', idsToApprove);

    const actionLabel = type === 'employee' ? 'موافقة على تقييم موظف' : type === 'director' ? 'موافقة على تقييم مدير' : 'موافقة على تقييم مشرف';
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: actionLabel,
      entity_type: table,
      entity_id: id,
      ...(idsToApprove.length > 1 ? { details: { all_ids: idsToApprove } } : {}),
    });

    setActionLoading(false);
    setDetailModal(false);
    setDetailEval(null);
    setDetailDirEval(null);
    setDetailSupEval(null);
    if (type === 'employee') fetchEmployeeEvaluations();
    else if (type === 'director') fetchDirectorEvaluations();
    else fetchSupervisorEvaluations();
  };

  const openRejectModal = (id: string, type: 'employee' | 'director' | 'supervisor') => {
    setRejectTarget({ id, type });
    setRejectComment('');
    // Populate the evaluator picker only for combined employee rejections.
    // We map each underlying eval id to its evaluator name from the
    // already-loaded `evaluations` array.
    if (type === 'employee' && id.includes(',')) {
      const ids = id.split(',');
      setRejectEvaluators(ids.map(i => {
        const ev = evaluations.find(e => e.id === i);
        return { id: i, name: ev?.manager?.full_name || '—', selected: true };
      }));
    } else {
      setRejectEvaluators([]);
    }
    setRejectModal(true);
  };

  const handleReject = async () => {
    if (!user || !rejectTarget || !rejectComment.trim()) return;
    setActionLoading(true);

    const table = rejectTarget.type === 'employee' ? 'evaluations' : rejectTarget.type === 'director' ? 'director_evaluations' : 'supervisor_evaluations';

    // Combined rejection: only reject the IDs the user picked. Outside of
    // the combined-employee case `rejectEvaluators` is empty and we fall
    // through to the legacy comma-split.
    const ids = rejectEvaluators.length > 0
      ? rejectEvaluators.filter(e => e.selected).map(e => e.id)
      : rejectTarget.id.split(',');
    if (ids.length === 0) {
      setActionLoading(false);
      return;
    }
    for (const id of ids) {
      await supabase
        .from(table)
        .update({
          status: 'مرفوض',
          ...(rejectTarget.type !== 'supervisor' ? { ceo_comment: rejectComment, ceo_reviewed_at: new Date().toISOString(), ceo_reviewer_id: user.id } : {}),
        })
        .eq('id', id);
    }

    const actionLabel = rejectTarget.type === 'employee' ? 'رفض تقييم موظف' : rejectTarget.type === 'director' ? 'رفض تقييم مدير' : 'رفض تقييم مشرف';
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: actionLabel,
      entity_type: table,
      entity_id: ids[0],
      details: { comment: rejectComment, all_ids: ids },
    });

    setActionLoading(false);
    setRejectModal(false);
    setRejectTarget(null);
    setRejectEvaluators([]);
    setDetailModal(false);
    setDetailEval(null);
    setDetailDirEval(null);
    setDetailSupEval(null);
    if (rejectTarget.type === 'employee') fetchEmployeeEvaluations();
    else if (rejectTarget.type === 'director') fetchDirectorEvaluations();
    else fetchSupervisorEvaluations();
  };

  // Combined director eval detail state
  const [detailCombined, setDetailCombined] = useState<CombinedDirectorEval | null>(null);

  const viewCombinedDirDetail = async (combined: CombinedDirectorEval) => {
    setDetailLoading(true);
    setDetailModal(true);
    setDetailEval(null);
    setDetailDirEval(null);
    setDetailSupEval(null);
    setDetailCombined(combined);
    setSelectedEvalTab('summary');

    // Fetch scores for all evals in this combined group
    const allIds = combined.evals.map(e => e.id);
    const { data: scores } = await supabase
      .from('director_evaluation_scores')
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

    // Bucket A — per-CEO score lists (no averaging) for the tabs.
    const perEval = new Map<string, ScoreDetail[]>();
    (scores || []).forEach((s: any) => {
      const arr = perEval.get(s.evaluation_id) ?? [];
      arr.push({
        criterion_title: titleOf(s),
        criterion_description: descOf(s),
        criterion_weight: weightOf(s),
        score: s.score_1_to_5,
        weighted_result: s.weighted_result,
        type: (s.criterion_type || 'general') as 'general' | 'specific',
      });
      perEval.set(s.evaluation_id, arr);
    });
    setDetailPerEvalScores(Object.fromEntries(perEval));

    // Bucket B — averaged for the Summary tab. Two dedupe sources:
    //   1) Same criterion scored by two CEOs (different evaluation_id,
    //      same criterion_id) — collapses naturally.
    //   2) "X" vs "معيار X" duplicate criterion rows — handled by the
    //      shared normalizeCriterionTitle helper at file scope. Prefer
    //      the prefix-free spelling when displaying the merged row.
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
      scores: perEval.get(ev.id) ?? [],
      finalScore500: ev.final_score_500,
      finalScore5: ev.final_score_5,
      percentage: ev.percentage,
      generalRating: ev.general_rating,
      evaluatorNote: ev.evaluator_note,
      status: ev.status,
    }));
    setDetailUnderlyingEvals(underlyingEvals);

    setDetailScores(scoreDetails);
    setDetailLoading(false);
  };

  const handleApproveCombined = async (combined: CombinedDirectorEval) => {
    if (!user) return;
    setActionLoading(true);
    const ids = combined.evals.map(e => e.id);
    for (const id of ids) {
      await supabase.from('director_evaluations').update({
        status: 'موافقة',
        ceo_comment: null,
        ceo_reviewed_at: new Date().toISOString(),
        ceo_reviewer_id: user.id,
      }).eq('id', id);
    }
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'موافقة على تقييم مدير (مجمّع)',
      entity_type: 'director_evaluations',
      entity_id: ids[0],
      details: { all_ids: ids },
    });
    setActionLoading(false);
    setDetailModal(false);
    setDetailCombined(null);
    fetchDirectorEvaluations();
  };

  const openRejectCombinedModal = (combined: CombinedDirectorEval) => {
    setRejectTarget({ id: combined.evals.map(e => e.id).join(','), type: 'director' });
    setRejectComment('');
    setRejectModal(true);
  };

  // Group director evaluations by director+period and compute averages
  const combinedDirectorEvals = useMemo<CombinedDirectorEval[]>(() => {
    const groups = new Map<string, DirectorEvalItem[]>();
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

  // When the modal is showing a combined card with >1 evaluator AND a
  // per-evaluator tab is active, swap header / scores / notes to that
  // evaluator's slice. Summary tab keeps the averaged view that the CEO
  // approves against.
  const isMultiEval = detailUnderlyingEvals.length > 1;
  const activeEval = isMultiEval && selectedEvalTab !== 'summary'
    ? (detailUnderlyingEvals.find(u => u.id === selectedEvalTab) ?? null)
    : null;
  const dispScores = activeEval ? activeEval.scores : detailScores;
  const generalScores = dispScores.filter(s => s.type === 'general');
  const specificScores = dispScores.filter(s => s.type === 'specific');

  // Tab label — directorate-prefixed for combined-employee where sibling
  // directorates differ, otherwise just the evaluator's name.
  const underlyingEvalTabLabel = (u: UnderlyingEvalDetail, siblings: UnderlyingEvalDetail[]): string => {
    const distinctScopes = new Set(siblings.map(s => s.scopeLabel ?? ''));
    return distinctScopes.size > 1 && u.scopeLabel
      ? `${u.scopeLabel} — ${u.evaluatorName}`
      : u.evaluatorName;
  };

  const filterTabs = [
    { key: 'pending' as const, label: 'قيد المراجعة', icon: <Clock className="h-4 w-4" /> },
    { key: 'rejected' as const, label: 'مرفوض', icon: <XCircle className="h-4 w-4" /> },
    { key: 'approved' as const, label: 'موافقة', icon: <CheckCircle className="h-4 w-4" /> },
    { key: 'all' as const, label: 'الكل', icon: <Filter className="h-4 w-4" /> },
  ];

  // Current detail subject
  const currentDetailStatus = detailEval?.status || detailDirEval?.status || detailCombined?.status || detailSupEval?.status || '';
  const currentDetailId = detailEval?.id || detailDirEval?.id || detailSupEval?.id || '';
  const currentDetailType: 'employee' | 'director' | 'supervisor' = detailEval ? 'employee' : (detailDirEval || detailCombined) ? 'director' : 'supervisor';
  const isPendingApproval = currentDetailStatus === 'بانتظار الموافقة' || currentDetailStatus === 'تم الإرسال';

  return (
    <div className="space-y-6">
      <div
        className="rounded-ds-xl p-4 sm:p-5 lg:p-8"
        style={{
          background: 'var(--sc-purple-grad)',
          border: '1px solid var(--sc-purple-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--sc-purple-val)' }}>اعتمادية التقييمات</h1>
        <p className="mt-2" style={{ color: 'var(--sc-purple-label)' }}>مراجعة واعتماد جميع التقييمات</p>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 border-b border-ds-border">
        {([
          { key: 'ceo' as const, label: 'تقييمات الإدارة العليا', icon: <Crown className="h-4 w-4" />, color: 'amber' },
          { key: 'directors' as const, label: 'تقييمات مدراء الإدارات', icon: <Users className="h-4 w-4" />, color: 'blue' },
          { key: 'supervisors' as const, label: 'تقييمات المشرفين', icon: <Shield className="h-4 w-4" />, color: 'emerald' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setMainTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              mainTab === tab.key
                ? tab.color === 'amber' ? 'border-amber-600 text-amber-600' : tab.color === 'blue' ? 'border-blue-600 text-blue-600' : 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-ds-faint hover:text-ds-muted'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 border-b border-ds-border pb-0">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeFilter === tab.key
                ? 'border-blue-600 text-blue-600 bg-ds-info-bg'
                : 'border-transparent text-ds-faint hover:text-ds-muted hover:bg-ds-bg'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Director Evaluations of Employees */}
      {mainTab === 'directors' && (
        empLoading ? (
          <div className="page-loading-placeholder" aria-hidden="true" />
        ) : (
          <Card>
            <CardBody className="p-0">
              {combinedEmployeeEvals.length === 0 ? (
                <EmptyState
                  message={activeFilter === 'pending' ? 'لا توجد تقييمات بانتظار المراجعة' : 'لا توجد تقييمات'}
                  icon={<FileText className="h-12 w-12 text-ds-faint" />}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الموظف</TableHead>
                      <TableHead>الإدارة</TableHead>
                      <TableHead>المدير المقيّم</TableHead>
                      <TableHead>فترة التقييم</TableHead>
                      <TableHead>النتيجة</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {combinedEmployeeEvals.map(group => {
                      const ev = group.primary;
                      const isCombined = group.ids.length > 1;
                      return (
                      <TableRow key={group.groupKey}>
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
                          <span className={`text-sm ${isCombined ? 'font-semibold text-ds-info-text' : 'text-ds-muted'}`}>{group.manager_label}</span>
                        </TableCell>
                        <TableCell>
                          {ev.period && (
                            <span className="text-sm text-ds-muted">{monthLabels[ev.period.month]} {ev.period.year}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ds-text">{group.percentage?.toFixed(0)}%</span>
                            {group.general_rating && (
                              <Badge variant={getRatingVariant(group.general_rating)} size="sm">
                                {group.general_rating}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(group.status)} size="sm">{getStatusLabel(group.status)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => isCombined ? viewCombinedEmpDetail(group) : viewEmpDetail(ev)} className="flex items-center gap-1">
                              <Eye className="h-4 w-4" />
                              <span>عرض</span>
                            </Button>
                            {(group.status === 'بانتظار الموافقة' || group.status === 'تم الإرسال') && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(group.ids[0], 'employee')}
                                  loading={actionLoading}
                                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  <span>موافقة</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => openRejectModal(group.ids.join(','), 'employee')}
                                  className="flex items-center gap-1"
                                >
                                  <XCircle className="h-4 w-4" />
                                  <span>رفض</span>
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardBody>
          </Card>
        )
      )}

      {/* CEO Evaluations of Directors */}
      {mainTab === 'ceo' && (
        dirLoading ? (
          <div className="page-loading-placeholder" aria-hidden="true" />
        ) : (
          <Card>
            <CardBody className="p-0">
              {combinedDirectorEvals.length === 0 ? (
                <EmptyState
                  message={activeFilter === 'pending' ? 'لا توجد تقييمات بانتظار الاعتماد' : 'لا توجد تقييمات'}
                  icon={<Crown className="h-12 w-12 text-ds-faint" />}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>مدير الإدارة</TableHead>
                      <TableHead>المقيّمون</TableHead>
                      <TableHead>فترة التقييم</TableHead>
                      <TableHead>النتيجة المجمّعة</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الإجراءات</TableHead>
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
                          <Badge variant={getStatusVariant(combined.status)} size="sm">{getStatusLabel(combined.status)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => viewCombinedDirDetail(combined)} className="flex items-center gap-1">
                              <Eye className="h-4 w-4" />
                              <span>عرض</span>
                            </Button>
                            {combined.status === 'بانتظار الموافقة' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveCombined(combined)}
                                  loading={actionLoading}
                                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  <span>موافقة</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => openRejectCombinedModal(combined)}
                                  className="flex items-center gap-1"
                                >
                                  <XCircle className="h-4 w-4" />
                                  <span>رفض</span>
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardBody>
          </Card>
        )
      )}

      {/* Supervisor Evaluations */}
      {mainTab === 'supervisors' && (
        supLoading ? (
          <div className="page-loading-placeholder" aria-hidden="true" />
        ) : (
          <Card>
            <CardBody className="p-0">
              {supervisorEvals.length === 0 ? (
                <EmptyState
                  message={activeFilter === 'pending' ? 'لا توجد تقييمات بانتظار المراجعة' : 'لا توجد تقييمات'}
                  icon={<Shield className="h-12 w-12 text-ds-faint" />}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الموظف</TableHead>
                      <TableHead>المشرف</TableHead>
                      <TableHead>فترة التقييم</TableHead>
                      <TableHead>النتيجة</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supervisorEvals.map(ev => (
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
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => viewSupDetail(ev)} className="flex items-center gap-1">
                              <Eye className="h-4 w-4" />
                              <span>عرض</span>
                            </Button>
                            {ev.status === 'تم الإرسال' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(ev.id, 'supervisor')}
                                  loading={actionLoading}
                                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  <span>موافقة</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => openRejectModal(ev.id, 'supervisor')}
                                  className="flex items-center gap-1"
                                >
                                  <XCircle className="h-4 w-4" />
                                  <span>رفض</span>
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardBody>
          </Card>
        )
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={detailModal}
        onClose={() => { setDetailModal(false); setDetailEval(null); setDetailDirEval(null); setDetailSupEval(null); setDetailCombined(null); setDetailEmpCombined(null); setDetailUnderlyingEvals([]); setDetailPerEvalScores({}); setSelectedEvalTab('summary'); }}
        title={
          detailEval
            ? `تفاصيل تقييم: ${detailEval.employee?.full_name}`
            : detailDirEval
              ? `تفاصيل تقييم: ${detailDirEval.director?.full_name}`
              : detailCombined
                ? `تفاصيل تقييم مجمّع: ${detailCombined.director?.full_name}`
                : detailSupEval
                  ? `تفاصيل تقييم: ${detailSupEval.employee?.full_name}`
                  : 'تفاصيل التقييم'
        }
        size="lg"
      >
        {detailLoading ? (
          <div className="page-loading-placeholder" aria-hidden="true" />
        ) : (detailEval || detailDirEval || detailSupEval || detailCombined) ? (
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-ds-bg rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-ds-text text-lg">
                    {detailEval?.employee?.full_name || detailDirEval?.director?.full_name || detailCombined?.director?.full_name || detailSupEval?.employee?.full_name}
                  </p>
                  <p className="text-sm text-ds-muted">
                    {detailEval?.employee?.job_title || detailDirEval?.director?.job_title || detailCombined?.director?.job_title || detailSupEval?.employee?.job_title}
                  </p>
                  {detailCombined ? (
                    <div className="text-xs text-ds-faint mt-1">
                      {detailCombined.evals.map(ev => (
                        <p key={ev.id}>المقيّم: {ev.evaluator?.full_name} — {ev.percentage?.toFixed(0)}%</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-ds-faint mt-1">
                      المقيّم: {detailEval?.manager?.full_name || detailDirEval?.evaluator?.full_name || detailSupEval?.supervisor?.full_name}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-ds-faint">فترة التقييم</p>
                  <p className="font-medium text-ds-text">
                    {(() => {
                      const period = detailEval?.period || detailDirEval?.period || detailCombined?.period || detailSupEval?.period;
                      return period ? `${monthLabels[period.month]} ${period.year}` : '';
                    })()}
                  </p>
                  <Badge variant={getStatusVariant(currentDetailStatus)} size="sm" className="mt-1">
                    {getStatusLabel(currentDetailStatus)}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Per-evaluator tabs — visible only when a combined card has
                more than one evaluator. The CEO can drill into each
                evaluator's raw scores instead of only seeing the averaged
                Summary they're approving against. */}
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
                {detailUnderlyingEvals.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    role="tab"
                    aria-selected={selectedEvalTab === u.id}
                    className={`tab ${selectedEvalTab === u.id ? 'on' : ''}`}
                    onClick={() => setSelectedEvalTab(u.id)}
                  >
                    {underlyingEvalTabLabel(u, detailUnderlyingEvals)}
                  </button>
                ))}
              </div>
            )}

            {/* Final Results — Summary tab uses the combined averages;
                a per-evaluator tab swaps in that evaluator's own values. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-ds-info-bg rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 mb-1">النتيجة / 500</p>
                <p className="text-xl font-bold text-ds-info-text">
                  {(activeEval
                    ? activeEval.finalScore500
                    : (detailCombined ? detailCombined.avg_score_500 : (detailEval?.final_score_500 ?? detailDirEval?.final_score_500 ?? detailSupEval?.final_score_500))
                  )?.toFixed(1)}
                </p>
              </div>
              <div className="bg-ds-purple-bg rounded-lg p-3 text-center">
                <p className="text-xs text-purple-600 mb-1">النتيجة / 5</p>
                <p className="text-xl font-bold text-ds-purple-text">
                  {(activeEval
                    ? activeEval.finalScore5
                    : (detailCombined ? detailCombined.avg_score_5 : (detailEval?.final_score_5 ?? detailDirEval?.final_score_5 ?? detailSupEval?.final_score_5))
                  )?.toFixed(2)}
                </p>
              </div>
              <div className="bg-ds-info-bg rounded-lg p-3 text-center">
                <p className="text-xs text-teal-600 mb-1">النسبة المئوية</p>
                <p className="text-xl font-bold text-ds-info-text">
                  {(activeEval
                    ? activeEval.percentage
                    : (detailCombined ? detailCombined.avg_percentage : (detailEval?.percentage ?? detailDirEval?.percentage ?? detailSupEval?.percentage))
                  )?.toFixed(0)}%
                </p>
              </div>
              <div className="bg-ds-warning-bg rounded-lg p-3 text-center">
                <p className="text-xs text-amber-600 mb-1">التقدير العام</p>
                {(() => {
                  const rating = activeEval
                    ? activeEval.generalRating
                    : (detailCombined ? detailCombined.avg_rating : (detailEval?.general_rating || detailDirEval?.general_rating || detailSupEval?.general_rating));
                  return rating ? (
                    <Badge variant={getRatingVariant(rating)}>{rating}</Badge>
                  ) : (
                    <span className="text-ds-faint text-sm">-</span>
                  );
                })()}
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

            {/* Notes — when an evaluator tab is active, show only that
                evaluator's own note (hidden if empty); on Summary, keep
                the existing per-source breakdown. */}
            {activeEval ? (
              activeEval.evaluatorNote && (
                <div className="bg-ds-info-bg rounded-lg p-4">
                  <p className="text-xs font-medium text-ds-info-text mb-1">ملاحظات {activeEval.evaluatorName}</p>
                  <p className="text-sm text-ds-text">{activeEval.evaluatorNote}</p>
                </div>
              )
            ) : detailCombined ? (
              detailCombined.evals.some(ev => ev.evaluator_note) && (
                <div className="space-y-2">
                  {detailCombined.evals.filter(ev => ev.evaluator_note).map(ev => (
                    <div key={ev.id} className="bg-ds-info-bg rounded-lg p-4">
                      <p className="text-xs font-medium text-ds-info-text mb-1">ملاحظات {ev.evaluator?.full_name}</p>
                      <p className="text-sm text-ds-text">{ev.evaluator_note}</p>
                    </div>
                  ))}
                </div>
              )
            ) : detailEmpCombined && detailEmpCombined.notes.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-ds-info-text px-1">ملاحظات المقيّمين</p>
                {detailEmpCombined.notes.map((n, i) => (
                  <div key={i} className="bg-ds-info-bg rounded-lg p-4">
                    <p className="text-xs font-semibold text-ds-info-text mb-1">{n.name}</p>
                    <p className="text-sm text-ds-text">{n.note}</p>
                  </div>
                ))}
              </div>
            ) : (detailEval?.manager_note || detailDirEval?.evaluator_note || detailSupEval?.supervisor_note) ? (
              <div className="bg-ds-info-bg rounded-lg p-4">
                <p className="text-xs font-medium text-ds-info-text mb-1">ملاحظات المقيّم</p>
                <p className="text-sm text-ds-text">{detailEval?.manager_note || detailDirEval?.evaluator_note || detailSupEval?.supervisor_note}</p>
              </div>
            ) : null}

            {/* Reply from evaluated person */}
            {detailCombined ? (
              detailCombined.evals.some(ev => ev.director_note) && (
                <div className="bg-ds-info-bg rounded-lg p-4">
                  <p className="text-xs font-medium text-ds-info-text mb-1">رد المقيَّم على التقييم</p>
                  <p className="text-sm text-ds-text">{detailCombined.evals.find(ev => ev.director_note)?.director_note}</p>
                </div>
              )
            ) : (detailEval?.employee_note || detailDirEval?.director_note || detailSupEval?.employee_note) ? (
              <div className="bg-ds-info-bg rounded-lg p-4">
                <p className="text-xs font-medium text-ds-info-text mb-1">
                  {detailDirEval ? 'رد المقيَّم على التقييم' : 'رد الموظف على التقييم'}
                </p>
                <p className="text-sm text-ds-text">{detailEval?.employee_note || detailDirEval?.director_note || detailSupEval?.employee_note}</p>
              </div>
            ) : null}

            {/* Previous CEO Comment */}
            {detailCombined ? (
              detailCombined.evals.some(ev => ev.ceo_comment) && (
                <div className="bg-ds-danger-bg rounded-lg p-4">
                  <p className="text-xs font-medium text-ds-danger-text mb-1">سبب الرفض السابق</p>
                  <p className="text-sm text-ds-text">{detailCombined.evals.find(ev => ev.ceo_comment)?.ceo_comment}</p>
                </div>
              )
            ) : (detailEval?.ceo_comment || detailDirEval?.ceo_comment) ? (
              <div className="bg-ds-danger-bg rounded-lg p-4">
                <p className="text-xs font-medium text-ds-danger-text mb-1">سبب الرفض السابق</p>
                <p className="text-sm text-ds-text">{detailEval?.ceo_comment || detailDirEval?.ceo_comment}</p>
              </div>
            ) : null}

            {/* Action buttons inside modal */}
            {isPendingApproval && (
              <div className="flex gap-3 pt-4 border-t border-ds-border">
                <Button
                  onClick={() => detailCombined ? handleApproveCombined(detailCombined) : handleApprove(currentDetailId, currentDetailType)}
                  loading={actionLoading}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-5 w-5" />
                  <span>الموافقة على التقييم</span>
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setDetailModal(false);
                    if (detailCombined) {
                      openRejectCombinedModal(detailCombined);
                    } else if (detailEmpCombined) {
                      openRejectModal(detailEmpCombined.ids.join(','), 'employee');
                    } else {
                      openRejectModal(currentDetailId, currentDetailType);
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <XCircle className="h-5 w-5" />
                  <span>رفض التقييم</span>
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModal}
        onClose={() => { setRejectModal(false); setRejectEvaluators([]); }}
        title="رفض التقييم"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-ds-muted">
            يرجى كتابة سبب الرفض ليتمكن المقيّم من تعديل التقييم وإعادة إرساله.
          </p>

          {rejectEvaluators.length > 0 && (
            <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-4">
              <p className="text-sm font-bold text-ds-warning-text mb-1">اختر التقييم المراد رفضه</p>
              <p className="text-xs text-ds-warning-text mb-3">
                هذا التقييم مكوّن من تقييمي مديرين. اختر من تريد إعادة تقييمه — التقييم الآخر سيبقى كما هو.
              </p>
              <div className="space-y-2">
                {rejectEvaluators.map(ev => (
                  <label
                    key={ev.id}
                    className="flex items-center gap-3 bg-ds-surface border border-ds-warning-border rounded-lg px-3 py-2.5 cursor-pointer hover:border-ds-warning-border transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={ev.selected}
                      onChange={(e) => setRejectEvaluators(prev =>
                        prev.map(p => p.id === ev.id ? { ...p, selected: e.target.checked } : p)
                      )}
                      className="h-4 w-4 text-red-600 rounded border-ds-border focus:ring-red-500"
                    />
                    <span className="text-sm text-ds-text font-medium">{ev.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <TextArea
            label="سبب الرفض"
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            rows={4}
            placeholder="اكتب سبب رفض التقييم..."
            required
          />
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => { setRejectModal(false); setRejectEvaluators([]); }}>
              إلغاء
            </Button>
            <Button
              onClick={handleReject}
              loading={actionLoading}
              disabled={!rejectComment.trim() || (rejectEvaluators.length > 0 && !rejectEvaluators.some(e => e.selected))}
              className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
            >
              <XCircle className="h-4 w-4" />
              <span>تأكيد الرفض</span>
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
};
