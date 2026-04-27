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
import { Save, Send, User, AlertTriangle, Lock, MessageSquare, ArrowRight, ClipboardEdit, Eye, Search, Users, FileCheck, FileClock, Calendar } from 'lucide-react';
import { FractionalScoreSelector } from '../../components/ui/FractionalScoreSelector';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { ModernSelect } from '../../components/ui/ModernSelect';

interface EmployeeInfo {
  id: string;           // employees table id
  user_id: string;
  full_name: string;
  job_title: string;
  email: string;
  department_id: string | null;
  directorate_id?: string | null;
  department_name?: string;
  employee_number?: string;
  avatar_url?: string | null;
  eval_status?: string | null;
  eval_rating?: string | null;
  eval_percentage?: number | null;
  peer_name?: string | null;
  peer_status?: string | null;
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
}

const monthLabels: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
};

const getEvalStatusLabel = (
  status: string | null | undefined,
  peerName?: string | null,
  peerStatus?: string | null,
): string => {
  if (!status || status === 'مسودة') return 'بانتظار التقييم';
  if (status === 'تم الإرسال') {
    // Co-director directorate: my eval is in, but peer hasn't submitted →
    // show "بانتظار <peer name>"; once both submit, show "بانتظار الاعتماد".
    if (peerName) {
      const peerSubmitted = peerStatus && peerStatus !== 'مسودة';
      if (!peerSubmitted) return `بانتظار ${peerName}`;
    }
    return 'بانتظار الاعتماد';
  }
  if (status === 'بانتظار الموافقة') return 'بانتظار الاعتماد';
  if (status === 'موافقة' || status === 'اطلع الموظف' || status === 'مغلق') return 'التقييم معتمد';
  if (status === 'مرفوض') return 'التقييم مرفوض — يجب إعادة الإرسال';
  return status;
};

const getEvalStatusVariant = (status: string | null | undefined): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
  if (!status || status === 'مسودة') return 'default';
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
    'تم الإرسال': 'info',
    'بانتظار الموافقة': 'warning',
    'موافقة': 'success',
    'اطلع الموظف': 'success',
    'مغلق': 'success',
    'مرفوض': 'danger',
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

export const DirectorEvaluateEmployee: React.FC<{ employeeId?: string }> = ({ employeeId: propEmployeeId }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [allEmployees, setAllEmployees] = useState<EmployeeInfo[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | undefined>(propEmployeeId);
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
  const [evaluationStatus, setEvaluationStatus] = useState('');
  const [existingEvaluationId, setExistingEvaluationId] = useState<string | null>(null);
  const [ceoComment, setCeoComment] = useState('');
  const [employeeReply, setEmployeeReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [generalWeight, setGeneralWeight] = useState(50);
  const [specificWeight, setSpecificWeight] = useState(50);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [hasSpecificCriteria, setHasSpecificCriteria] = useState(true);
  const [myDirectorates, setMyDirectorates] = useState<{ id: string; name: string }[]>([]);
  const [selectedDirectorateId, setSelectedDirectorateId] = useState<string>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  // Check if director has specific criteria (skip if general weight is 100%)
  useEffect(() => {
    const checkCriteria = async () => {
      if (!user) return;
      // Count criteria across every directorate the user manages —
      // criteria are now per-directorate, shared between co-directors.
      const { data: dirs } = await supabase
        .from('directorates')
        .select('id')
        .or(`director_id.eq.${user.id},secondary_director_id.eq.${user.id}`);
      const dirIds = (dirs || []).map((d: any) => d.id);

      const [{ count }, { data: weightSettings }] = await Promise.all([
        dirIds.length === 0
          ? Promise.resolve({ count: 0 })
          : supabase
              .from('department_criteria')
              .select('id', { count: 'exact', head: true })
              .is('department_id', null)
              .in('directorate_id', dirIds)
              .eq('is_active', true),
        supabase
          .from('evaluation_settings')
          .select('specific_weight')
          .limit(1)
          .single(),
      ]);
      const noSpecificNeeded = weightSettings?.specific_weight === 0;
      setHasSpecificCriteria(noSpecificNeeded || (count ?? 0) > 0);
    };
    checkCriteria();
  }, [user]);

  // Fetch periods for table view
  useEffect(() => {
    const fetchPeriods = async () => {
      const { data: periods } = await supabase
        .from('evaluation_periods')
        .select('id, year, month, status')
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      setTablePeriods(periods || []);
      const active = (periods || []).find(p => p.status === 'نشطة');
      if (active) setTablePeriodId(active.id);
      else if (periods && periods.length > 0) setTablePeriodId(periods[0].id);
    };
    fetchPeriods();
  }, []);

  // Fetch employees under ALL of this director's directorates
  useEffect(() => {
    const fetchAllEmployees = async () => {
      if (!user || !tablePeriodId) return;

      const { data: dirs } = await supabase
        .from('directorates')
        .select('id, name, director_id, secondary_director_id, director:users!directorates_director_id_fkey(full_name), secondary_director:users!directorates_secondary_director_id_fkey(full_name)')
        .or(`director_id.eq.${user.id},secondary_director_id.eq.${user.id}`);

      if (!dirs || dirs.length === 0) {
        setEmployeesLoading(false);
        return;
      }

      setMyDirectorates(dirs.map((d: any) => ({ id: d.id, name: d.name })));
      const dirIds = dirs.map((d: any) => d.id);
      const dirNameMap = new Map(dirs.map((d: any) => [d.id, d.name]));
      // Per-directorate: who is my peer (the *other* director, if any)?
      const dirPeerMap = new Map<string, { id: string; name: string } | null>();
      dirs.forEach((d: any) => {
        let peerId: string | null = null;
        let peerName = '';
        if (d.director_id === user.id) {
          peerId = d.secondary_director_id || null;
          peerName = d.secondary_director?.full_name || '';
        } else {
          peerId = d.director_id || null;
          peerName = d.director?.full_name || '';
        }
        dirPeerMap.set(d.id, peerId ? { id: peerId, name: peerName } : null);
      });

      // Find employees assigned to ALL directorates (via junction table + legacy)
      const { data: assignmentData } = await supabase
        .from('employee_directorates')
        .select('employee_id, directorate_id, department_id')
        .in('directorate_id', dirIds);

      const empDirMap = new Map<string, { directorate_id: string; department_id: string | null }>();
      (assignmentData || []).forEach((a: any) => {
        if (!empDirMap.has(a.employee_id)) {
          empDirMap.set(a.employee_id, { directorate_id: a.directorate_id, department_id: a.department_id || null });
        }
      });

      const { data: legacyEmps } = await supabase
        .from('employees')
        .select('id, directorate_id, department_id')
        .in('directorate_id', dirIds);

      (legacyEmps || []).forEach((e: any) => {
        if (!empDirMap.has(e.id) && e.directorate_id) {
          empDirMap.set(e.id, { directorate_id: e.directorate_id, department_id: e.department_id || null });
        }
      });

      const allEmpIds = [...empDirMap.keys()];

      if (allEmpIds.length === 0) {
        setEmployeesLoading(false);
        return;
      }

      // Exclude employees who have an active supervisor — they are evaluated by their supervisor, not director
      const { data: activeAssignments } = await supabase
        .from('supervisor_assignments')
        .select('id')
        .eq('status', 'active');

      const supervisedIds = new Set<string>();
      if (activeAssignments && activeAssignments.length > 0) {
        const assignmentIds = activeAssignments.map(a => a.id);
        const { data: members } = await supabase
          .from('supervisor_assignment_members')
          .select('employee_id')
          .in('assignment_id', assignmentIds);
        (members || []).forEach((m: any) => supervisedIds.add(m.employee_id));
      }
      const unsupervisedIds = allEmpIds.filter(id => !supervisedIds.has(id));

      if (unsupervisedIds.length === 0) {
        setAllEmployees([]);
        setEmployeesLoading(false);
        return;
      }

      const { data: employees } = await supabase
        .from('employees')
        .select('id, user_id, full_name, email, job_title, employee_number, directorate_id, department_id, user:users!employees_user_id_fkey(avatar_url)')
        .in('id', unsupervisedIds)
        .order('full_name');

      if (!employees || employees.length === 0) {
        setEmployeesLoading(false);
        return;
      }

      // Get eval statuses for the period — both mine AND any peer director's
      const empIds = employees.map(e => e.id);
      const { data: allEvals } = await supabase
        .from('evaluations')
        .select('employee_id, manager_id, status, general_rating, percentage')
        .eq('period_id', tablePeriodId)
        .in('employee_id', empIds);

      const myEvalMap = new Map<string, { status: string; rating: string | null; percentage: number | null }>();
      const peerEvalMap = new Map<string, { status: string; manager_id: string }>();
      (allEvals || []).forEach((ev: any) => {
        if (ev.manager_id === user.id) {
          myEvalMap.set(ev.employee_id, {
            status: ev.status,
            rating: ev.general_rating,
            percentage: ev.percentage,
          });
        } else {
          peerEvalMap.set(ev.employee_id, { status: ev.status, manager_id: ev.manager_id });
        }
      });

      setAllEmployees(employees.map((e: any) => {
        const assign = empDirMap.get(e.id);
        const dId = assign?.directorate_id || e.directorate_id;
        const deptId = assign?.department_id || e.department_id || null;
        const peer = dId ? dirPeerMap.get(dId) : null;
        const peerEval = peerEvalMap.get(e.id);
        const userJoin = Array.isArray(e.user) ? e.user[0] : e.user;
        return {
          ...e,
          avatar_url: userJoin?.avatar_url || null,
          directorate_id: dId,
          department_id: deptId,
          department_name: dId ? (dirNameMap.get(dId) || '') : '',
          eval_status: myEvalMap.get(e.id)?.status || null,
          eval_rating: myEvalMap.get(e.id)?.rating || null,
          eval_percentage: myEvalMap.get(e.id)?.percentage || null,
          peer_name: peer?.name || null,
          peer_status: peer && peerEval && peerEval.manager_id === peer.id ? peerEval.status : null,
        };
      }));
      setEmployeesLoading(false);
    };
    fetchAllEmployees();
  }, [user, tablePeriodId, refreshKey]);

  useEffect(() => {
    if (propEmployeeId) setSelectedEmployeeId(propEmployeeId);
  }, [propEmployeeId]);

  const fetchEmployee = useCallback(async () => {
    if (!employeeId) return;
    const found = allEmployees.find(e => e.id === employeeId);
    if (found) {
      setEmployee(found);
      return;
    }
    const { data } = await supabase
      .from('employees')
      .select('id, user_id, full_name, email, job_title, department_id, directorate_id, employee_number')
      .eq('id', employeeId)
      .single();
    if (data) setEmployee({ ...data, department_name: '' });
  }, [employeeId, allEmployees]);

  const fetchActivePeriod = useCallback(async () => {
    const { data: periods } = await supabase
      .from('evaluation_periods')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    setAllPeriods(periods || []);
    const active = (periods || []).find((p: any) => p.status === 'نشطة') || null;
    setActivePeriod(active);
  }, []);

  const fetchCriteria = useCallback(async () => {
    if (!user) return;
    // Multi-department directorates: criteria scoped per the employee's department.
    // Single-department / no-department directorates: directorate-level list.
    const empRef = employee || allEmployees.find(e => e.id === employeeId);
    const employeeDirectorateId = empRef?.directorate_id || null;
    const employeeDepartmentId = empRef?.department_id || null;

    let specificQuery: any = null;
    if (employeeDirectorateId) {
      const { count } = await supabase
        .from('departments')
        .select('id', { count: 'exact', head: true })
        .eq('directorate_id', employeeDirectorateId)
        .eq('status', 'active');
      const deptCount = count || 0;
      if (deptCount >= 2 && employeeDepartmentId) {
        specificQuery = supabase.from('department_criteria').select('*')
          .eq('department_id', employeeDepartmentId)
          .eq('is_active', true)
          .order('order');
      } else if (deptCount <= 1) {
        specificQuery = supabase.from('department_criteria').select('*')
          .is('department_id', null)
          .eq('directorate_id', employeeDirectorateId)
          .eq('is_active', true)
          .order('order');
      }
    }

    const [{ data: general }, { data: specific }] = await Promise.all([
      supabase.from('evaluation_criteria').select('*').eq('is_active', true).order('order'),
      specificQuery
        ? specificQuery
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
  }, [user, employee, allEmployees, employeeId]);

  const fetchSettings = useCallback(async () => {
    const { data: period } = await supabase
      .from('evaluation_periods')
      .select('general_weight, specific_weight')
      .eq('status', 'نشطة')
      .maybeSingle();
    if (period) {
      setGeneralWeight(period.general_weight);
      setSpecificWeight(period.specific_weight);
    } else {
      const { data: settings } = await supabase
        .from('evaluation_settings')
        .select('*')
        .limit(1)
        .single();
      if (settings) {
        setGeneralWeight(settings.general_weight);
        setSpecificWeight(settings.specific_weight);
      }
    }
  }, []);

  const loadExistingEvaluation = useCallback(async () => {
    if (!employeeId || !user || !activePeriod) return;

    const { data: evaluation } = await supabase
      .from('evaluations')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('manager_id', user.id)
      .eq('period_id', activePeriod.id)
      .maybeSingle();

    if (evaluation) {
      setExistingEvaluationId(evaluation.id);
      setEvaluatorNotes(evaluation.manager_note || '');
      setEvaluationStatus(evaluation.status || '');
      setCeoComment(evaluation.ceo_comment || '');
      setEmployeeReply(evaluation.employee_note || '');

      const { data: evalScores } = await supabase
        .from('evaluation_scores')
        .select('*')
        .eq('evaluation_id', evaluation.id);

      const scoresMap: Record<string, number> = {};
      const specScoresMap: Record<string, number> = {};
      evalScores?.forEach((score: any) => {
        if (score.criterion_type === 'specific' && score.department_criterion_id) {
          specScoresMap[score.department_criterion_id] = score.score_1_to_5;
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
      // Fetch employee first so fetchCriteria knows the directorate_id.
      (async () => {
        await fetchEmployee();
        await Promise.all([
          fetchActivePeriod(),
          fetchCriteria(),
          fetchSettings(),
        ]);
      })().finally(() => setDataLoading(false));
    }
  }, [user, employeeId]);

  useEffect(() => {
    if (employeeId && activePeriod && user) {
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

      const evaluationData = {
        employee_id: employeeId,
        manager_id: user.id,
        department_id: employee?.department_id || null,
        period_id: activePeriod.id,
        status: isDraft ? 'مسودة' : 'تم الإرسال',
        final_score_500: results.finalScore500,
        final_score_5: results.finalScore5,
        percentage: results.percentage,
        general_rating: results.generalRating,
        manager_note: evaluatorNotes,
        submitted_at: isDraft ? null : new Date().toISOString(),
      };

      let evaluationId: string;

      if (existingEvaluationId) {
        const { error: updErr } = await supabase
          .from('evaluations')
          .update(evaluationData)
          .eq('id', existingEvaluationId);
        if (updErr) throw new Error(`update evaluations: ${updErr.message}`);
        evaluationId = existingEvaluationId;
      } else {
        const { data: newEval, error: insErr } = await supabase
          .from('evaluations')
          .insert(evaluationData)
          .select()
          .single();
        if (insErr || !newEval) throw new Error(`insert evaluations: ${insErr?.message || 'no row returned (RLS?)'}`);
        evaluationId = newEval.id;
        setExistingEvaluationId(evaluationId);
      }

      // Delete old scores and insert new ones
      const { error: delErr } = await supabase
        .from('evaluation_scores')
        .delete()
        .eq('evaluation_id', evaluationId);
      if (delErr) throw new Error(`delete evaluation_scores: ${delErr.message}`);

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
          department_criterion_id: criterion.id,
          criterion_type: 'specific',
          score_1_to_5: specificScores[criterion.id],
          weighted_result: specificTotalWeight > 0
            ? (specificScores[criterion.id] / 5) * criterion.weight * (500 / specificTotalWeight)
            : 0,
        }));

      const allScoreInserts = [...generalScoreInserts, ...specificScoreInserts];
      if (allScoreInserts.length > 0) {
        const { error: scoresErr } = await supabase.from('evaluation_scores').insert(allScoreInserts);
        if (scoresErr) throw new Error(`insert evaluation_scores: ${scoresErr.message}`);
      }

      setEvaluationStatus(isDraft ? 'مسودة' : 'بانتظار الموافقة');
      toast.success(isDraft ? 'تم حفظ التقييم كمسودة بنجاح' : 'تم إرسال التقييم بنجاح');
    } catch (error: any) {
      console.error('Error saving employee evaluation:', error);
      const detail = error?.message ? `\nالتفاصيل: ${error.message}` : '';
      toast.error(`حدث خطأ أثناء حفظ التقييم${detail}`);
    } finally {
      setLoading(false);
    }
  };

  const results = calculateResults();
  const scoredCount = criteria.filter(c => scores[c.id] && scores[c.id] > 0).length;
  const isReadOnly = evaluationStatus !== '' && evaluationStatus !== 'مسودة' && evaluationStatus !== 'مرفوض';

  if (employeesLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const dirFilteredEmployees = selectedDirectorateId === 'all'
    ? allEmployees
    : allEmployees.filter(e => e.department_name === myDirectorates.find(d => d.id === selectedDirectorateId)?.name);

  const evaluatedCount = dirFilteredEmployees.filter(e => e.eval_status && e.eval_status !== 'مسودة').length;
  const pendingCount = dirFilteredEmployees.filter(e => !e.eval_status || e.eval_status === 'مسودة').length;

  const filteredEmployees = dirFilteredEmployees.filter(e =>
    e.full_name.includes(searchQuery) ||
    e.email.includes(searchQuery) ||
    (e.department_name || '').includes(searchQuery) ||
    e.job_title.includes(searchQuery)
  );

  // Table view when no employee selected
  const selectedTablePeriod = tablePeriods.find(p => p.id === tablePeriodId);
  const tablePeriodLabel = selectedTablePeriod
    ? `${monthLabels[selectedTablePeriod.month]} ${selectedTablePeriod.year}`
    : '';

  if (!employeeId) {
    return (
      <div className="space-y-6">
        <div
          className="rounded-ds-xl p-8 flex items-center justify-between flex-wrap gap-4"
          style={{
            background: 'var(--sc-blue-grad)',
            border: '1px solid var(--sc-blue-border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-blue-val)' }}>موظفو الإدارات</h1>
            <p className="mt-2" style={{ color: 'var(--sc-blue-label)' }}>عرض وتقييم الموظفين التابعين لإداراتك</p>
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
                  <p className="text-sm text-ds-muted mb-1">إجمالي الموظفين</p>
                  <p className="text-2xl font-bold text-ds-text">{dirFilteredEmployees.length}</p>
                </div>
                <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
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
                <div className="bg-green-50 text-green-600 p-3 rounded-xl">
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
                <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
                  <FileClock className="h-6 w-6" />
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {!hasSpecificCriteria && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">يجب إضافة المعايير الخاصة أولاً قبل البدء بتقييم الموظفين. اذهب إلى صفحة "المعايير الخاصة" لإضافتها.</p>
          </div>
        )}

        <Card>
          <CardBody>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ds-faint" />
                <input
                  type="text"
                  placeholder="بحث بالاسم أو البريد أو الإدارة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 border border-ds-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                />
              </div>
              {myDirectorates.length > 1 && (
                <ModernSelect
                  value={selectedDirectorateId}
                  onChange={setSelectedDirectorateId}
                  ariaLabel="تصفية الإدارة"
                  className="min-w-[200px]"
                  options={[
                    { value: 'all', label: 'جميع الإدارات' },
                    ...myDirectorates.map(d => ({ value: d.id, label: d.name })),
                  ]}
                />
              )}
            </div>

            {filteredEmployees.length === 0 ? (
              <EmptyState
                message={searchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد موظفون تابعون لإدارتك حاليًا'}
                icon={<Users className="h-12 w-12 text-ds-faint" />}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الموظف</TableHead>
                    <TableHead>الرقم الوظيفي</TableHead>
                    <TableHead>البريد الإلكتروني</TableHead>
                    <TableHead>الإدارة</TableHead>
                    <TableHead>حالة التقييم</TableHead>
                    <TableHead>الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar name={emp.full_name} avatarUrl={emp.avatar_url} size="md" />
                          <div>
                            <span className="font-medium text-ds-text">{emp.full_name}</span>
                            {emp.job_title && (
                              <p className="text-xs text-ds-faint">{emp.job_title}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-ds-faint text-sm font-mono">{emp.employee_number || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-ds-faint text-sm">{emp.email}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-ds-muted text-sm">{emp.department_name}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={getEvalStatusVariant(emp.eval_status)} size="sm">
                            {getEvalStatusLabel(emp.eval_status, emp.peer_name, emp.peer_status)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const isPeriodOpen = selectedTablePeriod?.status === 'نشطة';
                          const hasExisting = !!emp.eval_status && emp.eval_status !== 'مسودة';

                          if (!isPeriodOpen && !hasExisting) {
                            return <span className="text-xs text-ds-faint">لا توجد فترة نشطة</span>;
                          }

                          if (isPeriodOpen && (!emp.eval_status || emp.eval_status === 'مسودة') && !hasSpecificCriteria) {
                            return (
                              <div className="text-center">
                                <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-200 text-ds-faint cursor-not-allowed">
                                  <ClipboardEdit className="h-4 w-4" />
                                  <span>تقييم</span>
                                </button>
                                <p className="text-[10px] text-red-500 mt-1">أضف المعايير الخاصة أولاً</p>
                              </div>
                            );
                          }

                          const canEvaluate = isPeriodOpen && (!emp.eval_status || emp.eval_status === 'مسودة' || emp.eval_status === 'مرفوض');

                          return (
                            <button
                              onClick={() => setSelectedEmployeeId(emp.id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                canEvaluate
                                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                                  : 'bg-ds-overlay text-ds-muted hover:bg-ds-overlay'
                              }`}
                            >
                              {canEvaluate ? (
                                <>
                                  <ClipboardEdit className="h-4 w-4" />
                                  <span>{emp.eval_status === 'مسودة' ? 'متابعة التقييم' : emp.eval_status === 'مرفوض' ? 'إعادة التقييم' : 'تقييم'}</span>
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
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
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
            setRefreshKey(k => k + 1);
          }}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ArrowRight className="h-5 w-5" />
          <span className="text-sm font-medium">العودة للقائمة</span>
        </button>
      </div>
      <div>
        <h1 className="text-3xl font-bold text-ds-text">تقييم الموظف</h1>
        <p className="text-ds-muted mt-2">تقييم أداء الموظف للفترة الحالية</p>
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
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
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
        {/* Rejection Comment */}
        {evaluationStatus === 'مرفوض' && ceoComment && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-800 mb-1">تم رفض التقييم</p>
              <p className="text-sm text-red-700">{ceoComment}</p>
              <p className="text-xs text-red-500 mt-2">يمكنك تعديل التقييم وإعادة إرساله</p>
            </div>
          </div>
        )}

        {/* Pending Approval Notice */}
        {evaluationStatus === 'بانتظار الموافقة' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <Lock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800">التقييم بانتظار الاعتماد</p>
              <p className="text-xs text-amber-600 mt-1">لا يمكن تعديل التقييم حتى تتم المراجعة</p>
            </div>
          </div>
        )}

        {/* Approved Notice */}
        {evaluationStatus === 'موافقة' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <Lock className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-green-800">تم اعتماد التقييم</p>
            </div>
          </div>
        )}

        {/* Employee Info */}
        {employee && (
          <Card>
            <CardBody className="bg-blue-50">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-200 rounded-full flex items-center justify-center">
                  <User className="h-7 w-7 text-blue-700" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                  <div>
                    <p className="text-sm text-blue-600">اسم الموظف</p>
                    <p className="font-semibold text-blue-900">{employee.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">الإدارة</p>
                    <p className="font-semibold text-blue-900">{employee.department_name || employee.job_title}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">فترة التقييم</p>
                    <p className="font-semibold text-blue-900">
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
              <h3 className="text-lg font-bold text-blue-900">معايير التقييم العامة</h3>
              <span className="text-sm text-ds-faint">
                ({scoredCount}/{criteria.length} تم تقييمها)
              </span>
            </div>
            <div className="space-y-4">
              {criteria.map(criterion => (
                <Card key={criterion.id} className="border-blue-200">
                  <CardHeader className="bg-blue-50/50">
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
              <h3 className="text-lg font-bold text-emerald-900">معايير التقييم الخاصة</h3>
              <span className="text-sm text-ds-faint">
                ({specificCriteria.filter(c => specificScores[c.id] && specificScores[c.id] > 0).length}/{specificCriteria.length} تم تقييمها)
              </span>
            </div>
            <div className="space-y-4">
              {specificCriteria.map(criterion => (
                <Card key={criterion.id} className="border-emerald-200">
                  <CardHeader className="bg-emerald-50/50">
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

        {/* Evaluator Notes */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-ds-text">ملاحظات المقيّم</h2>
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
        {employeeReply && (
          <Card>
            <CardBody className="bg-teal-50 border-teal-100">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-teal-600" />
                <h2 className="text-sm font-bold text-teal-800">رد الموظف على التقييم</h2>
              </div>
              <p className="text-ds-text leading-relaxed">{employeeReply}</p>
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
              <span>{evaluationStatus === 'مرفوض' ? 'إعادة إرسال التقييم' : 'إرسال التقييم'}</span>
              <Send className="h-5 w-5" />
            </Button>
          </div>
        )}
      </>}
    </div>
  );
};
