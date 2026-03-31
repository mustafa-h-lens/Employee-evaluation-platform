import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TextArea } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Save, Send, Plus, Trash2, MessageSquare, ClipboardList, Calendar, Users } from 'lucide-react';

interface EmployeeNoteItem {
  id: string;
  employee_note: string;
  manager_note: string | null;
  status: string;
  percentage: number;
  general_rating: string;
  submitted_at: string | null;
  employee: { full_name: string; job_title: string } | null;
  period: { year: number; quarter: number } | null;
}

interface Employee {
  id: string;
  full_name: string;
  job_title: string;
  department_id: string;
  department?: { name: string };
}

interface Criterion {
  id: string;
  title: string;
  description: string;
  weight: number;
  order: number;
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
  const [scores, setScores] = useState<Record<string, number>>({});
  const [managerNote, setManagerNote] = useState('');
  const [developmentItems, setDevelopmentItems] = useState<DevelopmentItem[]>([
    { development_goal: '', action_plan: '', duration: '', notes: '' },
    { development_goal: '', action_plan: '', duration: '', notes: '' },
    { development_goal: '', action_plan: '', duration: '', notes: '' }
  ]);
  const [employeeNote, setEmployeeNote] = useState('');
  const [evaluationStatus, setEvaluationStatus] = useState('');
  const [activePeriod, setActivePeriod] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [employeeNotes, setEmployeeNotes] = useState<EmployeeNoteItem[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchEmployees();
      fetchCriteria();
      fetchActivePeriod();
      fetchEmployeeNotes();
    }
  }, [user]);

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
      .select('id, full_name, job_title, department_id, department:departments(name)')
      .eq('manager_id', user.id)
      .order('full_name');

    setEmployees(data || []);
  };

  const fetchEmployee = async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, full_name, job_title, department_id, department:departments(name)')
      .eq('id', selectedEmployeeId)
      .single();

    setEmployee(data);
  };

  const fetchCriteria = async () => {
    const { data } = await supabase
      .from('evaluation_criteria')
      .select('*')
      .eq('is_active', true)
      .order('order');

    setCriteria(data || []);
  };

  const fetchActivePeriod = async () => {
    const { data } = await supabase
      .from('evaluation_periods')
      .select('*')
      .eq('status', 'نشطة')
      .maybeSingle();

    setActivePeriod(data);
  };

  const fetchEmployeeNotes = async () => {
    if (!user) return;
    setNotesLoading(true);
    const { data } = await supabase
      .from('evaluations')
      .select(`
        id, employee_note, manager_note, status, percentage, general_rating, submitted_at,
        employee:employees!evaluations_employee_id_fkey(full_name, job_title),
        period:evaluation_periods(year, quarter)
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
      evalScores?.forEach(score => {
        scoresMap[score.criterion_id] = score.score_1_to_5;
      });
      setScores(scoresMap);
      setManagerNote(evaluation.manager_note || '');
      setEmployeeNote(evaluation.employee_note || '');
      setEvaluationStatus(evaluation.status || '');

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
    let totalWeightedScore = 0;
    let totalScore500 = 0;

    criteria.forEach(criterion => {
      const score = scores[criterion.id] || 0;
      const weighted = (score * criterion.weight);
      totalWeightedScore += weighted;
      totalScore500 += weighted;
    });

    const finalScore5 = totalScore500 / 100;
    const percentage = (totalScore500 / 500) * 100;

    let generalRating = 'يحتاج تحسين';
    if (percentage >= 90) generalRating = 'ممتاز';
    else if (percentage >= 80) generalRating = 'جيد جدًا';
    else if (percentage >= 70) generalRating = 'جيد';

    return { totalScore500, finalScore5, percentage, generalRating };
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
            status: isDraft ? 'مسودة' : 'تم الإرسال',
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
            status: isDraft ? 'مسودة' : 'تم الإرسال',
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

      const scoreInserts = criteria.map(criterion => ({
        evaluation_id: evaluationId,
        criterion_id: criterion.id,
        score_1_to_5: scores[criterion.id] || 0,
        weighted_result: (scores[criterion.id] || 0) * criterion.weight
      }));

      await supabase.from('evaluation_scores').insert(scoreInserts);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">تقييم الموظف</h1>
        <p className="text-gray-600 mt-2">إنشاء أو تحديث تقييم ربع سنوي</p>
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
                        <span>الربع {item.period?.quarter} - {item.period?.year}</span>
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

      {!propEmployeeId && (
        <Card>
          <CardBody>
            <label className="block text-sm font-medium text-gray-700 mb-2">اختر الموظف</label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">اختر موظف</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} - {emp.job_title}
                </option>
              ))}
            </select>
          </CardBody>
        </Card>
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
                    {activePeriod ? `الربع ${activePeriod.quarter} - ${activePeriod.year}` : 'غير محدد'}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">محاور التقييم</h2>
            <div className="space-y-4">
              {criteria.map(criterion => (
                <Card key={criterion.id}>
                  <CardHeader>
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
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map(score => (
                        <button
                          key={score}
                          onClick={() => setScores({ ...scores, [criterion.id]: score })}
                          className={`flex-1 py-3 px-4 rounded-lg border-2 font-semibold transition-all ${
                            scores[criterion.id] === score
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                          }`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                    {scores[criterion.id] && (
                      <div className="mt-3 text-sm text-gray-600">
                        <p>
                          الدرجة المرجحة: <span className="font-semibold text-blue-600">
                            {scores[criterion.id] * criterion.weight}
                          </span> من {criterion.weight * 5}
                        </p>
                      </div>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
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
                <h2 className="text-lg font-semibold text-gray-900">خطة التطوير للربع القادم</h2>
                <Button size="sm" onClick={addDevelopmentItem} className="flex items-center gap-1">
                  <span>إضافة بند</span>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {developmentItems.map((item, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">البند {index + 1}</h3>
                      {developmentItems.length > 1 && (
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="الإجراء"
                      value={item.action_plan}
                      onChange={(e) => updateDevelopmentItem(index, 'action_plan', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="المدة (مثال: شهرين)"
                        value={item.duration}
                        onChange={(e) => updateDevelopmentItem(index, 'duration', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="ملاحظات"
                        value={item.notes}
                        onChange={(e) => updateDevelopmentItem(index, 'notes', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

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
        </>
      )}
        </>
      )}
    </div>
  );
};
