import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { computeFinalScores } from '../../lib/scoring';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { TextArea } from '../../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Save, Send, User, AlertTriangle, Lock, ArrowRight, ClipboardEdit, Eye, Search, Users, FileCheck, FileClock, Calendar, Shield, Clock, MessageSquare } from 'lucide-react';
import { FractionalScoreSelector } from '../../components/ui/FractionalScoreSelector';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { ModernSelect } from '../../components/ui/ModernSelect';
import { StartEvaluationConfirmModal } from '../../components/ui/StartEvaluationConfirmModal';
import { useEmployeeLeaveStatus, formatLeaveChip } from '../../hooks/useEmployeeLeaveStatus';

interface EmployeeInfo {
  id: string;
  full_name: string;
  job_title: string;
  employee_number: string;
  department_id: string;
  department_name?: string;
  avatar_url?: string | null;
  eval_status?: string | null;
  eval_rating?: string | null;
  eval_percentage?: number | null;
}

interface AssignmentMember {
  employee_id: string;
}

interface Assignment {
  id: string;
  user_id: string;
  title: string | null;
  status: string;
  members?: AssignmentMember[];
}

interface Criterion {
  id: string;
  title: string;
  description: string;
  weight: number;
  order: number;
}

interface EvaluationPeriod {
  id: string;
  year: number;
  month: number;
  status: string;
  general_weight?: number;
  specific_weight?: number;
}

const monthLabels: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
};

const getEvalStatusLabel = (status: string | null | undefined): string => {
  if (!status || status === 'مسودة') return 'بانتظار التقييم';
  if (status === 'تم الإرسال') return 'تم الإرسال — بانتظار الاعتماد';
  if (status === 'مرفوض') return 'التقييم مرفوض — يجب إعادة الإرسال';
  if (status === 'موافقة' || status === 'اطلع الموظف' || status === 'مغلق') return 'التقييم معتمد';
  return status;
};

const getEvalStatusVariant = (status: string | null | undefined): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
  if (!status || status === 'مسودة') return 'default';
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
    'تم الإرسال': 'warning',
    'مرفوض': 'danger',
    'اطلع الموظف': 'success',
    'مغلق': 'success',
  };
  return map[status] || 'default';
};

const getRatingBadgeVariant = (rating: string | null | undefined): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
  if (!rating) return 'default';
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
    'ممتاز': 'success',
    'جيد جدًا': 'info',
    'جيد': 'warning',
    'يحتاج تحسين': 'danger',
  };
  return map[rating] || 'default';
};

export const SupervisorEvaluateForm: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [allEmployees, setAllEmployees] = useState<EmployeeInfo[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | undefined>(undefined);
  const employeeId = selectedEmployeeId;
  const [searchQuery, setSearchQuery] = useState('');
  const [tablePeriods, setTablePeriods] = useState<EvaluationPeriod[]>([]);
  const [tablePeriodId, setTablePeriodId] = useState<string>('');
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [specificCriteria, setSpecificCriteria] = useState<Criterion[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [specificScores, setSpecificScores] = useState<Record<string, number>>({});
  const [activePeriod, setActivePeriod] = useState<EvaluationPeriod | null>(null);
  const [allPeriods, setAllPeriods] = useState<EvaluationPeriod[]>([]);
  const [evaluatorNotes, setEvaluatorNotes] = useState('');
  const [employeeReply, setEmployeeReply] = useState('');
  const [evaluationStatus, setEvaluationStatus] = useState('');
  const [existingEvaluationId, setExistingEvaluationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [generalWeight, setGeneralWeight] = useState(50);
  const [specificWeight, setSpecificWeight] = useState(50);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [noAssignment, setNoAssignment] = useState(false);
  // Per-employee resolver: an employee can only be evaluated when their
  // group's ACTIVE specific-criteria weights sum exactly to the
  // specific-weight target (or specific_weight is 0 so general criteria
  // suffice). Half-filled groups (sum < target) and ungrouped employees
  // are NOT evaluable.
  const [specificWeightTarget, setSpecificWeightTarget] = useState(50);
  const [groupSpecificTarget, setGroupSpecificTarget] = useState<Record<string, number>>({});
  const [noSpecificNeeded, setNoSpecificNeeded] = useState(false);
  const [employeeGroupMembership, setEmployeeGroupMembership] = useState<Record<string, string>>({});
  const [groupCriteriaSum, setGroupCriteriaSum] = useState<Record<string, number>>({});
  // Confirmation modal: holds the employee the supervisor is about to
  // start evaluating. Null = no confirmation in flight.
  const [confirmEvalFor, setConfirmEvalFor] = useState<EmployeeInfo | null>(null);

  const targetForGroup = useCallback((groupId: string | undefined | null): number => {
    if (!groupId) return specificWeightTarget;
    return groupSpecificTarget[groupId] ?? specificWeightTarget;
  }, [groupSpecificTarget, specificWeightTarget]);

  const canEvaluateEmployee = useCallback((empId: string): boolean => {
    if (noSpecificNeeded) return true;
    const groupId = employeeGroupMembership[empId];
    if (!groupId) return false;
    const target = targetForGroup(groupId);
    if (target === 0) return true;
    return (groupCriteriaSum[groupId] || 0) >= target;
  }, [noSpecificNeeded, employeeGroupMembership, groupCriteriaSum, targetForGroup]);

  // Fetch active assignments with their members
  const fetchAssignments = useCallback(async () => {
    if (!user) return [];
    const { data } = await supabase
      .from('supervisor_assignments')
      .select('id, user_id, title, status')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (!data || data.length === 0) return [];

    // Fetch members for these assignments
    const assignmentIds = data.map(a => a.id);
    const { data: members } = await supabase
      .from('supervisor_assignment_members')
      .select('assignment_id, employee_id')
      .in('assignment_id', assignmentIds);

    const membersByAssignment = new Map<string, AssignmentMember[]>();
    (members || []).forEach((m: any) => {
      const list = membersByAssignment.get(m.assignment_id) || [];
      list.push({ employee_id: m.employee_id });
      membersByAssignment.set(m.assignment_id, list);
    });

    return data.map(a => ({
      ...a,
      members: membersByAssignment.get(a.id) || [],
    }));
  }, [user]);

  // Return all periods (no date filtering since assignments no longer have dates)
  const filterPeriodsForAssignments = useCallback((periods: EvaluationPeriod[], assignmentList: Assignment[]) => {
    if (assignmentList.length === 0) return [];
    return periods;
  }, []);

  // Fetch periods for table view
  useEffect(() => {
    const init = async () => {
      if (!user) return;

      const assignmentList = await fetchAssignments();
      setAssignments(assignmentList);

      if (assignmentList.length === 0) {
        setNoAssignment(true);
        setEmployeesLoading(false);
        return;
      }

      // Per-group criteria check: fetch every active criterion (with weight)
      // and every employee→group membership across the supervisor's
      // assignments. The table render uses this to disable the evaluate
      // button per-employee when their group's active weights don't sum
      // to the specific-weight target.
      const assignmentIds = assignmentList.map(a => a.id);
      const [{ data: supCriteria }, { data: members }, { data: weightSettings }, { data: supGroups }] = await Promise.all([
        supabase
          .from('supervisor_criteria')
          .select('group_id, weight')
          .in('assignment_id', assignmentIds)
          .eq('is_active', true)
          .not('group_id', 'is', null),
        supabase
          .from('supervisor_criteria_group_members')
          .select('group_id, employee_id')
          .in('assignment_id', assignmentIds),
        supabase
          .from('evaluation_settings')
          .select('specific_weight')
          .limit(1)
          .single(),
        supabase
          .from('supervisor_criteria_groups')
          .select('id, specific_weight')
          .in('assignment_id', assignmentIds),
      ]);
      const fallback = weightSettings?.specific_weight ?? 50;
      setSpecificWeightTarget(fallback);
      const targetMap: Record<string, number> = {};
      (supGroups || []).forEach((g: any) => { targetMap[g.id] = Number(g.specific_weight ?? fallback); });
      setGroupSpecificTarget(targetMap);
      const allZero = (supGroups || []).length > 0 && (supGroups || []).every((g: any) => Number(g.specific_weight ?? fallback) === 0);
      setNoSpecificNeeded(fallback === 0 || allZero);
      const sumMap: Record<string, number> = {};
      (supCriteria || []).forEach((r: any) => {
        if (!r.group_id) return;
        sumMap[r.group_id] = (sumMap[r.group_id] || 0) + Number(r.weight || 0);
      });
      setGroupCriteriaSum(sumMap);
      const memMap: Record<string, string> = {};
      (members || []).forEach((m: any) => { memMap[m.employee_id] = m.group_id; });
      setEmployeeGroupMembership(memMap);

      const { data: periods } = await supabase
        .from('evaluation_periods')
        .select('id, year, month, status')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      const filteredPeriods = filterPeriodsForAssignments(periods || [], assignmentList);
      setTablePeriods(filteredPeriods);
      const active = filteredPeriods.find(p => p.status === 'نشطة');
      if (active) setTablePeriodId(active.id);
      else if (filteredPeriods.length > 0) setTablePeriodId(filteredPeriods[0].id);
    };
    init();
  }, [user, fetchAssignments, filterPeriodsForAssignments]);

  // Fetch employees assigned to this supervisor via members table
  useEffect(() => {
    const fetchEmployees = async () => {
      if (!user || !tablePeriodId || assignments.length === 0) return;

      // Collect all employee IDs from all assignment members
      const memberEmployeeIds = assignments.flatMap(a => (a.members || []).map(m => m.employee_id));
      if (memberEmployeeIds.length === 0) {
        setAllEmployees([]);
        setEmployeesLoading(false);
        return;
      }

      const uniqueIds = [...new Set(memberEmployeeIds)];

      const { data: employees } = await supabase
        .from('employees')
        .select('id, full_name, job_title, employee_number, department_id, department:departments(name), user:users!employees_user_id_fkey(avatar_url)')
        .in('id', uniqueIds);

      // Fetch existing supervisor evals for selected period
      let evalMap = new Map<string, { status: string; rating: string | null; percentage: number | null }>();
      const { data: evals } = await supabase
        .from('supervisor_evaluations')
        .select('employee_id, status, general_rating, percentage')
        .eq('supervisor_id', user.id)
        .eq('period_id', tablePeriodId);

      if (evals) {
        evalMap = new Map(evals.map(ev => [ev.employee_id, {
          status: ev.status,
          rating: ev.general_rating,
          percentage: ev.percentage,
        }]));
      }

      setAllEmployees((employees || []).map((e: any) => {
        const userJoin = Array.isArray(e.user) ? e.user[0] : e.user;
        return {
          id: e.id,
          full_name: e.full_name,
          job_title: e.job_title,
          employee_number: e.employee_number,
          department_id: e.department_id,
          department_name: e.department?.name || '',
          avatar_url: userJoin?.avatar_url || null,
          eval_status: evalMap.get(e.id)?.status || null,
          eval_rating: evalMap.get(e.id)?.rating || null,
          eval_percentage: evalMap.get(e.id)?.percentage || null,
        };
      }));
      setEmployeesLoading(false);
    };
    fetchEmployees();
  }, [user, tablePeriodId, assignments]);

  const fetchEmployee = useCallback(async () => {
    if (!employeeId) return;
    const found = allEmployees.find(e => e.id === employeeId);
    if (found) {
      setEmployee(found);
      return;
    }
    const { data } = await supabase
      .from('employees')
      .select('id, full_name, job_title, employee_number, department_id, department:departments(name)')
      .eq('id', employeeId)
      .single();
    if (data) setEmployee({
      ...(data as any),
      department_name: (data as any).department?.name || '',
    });
  }, [employeeId, allEmployees]);

  const fetchActivePeriod = useCallback(async () => {
    const { data: periods } = await supabase
      .from('evaluation_periods')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    const filteredPeriods = filterPeriodsForAssignments(periods || [], assignments);
    setAllPeriods(filteredPeriods);
    // Honor the period the supervisor was viewing in the table when they
    // clicked "تقييم" — multiple periods can be active simultaneously
    // (one per month) and the table choice is the supervisor's intent.
    // Fall back to the most recent active period only when no table
    // selection is available.
    const fromTable = tablePeriodId
      ? filteredPeriods.find((p: any) => p.id === tablePeriodId)
      : null;
    const active = fromTable
      || filteredPeriods.find((p: any) => p.status === 'نشطة')
      || null;
    setActivePeriod(active);
  }, [assignments, filterPeriodsForAssignments, tablePeriodId]);

  const fetchCriteria = useCallback(async () => {
    if (!employeeId) return;

    // Find the assignment that includes this employee
    const assignment = assignments.find(a =>
      (a.members || []).some(m => m.employee_id === employeeId)
    );

    // Look up which criteria group (if any) this employee belongs to
    // within the assignment. Employees not in any group simply receive no
    // specific criteria — they're scored on general criteria only.
    let groupId: string | null = null;
    if (assignment) {
      const { data: membership } = await supabase
        .from('supervisor_criteria_group_members')
        .select('group_id')
        .eq('assignment_id', assignment.id)
        .eq('employee_id', employeeId)
        .maybeSingle();
      groupId = membership?.group_id || null;
    }

    const [{ data: general }, { data: specific }] = await Promise.all([
      // Use the golden (system-default) general criteria. Per-group custom
      // general criteria belong to directorate-criteria-groups and apply to
      // the director-evaluates-employee flow, not the supervisor flow.
      supabase.from('evaluation_criteria').select('*').is('group_id', null).eq('is_active', true).order('order'),
      groupId
        ? supabase.from('supervisor_criteria').select('*')
            .eq('group_id', groupId)
            .eq('is_active', true)
            .order('order')
        : Promise.resolve({ data: [] }),
    ]);
    setCriteria(general || []);
    setSpecificCriteria((specific || []).map((s: any) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      weight: s.weight,
      order: s.order,
    })));
  }, [employeeId, assignments]);

  // Per-scope weights: pull the supervisor-group weights that apply to THIS
  // employee. Falls through to the active period and finally 50/50 inside
  // the helper.
  const fetchSettings = useCallback(async () => {
    if (!employeeId) return;
    const { getSupervisorWeightsForEmployee } = await import('../../lib/weights');
    const w = await getSupervisorWeightsForEmployee(employeeId);
    setGeneralWeight(w.general);
    setSpecificWeight(w.specific);
  }, [employeeId]);

  const loadExistingEvaluation = useCallback(async () => {
    if (!employeeId || !user || !activePeriod) return;

    const { data: evaluation } = await supabase
      .from('supervisor_evaluations')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('supervisor_id', user.id)
      .eq('period_id', activePeriod.id)
      .maybeSingle();

    if (evaluation) {
      setExistingEvaluationId(evaluation.id);
      setEvaluatorNotes(evaluation.supervisor_note || '');
      setEmployeeReply(evaluation.employee_note || '');
      setEvaluationStatus(evaluation.status || '');

      const { data: evalScores } = await supabase
        .from('supervisor_evaluation_scores')
        .select('*')
        .eq('evaluation_id', evaluation.id);

      const scoresMap: Record<string, number> = {};
      const specScoresMap: Record<string, number> = {};
      evalScores?.forEach((score: any) => {
        if (score.criterion_type === 'specific' && score.supervisor_criterion_id) {
          specScoresMap[score.supervisor_criterion_id] = score.score_1_to_5;
        } else if (score.criterion_id) {
          scoresMap[score.criterion_id] = score.score_1_to_5;
        }
      });
      setScores(scoresMap);
      setSpecificScores(specScoresMap);
    }
  }, [employeeId, user, activePeriod]);

  useEffect(() => {
    if (user && employeeId) {
      setDataLoading(true);
      setScores({});
      setSpecificScores({});
      setEvaluatorNotes('');
      setEvaluationStatus('');
      setExistingEvaluationId(null);
      setEmployee(null);
      Promise.all([
        fetchEmployee(),
        fetchActivePeriod(),
        fetchCriteria(),
        fetchSettings(),
      ]).finally(() => setDataLoading(false));
    }
  }, [user, employeeId]);

  useEffect(() => {
    if (employeeId && activePeriod && user) {
      // Reset per-period form state BEFORE loading. loadExistingEvaluation
      // only writes when a matching evaluation exists, so without this
      // reset, scores/notes from the previous period would remain visible
      // when switching to a fresh (un-evaluated) period.
      setScores({});
      setSpecificScores({});
      setEvaluatorNotes('');
      setEmployeeReply('');
      setEvaluationStatus('');
      setExistingEvaluationId(null);
      loadExistingEvaluation();
    }
  }, [employeeId, activePeriod, user, loadExistingEvaluation]);

  const calculateResults = useCallback(() => {
    let generalRawTotal = 0;
    let generalMaxPossible = 0;
    criteria.forEach(criterion => {
      const score = scores[criterion.id] || 0;
      generalRawTotal += score * criterion.weight;
      generalMaxPossible += 5 * criterion.weight;
    });

    let specificRawTotal = 0;
    let specificMaxPossible = 0;
    specificCriteria.forEach(criterion => {
      const score = specificScores[criterion.id] || 0;
      specificRawTotal += score * criterion.weight;
      specificMaxPossible += 5 * criterion.weight;
    });

    const generalNorm = generalMaxPossible > 0 ? generalRawTotal / generalMaxPossible : 0;
    const specificNorm = specificMaxPossible > 0 ? specificRawTotal / specificMaxPossible : 0;

    const effectiveGeneralWeight = specificCriteria.length > 0 ? generalWeight : 100;
    const effectiveSpecificWeight = specificCriteria.length > 0 ? specificWeight : 0;

    const percentage = (generalNorm * effectiveGeneralWeight + specificNorm * effectiveSpecificWeight) / 100 * 100;

    const { finalScore5, finalScore500, generalRating } = computeFinalScores(percentage);
    return { finalScore500, finalScore5, percentage, generalRating };
  }, [criteria, specificCriteria, scores, specificScores, generalWeight, specificWeight]);

  const handleSubmit = async (isDraft: boolean) => {
    if (!employeeId || !user || !activePeriod) return;

    // Hard guard: block any attempt to score an employee whose group's
    // active criteria weights don't sum to the specific-weight target,
    // or who isn't in any group. Even for drafts — the supervisor must
    // complete group criteria before scoring members of that group.
    if (!noSpecificNeeded && !canEvaluateEmployee(employeeId)) {
      const groupId = employeeGroupMembership[employeeId];
      const sum = groupId ? (groupCriteriaSum[groupId] || 0) : 0;
      const target = targetForGroup(groupId);
      toast.error(!groupId
        ? 'لا يمكن تقييم هذا الموظف — لم يتم تصنيفه في أي مجموعة معايير. أضفه إلى مجموعة أولاً.'
        : `لا يمكن تقييم هذا الموظف — مجموع أوزان معايير مجموعته ${sum}% بدلاً من ${target}%. أكمل المعايير أولاً.`);
      return;
    }

    if (!isDraft) {
      const allGeneralScored = criteria.every(c => scores[c.id] && scores[c.id] > 0);
      const allSpecificScored = specificCriteria.every(c => specificScores[c.id] && specificScores[c.id] > 0);
      if (!allGeneralScored || !allSpecificScored) {
        toast.warning('يرجى تقييم جميع المعايير قبل الإرسال');
        return;
      }
    }

    setLoading(true);

    try {
      const results = calculateResults();

      // Find assignment that includes this employee as a member
      const assignment = assignments.find(a =>
        (a.members || []).some(m => m.employee_id === employeeId)
      );
      if (!assignment) {
        toast.warning('لم يتم العثور على تعيين مشرف مطابق');
        setLoading(false);
        return;
      }

      const evaluationData = {
        assignment_id: assignment.id,
        supervisor_id: user.id,
        employee_id: employeeId,
        period_id: activePeriod.id,
        status: isDraft ? 'مسودة' : 'تم الإرسال',
        final_score_500: results.finalScore500,
        final_score_5: results.finalScore5,
        percentage: results.percentage,
        general_rating: results.generalRating,
        supervisor_note: evaluatorNotes,
        submitted_at: isDraft ? null : new Date().toISOString(),
      };

      let evaluationId: string;

      if (existingEvaluationId) {
        await supabase
          .from('supervisor_evaluations')
          .update(evaluationData)
          .eq('id', existingEvaluationId);
        evaluationId = existingEvaluationId;
      } else {
        const { data: newEval } = await supabase
          .from('supervisor_evaluations')
          .insert(evaluationData)
          .select()
          .single();
        evaluationId = newEval!.id;
        setExistingEvaluationId(evaluationId);
      }

      // Delete old scores and insert new ones
      await supabase
        .from('supervisor_evaluation_scores')
        .delete()
        .eq('evaluation_id', evaluationId);

      const generalTotalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
      const generalScoreInserts = criteria
        .filter(c => scores[c.id] && scores[c.id] > 0)
        .map(criterion => ({
          evaluation_id: evaluationId,
          criterion_id: criterion.id,
          department_criterion_id: null,
          criterion_type: 'general',
          score_1_to_5: scores[criterion.id],
          weighted_result: generalTotalWeight > 0
            ? (scores[criterion.id] / 5) * criterion.weight * (500 / generalTotalWeight)
            : 0,
        }));

      const specificTotalWeight = specificCriteria.reduce((sum, c) => sum + c.weight, 0);
      const specificScoreInserts = specificCriteria
        .filter(c => specificScores[c.id] && specificScores[c.id] > 0)
        .map(criterion => ({
          evaluation_id: evaluationId,
          criterion_id: null,
          department_criterion_id: null,
          supervisor_criterion_id: criterion.id,
          criterion_type: 'specific',
          score_1_to_5: specificScores[criterion.id],
          weighted_result: specificTotalWeight > 0
            ? (specificScores[criterion.id] / 5) * criterion.weight * (500 / specificTotalWeight)
            : 0,
        }));

      const allScoreInserts = [...generalScoreInserts, ...specificScoreInserts];
      if (allScoreInserts.length > 0) {
        await supabase.from('supervisor_evaluation_scores').insert(allScoreInserts);
      }

      setEvaluationStatus(isDraft ? 'مسودة' : 'تم الإرسال');
      toast.success(isDraft ? 'تم حفظ التقييم كمسودة بنجاح' : 'تم إرسال التقييم بنجاح');
    } catch (error) {
      console.error('Error saving supervisor evaluation:', error);
      toast.error('حدث خطأ أثناء حفظ التقييم');
    } finally {
      setLoading(false);
    }
  };

  const results = calculateResults();
  const scoredCount = criteria.filter(c => scores[c.id] && scores[c.id] > 0).length;
  const isReadOnly = evaluationStatus !== '' && evaluationStatus !== 'مسودة' && evaluationStatus !== 'مرفوض';

  // Hooks must run on every render — keep this above the early returns below
  // so React doesn't crash with "Rendered more hooks than during the previous
  // render" the moment a loading flag flips.
  const selectedTablePeriod = tablePeriods.find(p => p.id === tablePeriodId);
  const tablePeriodIso = selectedTablePeriod
    ? `${selectedTablePeriod.year}-${String(selectedTablePeriod.month).padStart(2, '0')}-01`
    : null;
  const { isOnLeave } = useEmployeeLeaveStatus(tablePeriodIso);

  if (employeesLoading) {
    return (
      <div className="page-loading-placeholder" aria-hidden="true" />
    );
  }

  if (noAssignment) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-ds-text">التقييم كمشرف</h1>
          <p className="text-ds-muted mt-2">تقييم أعضاء الفريق المعين لك كمشرف</p>
        </div>
        <Card>
          <CardBody className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-ds-overlay flex items-center justify-center mx-auto mb-4">
              <Shield className="h-10 w-10 text-ds-faint" />
            </div>
            <p className="text-ds-muted text-lg font-medium">لا يوجد لديك تعيين مشرف نشط حالياً</p>
            <p className="text-ds-faint text-sm mt-2 max-w-md mx-auto">
              سيظهر فريقك هنا عند تعيينك كمشرف من قِبل إدارة الموارد البشرية
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const evaluatedCount = allEmployees.filter(e => e.eval_status && e.eval_status !== 'مسودة').length;
  const pendingCount = allEmployees.filter(e => !e.eval_status || e.eval_status === 'مسودة').length;
  const filteredEmployees = allEmployees.filter(e =>
    e.full_name.includes(searchQuery) ||
    (e.employee_number || '').includes(searchQuery) ||
    (e.department_name || '').includes(searchQuery) ||
    e.job_title.includes(searchQuery)
  );

  // Assignment info for banner
  const assignmentTitle = assignments.map(a => a.title).filter(Boolean).join('، ') || 'مشرف مؤقت';
  const totalAssignedMembers = assignments.reduce((sum, a) => sum + (a.members || []).length, 0);
  const assignmentStartDate = assignments.length > 0
    ? assignments.reduce((min, a) => a.start_date < min ? a.start_date : min, assignments[0].start_date)
    : '';
  const assignmentEndDate = assignments.length > 0
    ? assignments.reduce((max, a) => a.end_date > max ? a.end_date : max, assignments[0].end_date)
    : '';

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  };
  const getRemainingDays = (): number => {
    if (!assignmentEndDate) return 0;
    const end = new Date(assignmentEndDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };
  const remainingDays = getRemainingDays();

  // Table view when no employee selected (hook + tablePeriodIso already
  // computed above the early returns so the hook order stays stable).
  const tablePeriodLabel = selectedTablePeriod
    ? `${monthLabels[selectedTablePeriod.month]} ${selectedTablePeriod.year}`
    : '';

  if (!employeeId) {
    return (
      <div className="space-y-6">
        <div
          className="rounded-ds-xl p-8 flex items-center justify-between flex-wrap gap-4"
          style={{
            background: 'var(--sc-green-grad)',
            border: '1px solid var(--sc-green-border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-green-val)' }}>التقييم كمشرف</h1>
            <p className="mt-2" style={{ color: 'var(--sc-green-label)' }}>تقييم أعضاء الفريق المعين لك كمشرف</p>
          </div>
          <ModernSelect
            value={tablePeriodId}
            onChange={setTablePeriodId}
            icon={<Calendar className="h-4 w-4" />}
            ariaLabel="فترة التقييم"
            className="min-w-[220px]"
            options={tablePeriods.map(p => ({
              value: p.id,
              label: `${monthLabels[p.month]} ${p.year}`,
              hint: p.status === 'نشطة' ? 'نشطة' : undefined,
            }))}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ds-muted mb-1">إجمالي الأعضاء</p>
                  <p className="text-2xl font-bold text-ds-text">{allEmployees.length}</p>
                </div>
                <div className="bg-ds-info-bg text-ds-info p-3 rounded-xl">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ds-muted mb-1">تم تقييمهم</p>
                  <p className="text-2xl font-bold text-green-600">{evaluatedCount}</p>
                </div>
                <div className="bg-ds-success-bg text-ds-success p-3 rounded-xl">
                  <FileCheck className="h-6 w-6" />
                </div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ds-muted mb-1">بانتظار التقييم</p>
                  <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                </div>
                <div className="bg-ds-warning-bg text-ds-warning p-3 rounded-xl">
                  <FileClock className="h-6 w-6" />
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {!noSpecificNeeded && filteredEmployees.some(e => !canEvaluateEmployee(e.id)) && (
          <div className="bg-ds-warning-bg border border-ds-warning-border rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-ds-warning-text text-sm font-medium">بعض الموظفين لا يمكن تقييمهم — مجموعتهم لم تكتمل معاييرها الخاصة</p>
              <p className="text-amber-600 text-xs mt-0.5">يجب أن يكون مجموع أوزان المعايير النشطة في كل مجموعة مساوياً للنسبة الخاصة بها. انتقل إلى صفحة "معايير المشرف" لإكمالها.</p>
            </div>
          </div>
        )}

        <Card>
          <CardBody>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ds-faint" />
                <input
                  type="text"
                  placeholder="بحث بالاسم أو الرقم الوظيفي أو الإدارة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 border border-ds-border bg-ds-input text-ds-text placeholder:text-ds-faint rounded-lg focus:ring-2 focus:ring-ds-accent focus:border-ds-accent outline-none transition-colors text-sm"
                />
              </div>
            </div>

            {filteredEmployees.length === 0 ? (
              <EmptyState
                message={searchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد أعضاء فريق في الإدارات المعينة لك حاليًا'}
                icon={<Users className="h-12 w-12 text-ds-faint" />}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الموظف</TableHead>
                    <TableHead>الرقم الوظيفي</TableHead>
                    <TableHead>المسمى الوظيفي</TableHead>
                    <TableHead>الإدارة</TableHead>
                    <TableHead>حالة التقييم</TableHead>
                    <TableHead>الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => {
                    const leave = isOnLeave(emp.id);
                    return (
                    <TableRow key={emp.id} className={leave ? 'opacity-60 bg-ds-bg' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar name={emp.full_name} avatarUrl={emp.avatar_url} size="md" />
                          <div>
                            <span className="font-medium text-ds-text">{emp.full_name}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-ds-faint text-sm font-mono">{emp.employee_number || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-ds-faint text-sm">{emp.job_title}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-ds-muted text-sm">{emp.department_name}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {leave ? (
                            <Badge variant="warning" size="sm">في إجازة — {leave.type_name}</Badge>
                          ) : (
                            <Badge variant={getEvalStatusVariant(emp.eval_status)} size="sm">
                              {getEvalStatusLabel(emp.eval_status)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {leave ? (
                          <span className="text-xs text-ds-warning-text" title={formatLeaveChip(leave)}>
                            لا يمكن التقييم — {leave.type_name}
                          </span>
                        ) : (() => {
                          const isPeriodOpen = selectedTablePeriod?.status === 'نشطة';
                          const hasExisting = !!emp.eval_status && emp.eval_status !== 'مسودة';

                          if (!isPeriodOpen && !hasExisting) {
                            return <span className="text-xs text-ds-faint">لا توجد فترة نشطة</span>;
                          }

                          if (isPeriodOpen && (!emp.eval_status || emp.eval_status === 'مسودة') && !canEvaluateEmployee(emp.id)) {
                            const groupId = employeeGroupMembership[emp.id];
                            const sum = groupId ? (groupCriteriaSum[groupId] || 0) : 0;
                            const target = targetForGroup(groupId);
                            const reason = !groupId
                              ? 'هذا الموظف غير مُصنّف في أي مجموعة'
                              : `أكمل أوزان معايير المجموعة (${sum}% / ${target}%)`;
                            return (
                              <button
                                disabled
                                title={reason}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-ds-track text-ds-faint cursor-not-allowed"
                              >
                                <ClipboardEdit className="h-4 w-4" />
                                <span>بدء التقييم</span>
                              </button>
                            );
                          }

                          const canEvaluate = isPeriodOpen && (!emp.eval_status || emp.eval_status === 'مسودة');

                          return (
                            <button
                              onClick={() => canEvaluate ? setConfirmEvalFor(emp) : setSelectedEmployeeId(emp.id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                canEvaluate
                                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                                  : 'bg-ds-overlay text-ds-muted hover:bg-ds-overlay'
                              }`}
                            >
                              {canEvaluate ? (
                                <>
                                  <ClipboardEdit className="h-4 w-4" />
                                  <span>{emp.eval_status === 'مسودة' ? 'متابعة التقييم' : 'بدء التقييم'}</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="h-4 w-4" />
                                  <span>عرض التقييم</span>
                                </>
                              )}
                            </button>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>

        <StartEvaluationConfirmModal
          isOpen={!!confirmEvalFor}
          subjectName={confirmEvalFor?.full_name}
          title={confirmEvalFor?.eval_status === 'مسودة' ? 'متابعة التقييم' : 'بدء التقييم'}
          confirmLabel={confirmEvalFor?.eval_status === 'مسودة' ? 'متابعة' : 'بدء التقييم'}
          onCancel={() => setConfirmEvalFor(null)}
          onConfirm={() => {
            if (confirmEvalFor) setSelectedEmployeeId(confirmEvalFor.id);
            setConfirmEvalFor(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => {
            setSelectedEmployeeId(undefined);
            setScores({});
            setSpecificScores({});
            setEvaluatorNotes('');
            setEvaluationStatus('');
            setExistingEvaluationId(null);
            setEmployee(null);
          }}
          className="flex items-center gap-1 text-blue-600 hover:text-ds-info-text transition-colors"
        >
          <ArrowRight className="h-5 w-5" />
          <span className="text-sm font-medium">العودة للقائمة</span>
        </button>
      </div>
      <div>
        <h1 className="text-3xl font-bold text-ds-text">التقييم كمشرف</h1>
        <p className="text-ds-muted mt-2">تقييم أعضاء الفريق المعين لك كمشرف</p>
      </div>

      {/* Period Selector */}
      <Card>
        <CardBody>
          <div>
            <label className="block text-sm font-medium text-ds-muted mb-2">فترة التقييم</label>
            <div className="max-w-md">
              <ModernSelect
                value={activePeriod?.id || ''}
                onChange={(v) => {
                  const p = allPeriods.find(pr => pr.id === v);
                  if (p) {
                    setActivePeriod(p);
                    setGeneralWeight((p as any).general_weight ?? 50);
                    setSpecificWeight((p as any).specific_weight ?? 50);
                  }
                }}
                ariaLabel="فترة التقييم"
                options={allPeriods.map(p => ({
                  value: p.id,
                  label: `${monthLabels[p.month]} ${p.year}`,
                  hint: p.status === 'نشطة' ? 'نشطة' : p.status,
                }))}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {dataLoading && (
        <div className="page-loading-placeholder" aria-hidden="true" />
      )}

      {!dataLoading && !activePeriod && (
        <Card>
          <CardBody className="text-center py-16">
            <AlertTriangle className="h-16 w-16 text-amber-400 mx-auto mb-4" />
            <p className="text-ds-faint text-lg">لا توجد فترة تقييم نشطة حالياً</p>
            <p className="text-ds-faint text-sm mt-2">يرجى التواصل مع مسؤول النظام لتفعيل فترة التقييم</p>
          </CardBody>
        </Card>
      )}

      {!dataLoading && activePeriod && <>
        {/* Submitted Notice */}
        {evaluationStatus === 'تم الإرسال' && (
          <div className="bg-ds-success-bg border border-ds-success-border rounded-lg p-4 flex items-start gap-3">
            <Lock className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-ds-success-text">تم إرسال التقييم</p>
              <p className="text-xs text-green-600 mt-1">لا يمكن تعديل التقييم بعد الإرسال</p>
            </div>
          </div>
        )}

        {/* Employee Info */}
        {employee && (
          <Card>
            <CardBody className="bg-ds-info-bg">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-200 rounded-full flex items-center justify-center">
                  <User className="h-7 w-7 text-ds-info-text" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
                  <div>
                    <p className="text-sm text-blue-600">اسم الموظف</p>
                    <p className="font-semibold text-ds-info-text">{employee.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">الرقم الوظيفي</p>
                    <p className="font-semibold text-ds-info-text">{employee.employee_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">الإدارة</p>
                    <p className="font-semibold text-ds-info-text">{employee.department_name || employee.job_title}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">فترة التقييم</p>
                    <p className="font-semibold text-ds-info-text">
                      {monthLabels[activePeriod.month]} - {activePeriod.year}
                    </p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* General Criteria Section */}
        {criteria.length > 0 ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <h3 className="text-lg font-bold text-ds-info-text">معايير التقييم العامة</h3>
              <span className="text-sm text-ds-faint">
                ({scoredCount}/{criteria.length} تم تقييمها)
              </span>
            </div>
            <div className="space-y-4">
              {criteria.map(criterion => (
                <Card key={criterion.id} className="border-ds-info-border">
                  <CardHeader className="bg-ds-info-bg/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-ds-text">{criterion.title}</h3>
                        <p className="text-sm text-ds-muted mt-1">{criterion.description}</p>
                      </div>
                      <Badge variant="primary" size="sm">
                        الوزن: {criterion.weight}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <FractionalScoreSelector
                      value={scores[criterion.id] || 0}
                      onChange={(val) => setScores({ ...scores, [criterion.id]: val })}
                      color="blue"
                      disabled={isReadOnly}
                    />
                    {scores[criterion.id] && (
                      <div className="mt-3 text-sm text-ds-muted">
                        <p>
                          الدرجة: <span className="font-semibold text-blue-600">{scores[criterion.id]}</span> / 5
                          {' — '}
                          المرجحة: <span className="font-semibold text-blue-600">
                            {((scores[criterion.id] / 5) * criterion.weight).toFixed(1)}
                          </span> من {criterion.weight.toFixed(1)}
                        </p>
                      </div>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <Card>
            <CardBody className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-3" />
              <p className="text-ds-faint">لا توجد معايير تقييم مفعّلة حالياً</p>
            </CardBody>
          </Card>
        )}

        {/* Specific Criteria Section */}
        {specificCriteria.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <h3 className="text-lg font-bold text-ds-success-text">معايير التقييم الخاصة</h3>
              <span className="text-sm text-ds-faint">
                ({specificCriteria.filter(c => specificScores[c.id] && specificScores[c.id] > 0).length}/{specificCriteria.length} تم تقييمها)
              </span>
            </div>
            <div className="space-y-4">
              {specificCriteria.map(criterion => (
                <Card key={criterion.id} className="border-ds-success-border">
                  <CardHeader className="bg-ds-success-bg/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-ds-text">{criterion.title}</h3>
                        <p className="text-sm text-ds-muted mt-1">{criterion.description}</p>
                      </div>
                      <Badge variant="success" size="sm">
                        الوزن: {criterion.weight}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <FractionalScoreSelector
                      value={specificScores[criterion.id] || 0}
                      onChange={(val) => setSpecificScores({ ...specificScores, [criterion.id]: val })}
                      color="emerald"
                      disabled={isReadOnly}
                    />
                    {specificScores[criterion.id] && (
                      <div className="mt-3 text-sm text-ds-muted">
                        <p>
                          الدرجة: <span className="font-semibold text-emerald-600">{specificScores[criterion.id]}</span> / 5
                          {' — '}
                          المرجحة: <span className="font-semibold text-emerald-600">
                            {((specificScores[criterion.id] / 5) * criterion.weight).toFixed(1)}
                          </span> من {criterion.weight.toFixed(1)}
                        </p>
                      </div>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Final Score Card */}
        {(criteria.length > 0 || specificCriteria.length > 0) && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-ds-text">النتيجة النهائية</h2>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <p className="text-sm text-ds-muted mb-1">الدرجة من 500</p>
                  <p className="text-3xl font-bold text-blue-600">{results.finalScore500.toFixed(0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-ds-muted mb-1">التقييم من 5</p>
                  <p className="text-3xl font-bold text-blue-600">{results.finalScore5.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-ds-muted mb-1">النسبة المئوية</p>
                  <p className="text-3xl font-bold text-blue-600">{results.percentage.toFixed(1)}%</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-ds-muted mb-1">التقدير العام</p>
                  <Badge
                    variant={results.percentage >= 90 ? 'success' : results.percentage >= 75 ? 'info' : 'warning'}
                    size="lg"
                  >
                    {results.generalRating}
                  </Badge>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Supervisor Notes */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-ds-text">ملاحظات المشرف</h2>
          </CardHeader>
          <CardBody>
            <TextArea
              value={evaluatorNotes}
              onChange={(e) => setEvaluatorNotes(e.target.value)}
              rows={4}
              placeholder="اكتب ملاحظاتك حول أداء الموظف..."
              disabled={isReadOnly}
            />
          </CardBody>
        </Card>

        {/* Employee Reply */}
        {isReadOnly && employeeReply && (
          <Card className="border-ds-info-border">
            <CardHeader className="bg-ds-info-bg">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-teal-600" />
                <h2 className="text-lg font-semibold text-ds-info-text">رد الموظف على التقييم</h2>
              </div>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-ds-text leading-relaxed">{employeeReply}</p>
            </CardBody>
          </Card>
        )}

        {/* Action Buttons */}
        {!isReadOnly && (
          <div className="flex gap-3">
            <Button
              onClick={() => handleSubmit(true)}
              variant="secondary"
              loading={loading}
              className="flex items-center gap-2"
            >
              <span>حفظ كمسودة</span>
              <Save className="h-5 w-5" />
            </Button>
            <Button
              onClick={() => handleSubmit(false)}
              loading={loading}
              className="flex items-center gap-2"
            >
              <span>إرسال التقييم</span>
              <Send className="h-5 w-5" />
            </Button>
          </div>
        )}
      </>}
    </div>
  );
};
