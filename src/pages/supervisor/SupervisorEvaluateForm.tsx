import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { computeFinalScores } from '../../lib/scoring';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { TextArea } from '../../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Save, Send, User, AlertTriangle, Lock, ArrowRight, ClipboardEdit, Eye, Search, Users, FileCheck, FileClock, Calendar, Shield, Clock } from 'lucide-react';
import { FractionalScoreSelector } from '../../components/ui/FractionalScoreSelector';

interface EmployeeInfo {
  id: string;
  full_name: string;
  job_title: string;
  employee_number: string;
  department_id: string;
  department_name?: string;
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
  start_date: string;
  end_date: string;
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
  if (status === 'تم الإرسال') return 'تم التقييم';
  if (status === 'اطلع الموظف' || status === 'مغلق') return 'تم التقييم';
  return status;
};

const getEvalStatusVariant = (status: string | null | undefined): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
  if (!status || status === 'مسودة') return 'default';
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
    'تم الإرسال': 'success',
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
  const [evaluationStatus, setEvaluationStatus] = useState('');
  const [existingEvaluationId, setExistingEvaluationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [generalWeight, setGeneralWeight] = useState(50);
  const [specificWeight, setSpecificWeight] = useState(50);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [noAssignment, setNoAssignment] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Fetch active assignments with their members
  const fetchAssignments = useCallback(async () => {
    if (!user) return [];
    const { data } = await supabase
      .from('supervisor_assignments')
      .select('id, user_id, title, start_date, end_date, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .lte('start_date', today)
      .gte('end_date', today);

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
  }, [user, today]);

  // Filter periods to those within assignment date range
  const filterPeriodsForAssignments = useCallback((periods: EvaluationPeriod[], assignmentList: Assignment[]) => {
    if (assignmentList.length === 0) return [];
    return periods.filter(p => {
      // Check if the period's month/year falls within any assignment's date range
      const periodDate = new Date(p.year, p.month - 1, 1);
      const periodEndOfMonth = new Date(p.year, p.month, 0); // last day of month
      return assignmentList.some(a => {
        const startDate = new Date(a.start_date);
        const endDate = new Date(a.end_date);
        return periodEndOfMonth >= startDate && periodDate <= endDate;
      });
    });
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
        .select('id, full_name, job_title, employee_number, department_id, department:departments(name)')
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

      setAllEmployees((employees || []).map((e: any) => ({
        id: e.id,
        full_name: e.full_name,
        job_title: e.job_title,
        employee_number: e.employee_number,
        department_id: e.department_id,
        department_name: e.department?.name || '',
        eval_status: evalMap.get(e.id)?.status || null,
        eval_rating: evalMap.get(e.id)?.rating || null,
        eval_percentage: evalMap.get(e.id)?.percentage || null,
      })));
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
    const active = filteredPeriods.find((p: any) => p.status === 'نشطة') || null;
    setActivePeriod(active);
  }, [assignments, filterPeriodsForAssignments]);

  const fetchCriteria = useCallback(async () => {
    if (!employeeId) return;
    const emp = allEmployees.find(e => e.id === employeeId);
    const deptId = emp?.department_id;

    const [{ data: general }, { data: specific }] = await Promise.all([
      supabase.from('evaluation_criteria').select('*').eq('is_active', true).order('order'),
      deptId
        ? supabase.from('department_criteria').select('*')
            .eq('department_id', deptId)
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
  }, [employeeId, allEmployees]);

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
      .from('supervisor_evaluations')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('supervisor_id', user.id)
      .eq('period_id', activePeriod.id)
      .maybeSingle();

    if (evaluation) {
      setExistingEvaluationId(evaluation.id);
      setEvaluatorNotes(evaluation.supervisor_note || '');
      setEvaluationStatus(evaluation.status || '');

      const { data: evalScores } = await supabase
        .from('supervisor_evaluation_scores')
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
        alert('يرجى تقييم جميع المعايير قبل الإرسال');
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
        alert('لم يتم العثور على تعيين مشرف مطابق');
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
          department_criterion_id: criterion.id,
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
      alert(isDraft ? 'تم حفظ التقييم كمسودة بنجاح' : 'تم إرسال التقييم بنجاح');
    } catch (error) {
      console.error('Error saving supervisor evaluation:', error);
      alert('حدث خطأ أثناء حفظ التقييم');
    } finally {
      setLoading(false);
    }
  };

  const results = calculateResults();
  const scoredCount = criteria.filter(c => scores[c.id] && scores[c.id] > 0).length;
  const isReadOnly = evaluationStatus !== '' && evaluationStatus !== 'مسودة';

  if (employeesLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (noAssignment) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">التقييم كمشرف</h1>
          <p className="text-gray-600 mt-2">تقييم أعضاء الفريق المعين لك كمشرف</p>
        </div>
        <Card>
          <CardBody className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Shield className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-gray-700 text-lg font-medium">لا يوجد لديك تعيين مشرف نشط حالياً</p>
            <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto">
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

  // Table view when no employee selected
  const selectedTablePeriod = tablePeriods.find(p => p.id === tablePeriodId);
  const tablePeriodLabel = selectedTablePeriod
    ? `${monthLabels[selectedTablePeriod.month]} ${selectedTablePeriod.year}`
    : '';

  if (!employeeId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">التقييم كمشرف</h1>
            <p className="text-gray-600 mt-2">تقييم أعضاء الفريق المعين لك كمشرف</p>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
            <Calendar className="h-5 w-5 text-blue-600" />
            <select
              value={tablePeriodId}
              onChange={(e) => setTablePeriodId(e.target.value)}
              className="bg-transparent text-blue-800 font-semibold text-sm border-none focus:ring-0 cursor-pointer"
            >
              {tablePeriods.map(p => (
                <option key={p.id} value={p.id}>
                  {monthLabels[p.month]} {p.year} {p.status === 'نشطة' ? '(نشطة)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Assignment Info Banner */}
        <Card>
          <CardBody className="bg-indigo-50 border border-indigo-200">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-100 text-indigo-600 p-3 rounded-xl flex-shrink-0">
                <Shield className="h-6 w-6" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                <div>
                  <p className="text-xs text-indigo-500">التعيين</p>
                  <p className="font-semibold text-indigo-900">{assignmentTitle} ({totalAssignedMembers} موظف)</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-500">فترة التعيين</p>
                  <p className="font-semibold text-indigo-900">
                    {formatDate(assignmentStartDate)} — {formatDate(assignmentEndDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-indigo-500">المدة المتبقية</p>
                  <p className={`font-semibold flex items-center gap-1.5 ${remainingDays <= 7 ? 'text-amber-700' : 'text-indigo-900'}`}>
                    <Clock className="h-4 w-4" />
                    {remainingDays <= 0 ? 'منتهية الصلاحية' : `${remainingDays} يوم`}
                  </p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">إجمالي الأعضاء</p>
                  <p className="text-2xl font-bold text-gray-900">{allEmployees.length}</p>
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
                  <p className="text-sm text-gray-600 mb-1">تم تقييمهم</p>
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
                  <p className="text-sm text-gray-600 mb-1">بانتظار التقييم</p>
                  <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                </div>
                <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
                  <FileClock className="h-6 w-6" />
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="بحث بالاسم أو الرقم الوظيفي أو القسم..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                />
              </div>
            </div>

            {filteredEmployees.length === 0 ? (
              <EmptyState
                message={searchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد أعضاء فريق في الأقسام المعينة لك حاليًا'}
                icon={<Users className="h-12 w-12 text-gray-400" />}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الموظف</TableHead>
                    <TableHead>الرقم الوظيفي</TableHead>
                    <TableHead>المسمى الوظيفي</TableHead>
                    <TableHead>القسم</TableHead>
                    <TableHead>التقييم الحالي</TableHead>
                    <TableHead>الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                            {emp.full_name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">{emp.full_name}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-500 text-sm font-mono">{emp.employee_number || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-500 text-sm">{emp.job_title}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 text-sm">{emp.department_name}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {emp.eval_status && emp.eval_status !== 'مسودة' && emp.eval_rating ? (
                            <Badge variant={getRatingBadgeVariant(emp.eval_rating)} size="sm">
                              {emp.eval_rating}
                            </Badge>
                          ) : (
                            <Badge variant={getEvalStatusVariant(emp.eval_status)} size="sm">
                              {getEvalStatusLabel(emp.eval_status)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => setSelectedEmployeeId(emp.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            !emp.eval_status || emp.eval_status === 'مسودة'
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {!emp.eval_status || emp.eval_status === 'مسودة' ? (
                            <>
                              <ClipboardEdit className="h-4 w-4" />
                              <span>{emp.eval_status === 'مسودة' ? 'متابعة التقييم' : 'تقييم'}</span>
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4" />
                              <span>عرض التقييم</span>
                            </>
                          )}
                        </button>
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
          }}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ArrowRight className="h-5 w-5" />
          <span className="text-sm font-medium">العودة للقائمة</span>
        </button>
      </div>
      <div>
        <h1 className="text-3xl font-bold text-gray-900">التقييم كمشرف</h1>
        <p className="text-gray-600 mt-2">تقييم أعضاء الفريق المعين لك كمشرف</p>
      </div>

      {/* Period Selector */}
      <Card>
        <CardBody>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">فترة التقييم</label>
            <select
              value={activePeriod?.id || ''}
              onChange={(e) => {
                const p = allPeriods.find(pr => pr.id === e.target.value);
                if (p) {
                  setActivePeriod(p);
                  setGeneralWeight((p as any).general_weight ?? 50);
                  setSpecificWeight((p as any).specific_weight ?? 50);
                }
              }}
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {allPeriods.map(p => (
                <option key={p.id} value={p.id}>
                  {monthLabels[p.month]} {p.year} {p.status === 'نشطة' ? '(نشطة)' : `— ${p.status}`}
                </option>
              ))}
            </select>
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
            <p className="text-gray-500 text-lg">لا توجد فترة تقييم نشطة حالياً</p>
            <p className="text-gray-400 text-sm mt-2">يرجى التواصل مع مسؤول النظام لتفعيل فترة التقييم</p>
          </CardBody>
        </Card>
      )}

      {!dataLoading && activePeriod && <>
        {/* Submitted Notice */}
        {evaluationStatus === 'تم الإرسال' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <Lock className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-green-800">تم إرسال التقييم</p>
              <p className="text-xs text-green-600 mt-1">لا يمكن تعديل التقييم بعد الإرسال</p>
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
                  <div>
                    <p className="text-sm text-blue-600">اسم الموظف</p>
                    <p className="font-semibold text-blue-900">{employee.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">الرقم الوظيفي</p>
                    <p className="font-semibold text-blue-900">{employee.employee_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">القسم</p>
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
              <span className="text-sm text-gray-500">
                ({scoredCount}/{criteria.length} تم تقييمها)
              </span>
            </div>
            <div className="space-y-4">
              {criteria.map(criterion => (
                <Card key={criterion.id} className="border-blue-200">
                  <CardHeader className="bg-blue-50/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{criterion.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{criterion.description}</p>
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
                      <div className="mt-3 text-sm text-gray-600">
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
              <p className="text-gray-500">لا توجد معايير تقييم مفعّلة حالياً</p>
            </CardBody>
          </Card>
        )}

        {/* Specific Criteria Section */}
        {specificCriteria.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <h3 className="text-lg font-bold text-emerald-900">معايير التقييم الخاصة</h3>
              <span className="text-sm text-gray-500">
                ({specificCriteria.filter(c => specificScores[c.id] && specificScores[c.id] > 0).length}/{specificCriteria.length} تم تقييمها)
              </span>
            </div>
            <div className="space-y-4">
              {specificCriteria.map(criterion => (
                <Card key={criterion.id} className="border-emerald-200">
                  <CardHeader className="bg-emerald-50/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{criterion.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{criterion.description}</p>
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
                      <div className="mt-3 text-sm text-gray-600">
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
              <h2 className="text-lg font-semibold text-gray-900">النتيجة النهائية</h2>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">الدرجة من 500</p>
                  <p className="text-3xl font-bold text-blue-600">{results.finalScore500.toFixed(0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">التقييم من 5</p>
                  <p className="text-3xl font-bold text-blue-600">{results.finalScore5.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">النسبة المئوية</p>
                  <p className="text-3xl font-bold text-blue-600">{results.percentage.toFixed(1)}%</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">التقدير العام</p>
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
            <h2 className="text-lg font-semibold text-gray-900">ملاحظات المشرف</h2>
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
