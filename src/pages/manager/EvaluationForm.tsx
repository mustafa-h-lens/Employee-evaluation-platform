import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { computeFinalScores } from '../../lib/scoring';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TextArea } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody as TBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Save, Send, Plus, Trash2, MessageSquare, ClipboardList, Calendar, Users, AlertCircle, ArrowRight, ClipboardEdit, Eye, Search, FileCheck, FileClock } from 'lucide-react';
import { FractionalScoreSelector } from '../../components/ui/FractionalScoreSelector';

const monthLabels: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
};

interface EmployeeNoteItem {
  id: string;
  employee_note: string;
  manager_note: string | null;
  status: string;
  percentage: number;
  general_rating: string;
  submitted_at: string | null;
  employee: { full_name: string; job_title: string } | null;
  period: { year: number; month: number } | null;
}

interface Employee {
  id: string;
  full_name: string;
  job_title: string;
  department_id: string;
  employee_number?: string;
  department?: { name: string };
  eval_status?: string | null;
  eval_rating?: string | null;
  eval_percentage?: number | null;
}

const getEvalStatusLabel = (status: string | null | undefined): string => {
  if (!status || status === 'مسودة') return 'بانتظار التقييم';
  if (status === 'بانتظار الموافقة') return 'بانتظار اعتماد التقييم';
  if (status === 'موافقة' || status === 'اطلع الموظف' || status === 'مغلق') return 'تم اعتماد التقييم';
  if (status === 'مرفوض') return 'مرفوض';
  return status;
};

const getEvalStatusVariant = (status: string | null | undefined): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
  if (!status || status === 'مسودة') return 'default';
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
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

interface Criterion {
  id: string;
  title: string;
  description: string;
  weight: number;
  order: number;
}

interface DeptCriterion {
  id: string;
  department_id: string;
  title: string;
  description: string;
  weight: number;
  order: number;
  is_active: boolean;
}

interface DevelopmentItem {
  development_goal: string;
  action_plan: string;
  duration: string;
  notes: string;
}

export const EvaluationForm: React.FC<{ employeeId?: string }> = ({ employeeId: propEmployeeId }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'form' | 'notes'>('form');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(propEmployeeId || '');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [deptCriteria, setDeptCriteria] = useState<DeptCriterion[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [deptScores, setDeptScores] = useState<Record<string, number>>({});
  const [generalWeight, setGeneralWeight] = useState(50);
  const [specificWeight, setSpecificWeight] = useState(50);
  const [managerNote, setManagerNote] = useState('');
  const [developmentItems, setDevelopmentItems] = useState<DevelopmentItem[]>([
    { development_goal: '', action_plan: '', duration: '', notes: '' },
    { development_goal: '', action_plan: '', duration: '', notes: '' },
    { development_goal: '', action_plan: '', duration: '', notes: '' }
  ]);
  const [employeeNote, setEmployeeNote] = useState('');
  const [evaluationStatus, setEvaluationStatus] = useState('');
  const [ceoComment, setCeoComment] = useState('');
  const [activePeriod, setActivePeriod] = useState<any>(null);
  const [allPeriods, setAllPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [employeeNotes, setEmployeeNotes] = useState<EmployeeNoteItem[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [tablePeriods, setTablePeriods] = useState<any[]>([]);
  const [tablePeriodId, setTablePeriodId] = useState<string>('');

  // Fetch periods for table view
  useEffect(() => {
    const fetchPeriods = async () => {
      const { data: periods } = await supabase
        .from('evaluation_periods')
        .select('id, year, month, status')
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      setTablePeriods(periods || []);
      const active = (periods || []).find((p: any) => p.status === 'نشطة');
      if (active) setTablePeriodId(active.id);
      else if (periods && periods.length > 0) setTablePeriodId(periods[0].id);
    };
    fetchPeriods();
  }, []);

  useEffect(() => {
    if (user) {
      fetchCriteria();
      fetchActivePeriod();
      fetchEmployeeNotes();
    }
  }, [user]);

  useEffect(() => {
    if (user && tablePeriodId) {
      fetchEmployees();
    }
  }, [user, tablePeriodId]);

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchEmployee();
    }
  }, [selectedEmployeeId]);

  useEffect(() => {
    if (selectedEmployeeId && activePeriod) {
      loadExistingEvaluation();
    }
  }, [selectedEmployeeId, activePeriod]);

  const fetchEmployees = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('employees')
      .select('id, full_name, job_title, department_id, employee_number, department:departments(name)')
      .eq('manager_id', user.id)
      .order('full_name');

    // Fetch eval statuses for selected period
    let evalMap = new Map<string, { status: string; rating: string | null; percentage: number | null }>();
    if (tablePeriodId) {
      const { data: evals } = await supabase
        .from('evaluations')
        .select('employee_id, status, general_rating, percentage')
        .eq('manager_id', user.id)
        .eq('period_id', tablePeriodId);

      if (evals) {
        evalMap = new Map(evals.map(ev => [ev.employee_id, {
          status: ev.status,
          rating: ev.general_rating,
          percentage: ev.percentage,
        }]));
      }
    }

    setEmployees((data || []).map((emp: any) => ({
      ...emp,
      eval_status: evalMap.get(emp.id)?.status || null,
      eval_rating: evalMap.get(emp.id)?.rating || null,
      eval_percentage: evalMap.get(emp.id)?.percentage || null,
    })));
    setEmployeesLoading(false);
  };

  const fetchEmployee = async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, full_name, job_title, department_id, department:departments(name)')
      .eq('id', selectedEmployeeId)
      .single();

    setEmployee(data);
    if (data?.department_id) {
      fetchDeptCriteria(data.department_id);
    }
  };

  const fetchCriteria = async () => {
    const { data } = await supabase
      .from('evaluation_criteria')
      .select('*')
      .eq('is_active', true)
      .order('order');

    setCriteria(data || []);
  };

  const fetchDeptCriteria = async (deptId: string) => {
    const { data } = await supabase
      .from('department_criteria')
      .select('*')
      .eq('department_id', deptId)
      .eq('is_active', true)
      .order('order');

    setDeptCriteria(data || []);
  };

  const fetchActivePeriod = async () => {
    const { data: periods } = await supabase
      .from('evaluation_periods')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    setAllPeriods(periods || []);
    const active = (periods || []).find((p: any) => p.status === 'نشطة') || null;
    setActivePeriod(active);
    if (active) {
      setGeneralWeight(active.general_weight ?? 50);
      setSpecificWeight(active.specific_weight ?? 50);
    }
  };

  const fetchEmployeeNotes = async () => {
    if (!user) return;
    setNotesLoading(true);
    const { data } = await supabase
      .from('evaluations')
      .select(`
        id, employee_note, manager_note, status, percentage, general_rating, submitted_at,
        employee:employees!evaluations_employee_id_fkey(full_name, job_title),
        period:evaluation_periods(year, month)
      `)
      .eq('manager_id', user.id)
      .not('employee_note', 'is', null)
      .neq('employee_note', '')
      .order('submitted_at', { ascending: false });

    setEmployeeNotes((data as EmployeeNoteItem[]) || []);
    setNotesLoading(false);
  };

  const loadExistingEvaluation = async () => {
    if (!selectedEmployeeId || !user || !activePeriod) return;

    const { data: evaluation } = await supabase
      .from('evaluations')
      .select('*')
      .eq('employee_id', selectedEmployeeId)
      .eq('period_id', activePeriod.id)
      .maybeSingle();

    if (evaluation) {
      const { data: evalScores } = await supabase
        .from('evaluation_scores')
        .select('*')
        .eq('evaluation_id', evaluation.id);

      const scoresMap: Record<string, number> = {};
      const deptScoresMap: Record<string, number> = {};
      evalScores?.forEach(score => {
        if (score.criterion_type === 'specific' && score.department_criterion_id) {
          deptScoresMap[score.department_criterion_id] = score.score_1_to_5;
        } else if (score.criterion_id) {
          scoresMap[score.criterion_id] = score.score_1_to_5;
        }
      });
      setScores(scoresMap);
      setDeptScores(deptScoresMap);
      setManagerNote(evaluation.manager_note || '');
      setEmployeeNote(evaluation.employee_note || '');
      setEvaluationStatus(evaluation.status || '');
      setCeoComment(evaluation.ceo_comment || '');

      const { data: devPlans } = await supabase
        .from('development_plans')
        .select('*')
        .eq('evaluation_id', evaluation.id)
        .order('item_order');

      if (devPlans && devPlans.length > 0) {
        setDevelopmentItems(devPlans.map(p => ({
          development_goal: p.development_goal,
          action_plan: p.action_plan,
          duration: p.duration,
          notes: p.notes || ''
        })));
      }
    }
  };

  const calculateResults = () => {
    // General criteria: raw total and max possible
    let generalRawTotal = 0;
    let generalMaxPossible = 0;
    criteria.forEach(criterion => {
      const score = scores[criterion.id] || 0;
      generalRawTotal += score * criterion.weight;
      generalMaxPossible += 5 * criterion.weight;
    });

    // Specific criteria: raw total and max possible
    let specificRawTotal = 0;
    let specificMaxPossible = 0;
    deptCriteria.forEach(criterion => {
      const score = deptScores[criterion.id] || 0;
      specificRawTotal += score * criterion.weight;
      specificMaxPossible += 5 * criterion.weight;
    });

    // Normalize each group to 0-1 range
    const generalNorm = generalMaxPossible > 0 ? generalRawTotal / generalMaxPossible : 0;
    const specificNorm = specificMaxPossible > 0 ? specificRawTotal / specificMaxPossible : 0;

    // Raw percentage from weighted norms
    const percentage = (generalNorm * generalWeight + specificNorm * specificWeight) / 100 * 100;

    // Dynamic score mapping based on percentage ranges
    const { finalScore5, finalScore500, generalRating } = computeFinalScores(percentage);

    return { totalScore500: finalScore500, finalScore5, percentage, generalRating, generalRawTotal, specificRawTotal };
  };

  const handleSubmit = async (isDraft: boolean) => {
    if (!selectedEmployeeId || !user || !activePeriod || !employee) return;

    setLoading(true);

    try {
      const results = calculateResults();

      const { data: existingEval } = await supabase
        .from('evaluations')
        .select('id')
        .eq('employee_id', selectedEmployeeId)
        .eq('period_id', activePeriod.id)
        .maybeSingle();

      let evaluationId: string;

      if (existingEval) {
        await supabase
          .from('evaluations')
          .update({
            status: isDraft ? 'مسودة' : 'بانتظار الموافقة',
            final_score_500: results.totalScore500,
            final_score_5: results.finalScore5,
            percentage: results.percentage,
            general_rating: results.generalRating,
            manager_note: managerNote,
            submitted_at: isDraft ? null : new Date().toISOString()
          })
          .eq('id', existingEval.id);

        evaluationId = existingEval.id;

        await supabase.from('evaluation_scores').delete().eq('evaluation_id', evaluationId);
        await supabase.from('development_plans').delete().eq('evaluation_id', evaluationId);
      } else {
        const { data: newEval } = await supabase
          .from('evaluations')
          .insert({
            employee_id: selectedEmployeeId,
            manager_id: user.id,
            department_id: employee.department_id,
            period_id: activePeriod.id,
            status: isDraft ? 'مسودة' : 'بانتظار الموافقة',
            final_score_500: results.totalScore500,
            final_score_5: results.finalScore5,
            percentage: results.percentage,
            general_rating: results.generalRating,
            manager_note: managerNote,
            submitted_at: isDraft ? null : new Date().toISOString()
          })
          .select()
          .single();

        evaluationId = newEval!.id;
      }

      // General criteria scores
      const generalScoreInserts = criteria.map(criterion => ({
        evaluation_id: evaluationId,
        criterion_id: criterion.id,
        criterion_type: 'general' as const,
        score_1_to_5: scores[criterion.id] || 0,
        weighted_result: (scores[criterion.id] || 0) * criterion.weight
      }));

      // Specific criteria scores
      const specificScoreInserts = deptCriteria.map(criterion => ({
        evaluation_id: evaluationId,
        department_criterion_id: criterion.id,
        criterion_type: 'specific' as const,
        score_1_to_5: deptScores[criterion.id] || 0,
        weighted_result: (deptScores[criterion.id] || 0) * criterion.weight
      }));

      const allScoreInserts = [...generalScoreInserts, ...specificScoreInserts];
      if (allScoreInserts.length > 0) {
        await supabase.from('evaluation_scores').insert(allScoreInserts);
      }

      const devPlanInserts = developmentItems
        .filter(item => item.development_goal.trim())
        .map((item, index) => ({
          evaluation_id: evaluationId,
          item_order: index + 1,
          ...item
        }));

      if (devPlanInserts.length > 0) {
        await supabase.from('development_plans').insert(devPlanInserts);
      }

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: isDraft ? 'حفظ تقييم كمسودة' : 'إرسال تقييم',
        entity_type: 'evaluations',
        entity_id: evaluationId,
        details: { employee_id: selectedEmployeeId }
      });

      alert(isDraft ? 'تم حفظ التقييم كمسودة بنجاح' : 'تم إرسال التقييم بنجاح');
    } catch (error) {
      console.error('Error saving evaluation:', error);
      alert('حدث خطأ أثناء حفظ التقييم');
    } finally {
      setLoading(false);
    }
  };

  const addDevelopmentItem = () => {
    setDevelopmentItems([...developmentItems, { development_goal: '', action_plan: '', duration: '', notes: '' }]);
  };

  const removeDevelopmentItem = (index: number) => {
    setDevelopmentItems(developmentItems.filter((_, i) => i !== index));
  };

  const updateDevelopmentItem = (index: number, field: keyof DevelopmentItem, value: string) => {
    const updated = [...developmentItems];
    updated[index][field] = value;
    setDevelopmentItems(updated);
  };

  const results = calculateResults();
  const isReadOnly = evaluationStatus === 'بانتظار الموافقة' || evaluationStatus === 'موافقة';

  const evaluatedCount = employees.filter(e => e.eval_status && e.eval_status !== 'مسودة').length;
  const pendingEmpCount = employees.filter(e => !e.eval_status || e.eval_status === 'مسودة').length;
  const filteredEmployees = employees.filter(e =>
    e.full_name.includes(searchQuery) ||
    e.job_title.includes(searchQuery) ||
    (e.department?.name || '').includes(searchQuery)
  );

  if (employeesLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const selectedTablePeriod = tablePeriods.find((p: any) => p.id === tablePeriodId);
  const tablePeriodLabel = selectedTablePeriod
    ? `${monthLabels[selectedTablePeriod.month]} ${selectedTablePeriod.year}`
    : '';

  // Table view when no employee selected
  if (!selectedEmployeeId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">تقييم الموظفين</h1>
            <p className="text-gray-600 mt-2">اختر الموظف لبدء أو عرض التقييم</p>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
            <Calendar className="h-5 w-5 text-blue-600" />
            <select
              value={tablePeriodId}
              onChange={(e) => setTablePeriodId(e.target.value)}
              className="bg-transparent text-blue-800 font-semibold text-sm border-none focus:ring-0 cursor-pointer"
            >
              {tablePeriods.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {monthLabels[p.month]} {p.year} {p.status === 'نشطة' ? '(نشطة)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">إجمالي الموظفين</p>
                      <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
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
                      <p className="text-2xl font-bold text-amber-600">{pendingEmpCount}</p>
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
                      placeholder="بحث بالاسم أو المسمى أو القسم..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                    />
                  </div>
                </div>

                {filteredEmployees.length === 0 ? (
                  <EmptyState
                    message={searchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد موظفون تابعون لك حاليًا'}
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
                    <TBody>
                      {filteredEmployees.map((emp) => (
                        <TableRow key={emp.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                                {emp.full_name.charAt(0)}
                              </div>
                              <span className="font-medium text-gray-900">{emp.full_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-gray-500 text-sm font-mono">{emp.employee_number || '-'}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-gray-600 text-sm">{emp.job_title}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-gray-600 text-sm">{emp.department?.name || '-'}</span>
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
                                !emp.eval_status || emp.eval_status === 'مسودة' || emp.eval_status === 'مرفوض'
                                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {!emp.eval_status || emp.eval_status === 'مسودة' || emp.eval_status === 'مرفوض' ? (
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
                          </TableCell>
                        </TableRow>
                      ))}
                    </TBody>
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
            setSelectedEmployeeId('');
            setScores({});
            setDeptScores({});
            setManagerNote('');
            setEvaluationStatus('');
            setEmployee(null);
            setDevelopmentItems([
              { development_goal: '', action_plan: '', duration: '', notes: '' },
              { development_goal: '', action_plan: '', duration: '', notes: '' },
              { development_goal: '', action_plan: '', duration: '', notes: '' }
            ]);
          }}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ArrowRight className="h-5 w-5" />
          <span className="text-sm font-medium">العودة للقائمة</span>
        </button>
      </div>
      <div>
        <h1 className="text-3xl font-bold text-gray-900">تقييم الموظف</h1>
        <p className="text-gray-600 mt-2">إنشاء أو تحديث تقييم شهري</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('form')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'form'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          نموذج التقييم
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'notes'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span>ملاحظات الموظفين على التقييم</span>
          {employeeNotes.length > 0 && (
            <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
              {employeeNotes.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'notes' && (
        <div className="space-y-4">
          {notesLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : employeeNotes.length === 0 ? (
            <Card>
              <CardBody className="text-center py-16">
                <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">لا توجد ملاحظات من الموظفين حتى الآن</p>
                <p className="text-gray-400 text-sm mt-2">ستظهر هنا ردود الموظفين على تقييماتهم</p>
              </CardBody>
            </Card>
          ) : (
            employeeNotes.map(item => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{item.employee?.full_name}</p>
                        <p className="text-xs text-gray-500">{item.employee?.job_title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{item.period?.month ? monthLabels[item.period.month] : ''} {item.period?.year}</span>
                      </div>
                      <Badge variant={item.percentage >= 90 ? 'success' : item.percentage >= 70 ? 'info' : 'warning'} size="sm">
                        {item.general_rating}
                      </Badge>
                      <span className="text-gray-400">{item.percentage?.toFixed(1)}%</span>
                    </div>
                  </div>
                </CardHeader>
                <CardBody className="space-y-4">
                  {item.manager_note && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1.5">ملاحظة المدير</p>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-sm text-gray-700 leading-relaxed">{item.manager_note}</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <MessageSquare className="h-4 w-4 text-teal-600" />
                      <p className="text-xs font-medium text-teal-700">رد الموظف</p>
                    </div>
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                      <p className="text-sm text-teal-900 leading-relaxed">{item.employee_note}</p>
                    </div>
                  </div>
                  {item.submitted_at && (
                    <p className="text-xs text-gray-400">
                      تاريخ الإرسال: {new Date(item.submitted_at).toLocaleDateString('ar-SA')}
                    </p>
                  )}
                </CardBody>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'form' && (
        <>

      {/* Period Selector */}
      <Card>
        <CardBody>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">فترة التقييم</label>
            <select
              value={activePeriod?.id || ''}
              onChange={(e) => {
                const p = allPeriods.find((pr: any) => pr.id === e.target.value);
                if (p) {
                  setActivePeriod(p);
                  setGeneralWeight(p.general_weight ?? 50);
                  setSpecificWeight(p.specific_weight ?? 50);
                }
              }}
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg"
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

      {/* CEO Rejection Comment */}
      {evaluationStatus === 'مرفوض' && ceoComment && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-800 mb-1">تم رفض التقييم من الإدارة العليا</p>
            <p className="text-sm text-red-700">{ceoComment}</p>
            <p className="text-xs text-red-500 mt-2">يمكنك تعديل التقييم وإعادة إرساله</p>
          </div>
        </div>
      )}

      {/* Pending Approval Notice */}
      {evaluationStatus === 'بانتظار الموافقة' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">التقييم بانتظار موافقة الإدارة العليا</p>
            <p className="text-xs text-amber-600 mt-1">لا يمكن تعديل التقييم حتى تتم المراجعة</p>
          </div>
        </div>
      )}

      {/* Approved Notice */}
      {evaluationStatus === 'موافقة' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-green-800">تمت الموافقة على التقييم من الإدارة العليا</p>
          </div>
        </div>
      )}

      {employee && (
        <>
          <Card>
            <CardBody className="bg-blue-50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-blue-600">اسم الموظف</p>
                  <p className="font-semibold text-blue-900">{employee.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-600">المسمى الوظيفي</p>
                  <p className="font-semibold text-blue-900">{employee.job_title}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-600">القسم</p>
                  <p className="font-semibold text-blue-900">{employee.department?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-600">فترة التقييم</p>
                  <p className="font-semibold text-blue-900">
                    {activePeriod ? `${monthLabels[activePeriod.month]} ${activePeriod.year}` : 'غير محدد'}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">محاور التقييم</h2>
            <p className="text-sm text-gray-500 mb-4">
              المعايير العامة ({generalWeight}%) + المعايير الخاصة بالقسم ({specificWeight}%) = 100%
            </p>

            {criteria.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <h3 className="text-lg font-bold text-blue-900">المعايير العامة ({generalWeight}%)</h3>
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
                                {(scores[criterion.id] * criterion.weight).toFixed(1)}
                              </span> من {(criterion.weight * 5).toFixed(1)}
                            </p>
                          </div>
                        )}
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {deptCriteria.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <h3 className="text-lg font-bold text-emerald-900">المعايير الخاصة بالقسم ({specificWeight}%)</h3>
                </div>
                <div className="space-y-4">
                  {deptCriteria.map(criterion => (
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
                          value={deptScores[criterion.id] || 0}
                          onChange={(val) => setDeptScores({ ...deptScores, [criterion.id]: val })}
                          color="emerald"
                          disabled={isReadOnly}
                        />
                        {deptScores[criterion.id] && (
                          <div className="mt-3 text-sm text-gray-600">
                            <p>
                              الدرجة: <span className="font-semibold text-emerald-600">{deptScores[criterion.id]}</span> / 5
                              {' — '}
                              المرجحة: <span className="font-semibold text-emerald-600">
                                {(deptScores[criterion.id] * criterion.weight).toFixed(1)}
                              </span> من {(criterion.weight * 5).toFixed(1)}
                            </p>
                          </div>
                        )}
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {deptCriteria.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3 mb-6">
                <ClipboardList className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <p className="text-amber-800 text-sm">
                  لم يتم تحديد معايير خاصة لهذا القسم بعد. يرجى إضافة المعايير الخاصة من صفحة "المعايير الخاصة".
                </p>
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">النتيجة النهائية</h2>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">الدرجة من 500</p>
                  <p className="text-3xl font-bold text-blue-600">{results.totalScore500.toFixed(0)}</p>
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
                  <Badge variant={results.percentage >= 90 ? 'success' : results.percentage >= 70 ? 'info' : 'warning'} size="lg">
                    {results.generalRating}
                  </Badge>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">ملاحظات المدير المباشر</h2>
            </CardHeader>
            <CardBody>
              <TextArea
                value={managerNote}
                onChange={(e) => setManagerNote(e.target.value)}
                rows={4}
                placeholder="اكتب ملاحظاتك حول أداء الموظف..."
                disabled={isReadOnly}
              />
            </CardBody>
          </Card>

          {employeeNote && (
            <Card className="border-teal-200">
              <CardHeader className="bg-teal-50">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-teal-800">رد الموظف على التقييم</h2>
                  <MessageSquare className="h-5 w-5 text-teal-600" />
                </div>
              </CardHeader>
              <CardBody className="bg-teal-50/30">
                <p className="text-gray-800 leading-relaxed">{employeeNote}</p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">خطة التطوير للشهر القادم</h2>
                {!isReadOnly && (
                  <Button size="sm" onClick={addDevelopmentItem} className="flex items-center gap-1">
                    <span>إضافة بند</span>
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {developmentItems.map((item, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">البند {index + 1}</h3>
                      {!isReadOnly && developmentItems.length > 1 && (
                        <button
                          onClick={() => removeDevelopmentItem(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="الهدف التطويري"
                      value={item.development_goal}
                      onChange={(e) => updateDevelopmentItem(index, 'development_goal', e.target.value)}
                      disabled={isReadOnly}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-500"
                    />
                    <input
                      type="text"
                      placeholder="الإجراء"
                      value={item.action_plan}
                      onChange={(e) => updateDevelopmentItem(index, 'action_plan', e.target.value)}
                      disabled={isReadOnly}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-500"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="المدة (مثال: شهرين)"
                        value={item.duration}
                        onChange={(e) => updateDevelopmentItem(index, 'duration', e.target.value)}
                        disabled={isReadOnly}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-500"
                      />
                      <input
                        type="text"
                        placeholder="ملاحظات"
                        value={item.notes}
                        onChange={(e) => updateDevelopmentItem(index, 'notes', e.target.value)}
                        disabled={isReadOnly}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Only show buttons if evaluation is editable (draft or rejected) */}
          {(!evaluationStatus || evaluationStatus === 'مسودة' || evaluationStatus === 'مرفوض') && (
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
        </>
      )}
        </>
      )}
    </div>
  );
};
