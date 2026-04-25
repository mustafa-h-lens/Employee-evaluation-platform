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
  }, [evaluations]);

  // Detail modal
  const [detailModal, setDetailModal] = useState(false);
  const [detailEval, setDetailEval] = useState<EvalItem | null>(null);
  const [detailDirEval, setDetailDirEval] = useState<DirectorEvalItem | null>(null);
  const [detailScores, setDetailScores] = useState<ScoreDetail[]>([]);
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
        id, employee_id, period_id, status, final_score_500, final_score_5, percentage, general_rating,
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

    setDetailScores(scoreDetails);
    setDetailLoading(false);
  };

  // Open the combined "الإدارة العليا" view for an employee that two
  // co-directors evaluated. Averages criterion scores across all underlying
  // rows and lists each director's note separately.
  const viewCombinedEmpDetail = async (group: CombinedEmployeeEval) => {
    setDetailLoading(true);
    setDetailModal(true);
    setDetailDirEval(null);

    // Pull every underlying eval row in full so we have manager names + notes
    const { data: fullRows } = await supabase
      .from('evaluations')
      .select(`
        id, status, final_score_500, final_score_5, percentage, general_rating,
        manager_note, employee_note, ceo_comment, submitted_at,
        employee:employees(full_name, job_title, employee_number),
        manager:users!evaluations_manager_id_fkey(full_name),
        department:departments(name),
        period:evaluation_periods(year, month)
      `)
      .in('id', group.ids);

    const rows = (fullRows as unknown as EvalItem[]) || [];
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

    // Average criterion scores across all underlying eval rows
    const { data: scores } = await supabase
      .from('evaluation_scores')
      .select(`
        score_1_to_5, weighted_result, criterion_type,
        criterion_id, department_criterion_id,
        criterion:evaluation_criteria(title, description, weight),
        dept_criterion:department_criteria(title, description, weight)
      `)
      .in('evaluation_id', group.ids);

    const groupsByCrit = new Map<string, any[]>();
    (scores || []).forEach((s: any) => {
      const key = `${s.criterion_type}:${s.criterion_id || s.department_criterion_id}`;
      if (!groupsByCrit.has(key)) groupsByCrit.set(key, []);
      groupsByCrit.get(key)!.push(s);
    });
    const scoreDetails: ScoreDetail[] = Array.from(groupsByCrit.values()).map(items => {
      const first = items[0];
      const avg = (k: string) => items.reduce((sum, x) => sum + (x[k] || 0), 0) / items.length;
      return {
        criterion_title: first.criterion_type === 'specific' ? (first.dept_criterion?.title || '') : (first.criterion?.title || ''),
        criterion_description: first.criterion_type === 'specific' ? (first.dept_criterion?.description || '') : (first.criterion?.description || ''),
        criterion_weight: first.criterion_type === 'specific' ? (first.dept_criterion?.weight || 0) : (first.criterion?.weight || 0),
        score: avg('score_1_to_5'),
        weighted_result: avg('weighted_result'),
        type: first.criterion_type || 'general',
      };
    });

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
    setRejectModal(true);
  };

  const handleReject = async () => {
    if (!user || !rejectTarget || !rejectComment.trim()) return;
    setActionLoading(true);

    const table = rejectTarget.type === 'employee' ? 'evaluations' : rejectTarget.type === 'director' ? 'director_evaluations' : 'supervisor_evaluations';

    // For director type, the id may be comma-separated (combined rejection)
    const ids = rejectTarget.id.split(',');
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

    // Fetch scores for all evals in this combined group
    const allIds = combined.evals.map(e => e.id);
    const { data: scores } = await supabase
      .from('director_evaluation_scores')
      .select(`
        evaluation_id, score_1_to_5, weighted_result, criterion_type,
        criterion:evaluation_criteria(title, description, weight),
        dept_criterion:department_criteria(title, description, weight)
      `)
      .in('evaluation_id', allIds);

    // Average scores by criterion
    const criterionMap = new Map<string, { totalScore: number; totalWeighted: number; count: number; title: string; desc: string; weight: number; type: string }>();
    (scores || []).forEach((s: any) => {
      const title = s.criterion_type === 'specific' ? (s.dept_criterion?.title || '') : (s.criterion?.title || '');
      const desc = s.criterion_type === 'specific' ? (s.dept_criterion?.description || '') : (s.criterion?.description || '');
      const weight = s.criterion_type === 'specific' ? (s.dept_criterion?.weight || 0) : (s.criterion?.weight || 0);
      const key = `${s.criterion_type}_${title}`;
      if (!criterionMap.has(key)) criterionMap.set(key, { totalScore: 0, totalWeighted: 0, count: 0, title, desc, weight, type: s.criterion_type });
      const entry = criterionMap.get(key)!;
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

  const generalScores = detailScores.filter(s => s.type === 'general');
  const specificScores = detailScores.filter(s => s.type === 'specific');

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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">اعتمادية التقييمات</h1>
        <p className="text-gray-600 mt-2">مراجعة واعتماد جميع التقييمات</p>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 border-b border-gray-200">
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
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeFilter === tab.key
                ? 'border-blue-600 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
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
          <div className="flex items-center justify-center h-48">
            <div className="text-gray-500">جاري التحميل...</div>
          </div>
        ) : (
          <Card>
            <CardBody className="p-0">
              {combinedEmployeeEvals.length === 0 ? (
                <EmptyState
                  message={activeFilter === 'pending' ? 'لا توجد تقييمات بانتظار المراجعة' : 'لا توجد تقييمات'}
                  icon={<FileText className="h-12 w-12 text-gray-400" />}
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
                            <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                              {ev.employee?.full_name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <span className="font-medium text-gray-900">{ev.employee?.full_name}</span>
                              <p className="text-xs text-gray-500">{ev.employee?.job_title}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-700">{ev.department?.name || '-'}</span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm ${isCombined ? 'font-semibold text-indigo-700' : 'text-gray-700'}`}>{group.manager_label}</span>
                        </TableCell>
                        <TableCell>
                          {ev.period && (
                            <span className="text-sm text-gray-700">{monthLabels[ev.period.month]} {ev.period.year}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{group.percentage?.toFixed(0)}%</span>
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
          <div className="flex items-center justify-center h-48">
            <div className="text-gray-500">جاري التحميل...</div>
          </div>
        ) : (
          <Card>
            <CardBody className="p-0">
              {combinedDirectorEvals.length === 0 ? (
                <EmptyState
                  message={activeFilter === 'pending' ? 'لا توجد تقييمات بانتظار الاعتماد' : 'لا توجد تقييمات'}
                  icon={<Crown className="h-12 w-12 text-gray-400" />}
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
                            <div className="w-9 h-9 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                              {combined.director?.full_name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <span className="font-medium text-gray-900">{combined.director?.full_name}</span>
                              <p className="text-xs text-gray-500">{combined.director?.job_title}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            {combined.evals.map(ev => (
                              <span key={ev.id} className="text-sm text-gray-700">{ev.evaluator?.full_name} ({ev.percentage?.toFixed(0)}%)</span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {combined.period && (
                            <span className="text-sm text-gray-700">{monthLabels[combined.period.month]} {combined.period.year}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{combined.avg_percentage?.toFixed(0)}%</span>
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
          <div className="flex items-center justify-center h-48">
            <div className="text-gray-500">جاري التحميل...</div>
          </div>
        ) : (
          <Card>
            <CardBody className="p-0">
              {supervisorEvals.length === 0 ? (
                <EmptyState
                  message={activeFilter === 'pending' ? 'لا توجد تقييمات بانتظار المراجعة' : 'لا توجد تقييمات'}
                  icon={<Shield className="h-12 w-12 text-gray-400" />}
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
                            <div className="w-9 h-9 bg-green-100 text-green-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                              {ev.employee?.full_name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <span className="font-medium text-gray-900">{ev.employee?.full_name}</span>
                              <p className="text-xs text-gray-500">{ev.employee?.job_title}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-700">{ev.supervisor?.full_name || '-'}</span>
                        </TableCell>
                        <TableCell>
                          {ev.period && (
                            <span className="text-sm text-gray-700">{monthLabels[ev.period.month]} {ev.period.year}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{ev.percentage?.toFixed(0)}%</span>
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
        onClose={() => { setDetailModal(false); setDetailEval(null); setDetailDirEval(null); setDetailSupEval(null); setDetailCombined(null); setDetailEmpCombined(null); }}
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
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">جاري التحميل...</div>
          </div>
        ) : (detailEval || detailDirEval || detailSupEval || detailCombined) ? (
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900 text-lg">
                    {detailEval?.employee?.full_name || detailDirEval?.director?.full_name || detailCombined?.director?.full_name || detailSupEval?.employee?.full_name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {detailEval?.employee?.job_title || detailDirEval?.director?.job_title || detailCombined?.director?.job_title || detailSupEval?.employee?.job_title}
                  </p>
                  {detailCombined ? (
                    <div className="text-xs text-gray-500 mt-1">
                      {detailCombined.evals.map(ev => (
                        <p key={ev.id}>المقيّم: {ev.evaluator?.full_name} — {ev.percentage?.toFixed(0)}%</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      المقيّم: {detailEval?.manager?.full_name || detailDirEval?.evaluator?.full_name || detailSupEval?.supervisor?.full_name}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">فترة التقييم</p>
                  <p className="font-medium text-gray-900">
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

            {/* Final Results */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 mb-1">النتيجة / 500</p>
                <p className="text-xl font-bold text-blue-700">
                  {(detailCombined ? detailCombined.avg_score_500 : (detailEval?.final_score_500 ?? detailDirEval?.final_score_500 ?? detailSupEval?.final_score_500))?.toFixed(1)}
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <p className="text-xs text-purple-600 mb-1">النتيجة / 5</p>
                <p className="text-xl font-bold text-purple-700">
                  {(detailCombined ? detailCombined.avg_score_5 : (detailEval?.final_score_5 ?? detailDirEval?.final_score_5 ?? detailSupEval?.final_score_5))?.toFixed(2)}
                </p>
              </div>
              <div className="bg-teal-50 rounded-lg p-3 text-center">
                <p className="text-xs text-teal-600 mb-1">النسبة المئوية</p>
                <p className="text-xl font-bold text-teal-700">
                  {(detailCombined ? detailCombined.avg_percentage : (detailEval?.percentage ?? detailDirEval?.percentage ?? detailSupEval?.percentage))?.toFixed(0)}%
                </p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-xs text-amber-600 mb-1">التقدير العام</p>
                {(() => {
                  const rating = detailCombined ? detailCombined.avg_rating : (detailEval?.general_rating || detailDirEval?.general_rating || detailSupEval?.general_rating);
                  return rating ? (
                    <Badge variant={getRatingVariant(rating)}>{rating}</Badge>
                  ) : (
                    <span className="text-gray-400 text-sm">-</span>
                  );
                })()}
              </div>
            </div>

            {/* General Criteria */}
            {generalScores.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-blue-700 mb-2 flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  المعايير العامة
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-blue-50">
                      <tr>
                        <th className="px-4 py-2 text-right text-xs font-medium text-blue-700">المعيار</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-blue-700">الوزن</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-blue-700">الدرجة</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-blue-700">النتيجة الموزونة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {generalScores.map((s, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2">
                            <p className="font-medium text-gray-900">{s.criterion_title}</p>
                            <p className="text-xs text-gray-500">{s.criterion_description}</p>
                          </td>
                          <td className="px-4 py-2 text-gray-700">{s.criterion_weight}%</td>
                          <td className="px-4 py-2 font-bold text-gray-900">{s.score}/5</td>
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
                <h3 className="text-sm font-bold text-emerald-700 mb-2 flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  المعايير الخاصة
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-emerald-50">
                      <tr>
                        <th className="px-4 py-2 text-right text-xs font-medium text-emerald-700">المعيار</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-emerald-700">الوزن</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-emerald-700">الدرجة</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-emerald-700">النتيجة الموزونة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {specificScores.map((s, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2">
                            <p className="font-medium text-gray-900">{s.criterion_title}</p>
                            <p className="text-xs text-gray-500">{s.criterion_description}</p>
                          </td>
                          <td className="px-4 py-2 text-gray-700">{s.criterion_weight}%</td>
                          <td className="px-4 py-2 font-bold text-gray-900">{s.score}/5</td>
                          <td className="px-4 py-2 font-bold text-emerald-600">{s.weighted_result?.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes */}
            {detailCombined ? (
              detailCombined.evals.some(ev => ev.evaluator_note) && (
                <div className="space-y-2">
                  {detailCombined.evals.filter(ev => ev.evaluator_note).map(ev => (
                    <div key={ev.id} className="bg-blue-50 rounded-lg p-4">
                      <p className="text-xs font-medium text-blue-700 mb-1">ملاحظات {ev.evaluator?.full_name}</p>
                      <p className="text-sm text-gray-800">{ev.evaluator_note}</p>
                    </div>
                  ))}
                </div>
              )
            ) : detailEmpCombined && detailEmpCombined.notes.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-blue-700 px-1">ملاحظات المقيّمين</p>
                {detailEmpCombined.notes.map((n, i) => (
                  <div key={i} className="bg-blue-50 rounded-lg p-4">
                    <p className="text-xs font-semibold text-blue-700 mb-1">{n.name}</p>
                    <p className="text-sm text-gray-800">{n.note}</p>
                  </div>
                ))}
              </div>
            ) : (detailEval?.manager_note || detailDirEval?.evaluator_note || detailSupEval?.supervisor_note) ? (
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs font-medium text-blue-700 mb-1">ملاحظات المقيّم</p>
                <p className="text-sm text-gray-800">{detailEval?.manager_note || detailDirEval?.evaluator_note || detailSupEval?.supervisor_note}</p>
              </div>
            ) : null}

            {/* Reply from evaluated person */}
            {detailCombined ? (
              detailCombined.evals.some(ev => ev.director_note) && (
                <div className="bg-teal-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-teal-700 mb-1">رد المقيَّم على التقييم</p>
                  <p className="text-sm text-gray-800">{detailCombined.evals.find(ev => ev.director_note)?.director_note}</p>
                </div>
              )
            ) : (detailEval?.employee_note || detailDirEval?.director_note || detailSupEval?.employee_note) ? (
              <div className="bg-teal-50 rounded-lg p-4">
                <p className="text-xs font-medium text-teal-700 mb-1">
                  {detailDirEval ? 'رد المقيَّم على التقييم' : 'رد الموظف على التقييم'}
                </p>
                <p className="text-sm text-gray-800">{detailEval?.employee_note || detailDirEval?.director_note || detailSupEval?.employee_note}</p>
              </div>
            ) : null}

            {/* Previous CEO Comment */}
            {detailCombined ? (
              detailCombined.evals.some(ev => ev.ceo_comment) && (
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-red-700 mb-1">سبب الرفض السابق</p>
                  <p className="text-sm text-gray-800">{detailCombined.evals.find(ev => ev.ceo_comment)?.ceo_comment}</p>
                </div>
              )
            ) : (detailEval?.ceo_comment || detailDirEval?.ceo_comment) ? (
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-xs font-medium text-red-700 mb-1">سبب الرفض السابق</p>
                <p className="text-sm text-gray-800">{detailEval?.ceo_comment || detailDirEval?.ceo_comment}</p>
              </div>
            ) : null}

            {/* Action buttons inside modal */}
            {isPendingApproval && (
              <div className="flex gap-3 pt-4 border-t border-gray-200">
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
        onClose={() => setRejectModal(false)}
        title="رفض التقييم"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            يرجى كتابة سبب الرفض ليتمكن المقيّم من تعديل التقييم وإعادة إرساله.
          </p>
          <TextArea
            label="سبب الرفض"
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            rows={4}
            placeholder="اكتب سبب رفض التقييم..."
            required
          />
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setRejectModal(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleReject}
              loading={actionLoading}
              disabled={!rejectComment.trim()}
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
