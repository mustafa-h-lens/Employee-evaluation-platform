import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { BarChart3, Search, User, Calendar, Star, MessageSquare, FileText, ChevronDown, Crown, UserCheck } from 'lucide-react';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { ModernSelect } from '../../components/ui/ModernSelect';

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
      const [{ data: dirs }, { data: emps }] = await Promise.all([
        supabase.from('users').select('id, full_name, job_title, role, email').eq('role', 'director').order('full_name'),
        supabase.from('employees').select('id, full_name, job_title, employee_number, department:departments(name)').eq('status', 'active').order('full_name'),
      ]);
      setDirectors((dirs || []) as PersonOption[]);
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
      // Employees tab
      const { data: evals } = await supabase
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
        .order('submitted_at', { ascending: false });

      const evalList = (evals as unknown as EmployeeEvalRecord[]) || [];
      setEmployeeEvals(evalList);

      const scoresMap: Record<string, ScoreDetail[]> = {};
      await Promise.all(evalList.map(async (ev) => {
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

  const summary = (periodMode === 'annual' || (periodMode === 'quarterly' && selectedQuarter > 0)) && currentEvals.length > 0
    ? {
        avgPercentage: currentEvals.reduce((s, e) => s + e.percentage, 0) / currentEvals.length,
        avgScore5: currentEvals.reduce((s, e) => s + e.final_score_5, 0) / currentEvals.length,
        avgScore500: currentEvals.reduce((s, e) => s + e.final_score_500, 0) / currentEvals.length,
        count: currentEvals.length,
        get generalRating() {
          if (this.avgPercentage >= 90) return 'ممتاز';
          if (this.avgPercentage >= 80) return 'جيد جدًا';
          if (this.avgPercentage >= 70) return 'جيد';
          return 'يحتاج تحسين';
        },
      }
    : null;

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
      evaluatorNote = ev.manager_note;
      subjectNote = ev.employee_note;
      evaluatorLabel = 'ملاحظات المدير';
      subjectLabel = 'رد الموظف';
      subtitle = ev.manager ? `المقيّم: ${ev.manager.full_name}` : null;
    }

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
            <Badge variant={getStatusVariant(ev.status)} size="sm">{getStatusLabel(ev.status)}</Badge>
          </div>
        </CardHeader>

        <CardBody className="space-y-5">
          {/* Final Results */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-blue-600 mb-1">النتيجة / 500</p>
              <p className="text-xl font-bold text-blue-700">{ev.final_score_500?.toFixed(1)}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <p className="text-xs text-purple-600 mb-1">النتيجة / 5</p>
              <p className="text-xl font-bold text-purple-700">{ev.final_score_5?.toFixed(2)}</p>
            </div>
            <div className="bg-teal-50 rounded-lg p-3 text-center">
              <p className="text-xs text-teal-600 mb-1">النسبة المئوية</p>
              <p className="text-xl font-bold text-teal-700">{ev.percentage?.toFixed(0)}%</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-xs text-amber-600 mb-1">التقدير العام</p>
              {ev.general_rating ? (
                <Badge variant={getRatingVariant(ev.general_rating)}>{ev.general_rating}</Badge>
              ) : <span className="text-ds-faint text-sm">-</span>}
            </div>
          </div>

          {/* General Criteria */}
          {generalScores.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-blue-700 mb-2 flex items-center gap-2">
                <Star className="h-4 w-4" /> المعايير العامة
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
              <h3 className="text-sm font-bold text-emerald-700 mb-2 flex items-center gap-2">
                <Star className="h-4 w-4" /> المعايير الخاصة
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
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-blue-700 mb-1 flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> {evaluatorLabel}
                  </p>
                  <p className="text-sm text-ds-text">{evaluatorNote}</p>
                </div>
              )}
              {subjectNote && (
                <div className="bg-teal-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-teal-700 mb-1 flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> {subjectLabel}
                  </p>
                  <p className="text-sm text-ds-text">{subjectNote}</p>
                </div>
              )}
              {ev.ceo_comment && (
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1">
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
        className="rounded-ds-xl p-8"
        style={{
          background: 'var(--sc-blue-grad)',
          border: '1px solid var(--sc-blue-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-blue-val)' }}>تقارير الأداء</h1>
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
                ? 'border-blue-600 text-blue-600 bg-blue-50'
                : 'border-transparent text-ds-faint hover:text-ds-muted hover:bg-ds-bg'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-4 flex-wrap">
            {/* Searchable dropdown */}
            <div className="relative flex-1 min-w-[280px]">
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
                  onFocus={() => setDropdownOpen(true)}
                  placeholder="ابحث بالاسم..."
                  className="w-full px-4 py-2 pr-10 border border-ds-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ds-faint" />
                <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ds-faint" />
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
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-right transition-colors border-b border-gray-50 last:border-0"
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
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-right transition-colors border-b border-gray-50 last:border-0"
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
                      <p className="font-semibold text-emerald-900">{selectedInfo.extra}</p>
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
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : currentEvals.length === 0 ? (
            <Card>
              <CardBody className="text-center py-16">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-ds-faint text-lg">لا توجد تقييمات في الفترة المحددة</p>
              </CardBody>
            </Card>
          ) : (
            <>
              {/* Summary */}
              {summary && (
                <Card className="border-blue-200">
                  <CardHeader className="bg-blue-50">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                      <h2 className="text-lg font-semibold text-blue-900">
                        {periodMode === 'annual' ? `الملخص السنوي — ${selectedYear}` : `ملخص ${quarterLabels[selectedQuarter]} — ${selectedYear}`}
                      </h2>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-blue-50 rounded-lg p-4 text-center">
                          <p className="text-xs text-blue-600 mb-1">عدد التقييمات</p>
                          <p className="text-2xl font-bold text-blue-700">{summary.count}</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4 text-center">
                          <p className="text-xs text-purple-600 mb-1">متوسط / 500</p>
                          <p className="text-2xl font-bold text-purple-700">{summary.avgScore500.toFixed(0)}</p>
                        </div>
                        <div className="bg-indigo-50 rounded-lg p-4 text-center">
                          <p className="text-xs text-indigo-600 mb-1">متوسط / 5</p>
                          <p className="text-2xl font-bold text-indigo-700">{summary.avgScore5.toFixed(2)}</p>
                        </div>
                        <div className="bg-teal-50 rounded-lg p-4 text-center">
                          <p className="text-xs text-teal-600 mb-1">متوسط النسبة</p>
                          <p className="text-2xl font-bold text-teal-700">{summary.avgPercentage.toFixed(1)}%</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-4 text-center">
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
                          {currentEvals
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
