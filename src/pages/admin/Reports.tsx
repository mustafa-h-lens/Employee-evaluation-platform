import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { BarChart3, Search, User, Building2, Calendar, Star, Target, MessageSquare, FileText, ChevronDown } from 'lucide-react';
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

const getQuarterForMonth = (month: number): number => Math.ceil(month / 3);

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
    case 'موافقة': case 'تم الإرسال': case 'اطلع الموظف': case 'مغلق': case 'مكتمل': return 'success';
    case 'مرفوض': return 'danger';
    default: return 'default';
  }
};

const getStatusLabel = (status: string): string => {
  if (status === 'بانتظار الموافقة') return 'بانتظار اعتماد التقييم';
  if (['موافقة', 'تم الإرسال', 'اطلع الموظف', 'مغلق', 'مكتمل'].includes(status)) return 'تم اعتماد التقييم';
  if (status === 'مرفوض') return 'مرفوض';
  if (!status || status === 'مسودة') return 'بانتظار التقييم';
  return status;
};

interface EmployeeOption {
  id: string;
  full_name: string;
  job_title: string;
  employee_number: string;
  department_name: string;
  department_id: string;
}

interface EvalRecord {
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
}

interface ScoreDetail {
  criterion_title: string;
  criterion_description: string;
  criterion_weight: number;
  score: number;
  weighted_result: number;
  type: 'general' | 'specific';
}

interface DevPlan {
  item_order: number;
  development_goal: string;
  action_plan: string;
  duration: string;
  notes: string | null;
}

type PeriodMode = 'monthly' | 'quarterly' | 'annual';

export const Reports: React.FC = () => {
  // Employee selection
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Period filters
  const [periodMode, setPeriodMode] = useState<PeriodMode>('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(0);

  // Data
  const [evaluations, setEvaluations] = useState<EvalRecord[]>([]);
  const [scores, setScores] = useState<Record<string, ScoreDetail[]>>({});
  const [devPlans, setDevPlans] = useState<Record<string, DevPlan[]>>({});
  const [loading, setLoading] = useState(false);
  const [years, setYears] = useState<number[]>([]);

  // Fetch all employees
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, full_name, job_title, employee_number, department_id, department:departments(name)')
        .order('full_name');
      if (data) {
        setEmployees(data.map((e: any) => ({
          id: e.id,
          full_name: e.full_name,
          job_title: e.job_title,
          employee_number: e.employee_number,
          department_name: e.department?.name || '-',
          department_id: e.department_id,
        })));
      }
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

    fetchEmployees();
    fetchYears();
  }, []);

  // Fetch evaluations when employee + filters change
  const fetchEvaluations = useCallback(async () => {
    if (!selectedEmployee) return;
    setLoading(true);

    // Get periods for the selected year
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
      setEvaluations([]);
      setScores({});
      setDevPlans({});
      setLoading(false);
      return;
    }

    const { data: evals } = await supabase
      .from('evaluations')
      .select(`
        id, status, final_score_500, final_score_5, percentage, general_rating,
        manager_note, employee_note, ceo_comment, submitted_at,
        period:evaluation_periods(year, month),
        manager:users!evaluations_manager_id_fkey(full_name)
      `)
      .eq('employee_id', selectedEmployee.id)
      .in('period_id', periodIds)
      .in('status', ['بانتظار الموافقة', 'موافقة', 'مرفوض', 'تم الإرسال', 'اطلع الموظف', 'مغلق'])
      .order('submitted_at', { ascending: false });

    const evalList = (evals as unknown as EvalRecord[]) || [];
    setEvaluations(evalList);

    // Fetch scores and dev plans for each evaluation
    const scoresMap: Record<string, ScoreDetail[]> = {};
    const devMap: Record<string, DevPlan[]> = {};

    await Promise.all(evalList.map(async (ev) => {
      const [{ data: scoreData }, { data: devData }] = await Promise.all([
        supabase
          .from('evaluation_scores')
          .select(`
            score_1_to_5, weighted_result, criterion_type,
            criterion:evaluation_criteria(title, description, weight),
            dept_criterion:department_criteria(title, description, weight)
          `)
          .eq('evaluation_id', ev.id),
        supabase
          .from('development_plans')
          .select('item_order, development_goal, action_plan, duration, notes')
          .eq('evaluation_id', ev.id)
          .order('item_order'),
      ]);

      scoresMap[ev.id] = (scoreData || []).map((s: any) => ({
        criterion_title: s.criterion_type === 'specific' ? (s.dept_criterion?.title || '') : (s.criterion?.title || ''),
        criterion_description: s.criterion_type === 'specific' ? (s.dept_criterion?.description || '') : (s.criterion?.description || ''),
        criterion_weight: s.criterion_type === 'specific' ? (s.dept_criterion?.weight || 0) : (s.criterion?.weight || 0),
        score: s.score_1_to_5,
        weighted_result: s.weighted_result,
        type: s.criterion_type || 'general',
      }));

      devMap[ev.id] = (devData || []) as DevPlan[];
    }));

    setScores(scoresMap);
    setDevPlans(devMap);
    setLoading(false);
  }, [selectedEmployee, selectedYear, periodMode, selectedMonth, selectedQuarter]);

  useEffect(() => {
    fetchEvaluations();
  }, [fetchEvaluations]);

  const filteredEmployees = employees.filter(e =>
    e.full_name.includes(searchQuery) ||
    e.employee_number.includes(searchQuery) ||
    e.department_name.includes(searchQuery)
  );

  // Annual summary calculation
  const annualSummary = periodMode === 'annual' && evaluations.length > 0
    ? {
        avgPercentage: evaluations.reduce((s, e) => s + e.percentage, 0) / evaluations.length,
        avgScore5: evaluations.reduce((s, e) => s + e.final_score_5, 0) / evaluations.length,
        avgScore500: evaluations.reduce((s, e) => s + e.final_score_500, 0) / evaluations.length,
        count: evaluations.length,
        get generalRating() {
          if (this.avgPercentage >= 90) return 'ممتاز';
          if (this.avgPercentage >= 80) return 'جيد جدًا';
          if (this.avgPercentage >= 70) return 'جيد';
          return 'يحتاج تحسين';
        },
      }
    : null;

  // Quarterly summary
  const quarterlySummary = periodMode === 'quarterly' && selectedQuarter > 0 && evaluations.length > 0
    ? {
        avgPercentage: evaluations.reduce((s, e) => s + e.percentage, 0) / evaluations.length,
        avgScore5: evaluations.reduce((s, e) => s + e.final_score_5, 0) / evaluations.length,
        avgScore500: evaluations.reduce((s, e) => s + e.final_score_500, 0) / evaluations.length,
        count: evaluations.length,
        get generalRating() {
          if (this.avgPercentage >= 90) return 'ممتاز';
          if (this.avgPercentage >= 80) return 'جيد جدًا';
          if (this.avgPercentage >= 70) return 'جيد';
          return 'يحتاج تحسين';
        },
      }
    : null;

  return (
    <div className="space-y-6">
      <div
        className="rounded-ds-xl p-8"
        style={{
          background: 'var(--sc-purple-grad)',
          border: '1px solid var(--sc-purple-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-purple-val)' }}>التقارير والإحصائيات</h1>
        <p className="mt-2" style={{ color: 'var(--sc-purple-label)' }}>تقارير مفصلة عن أداء الموظفين حسب الفترة الزمنية</p>
      </div>

      {/* Employee Search */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-4 flex-wrap">
            {/* Searchable dropdown */}
            <div className="relative flex-1 min-w-[280px]">
              <label className="block text-sm font-medium text-ds-muted mb-1">اختر الموظف</label>
              <div className="relative">
                <input
                  type="text"
                  value={selectedEmployee ? selectedEmployee.full_name : searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedEmployee(null);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder="ابحث بالاسم أو الرقم الوظيفي..."
                  className="w-full px-4 py-2 pr-10 border border-ds-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ds-faint" />
                <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ds-faint" />
              </div>

              {dropdownOpen && !selectedEmployee && (
                <div className="absolute z-20 mt-1 w-full bg-ds-surface border border-ds-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {filteredEmployees.length === 0 ? (
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
                          <p className="text-xs text-ds-faint">{emp.job_title} — {emp.department_name}</p>
                        </div>
                        <span className="text-xs text-ds-faint flex-shrink-0">{emp.employee_number}</span>
                      </button>
                    ))
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

            {/* Period mode toggle */}
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

            {/* Month/Quarter selector */}
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

      {/* No employee selected */}
      {!selectedEmployee && (
        <Card>
          <CardBody className="text-center py-16">
            <User className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-ds-faint text-lg">اختر موظفًا لعرض تقرير الأداء</p>
            <p className="text-ds-faint text-sm mt-2">استخدم حقل البحث أعلاه للبحث عن موظف</p>
          </CardBody>
        </Card>
      )}

      {/* Employee selected */}
      {selectedEmployee && (
        <>
          {/* Employee info card */}
          <Card>
            <CardBody className="bg-blue-50">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-200 rounded-full flex items-center justify-center">
                  <User className="h-7 w-7 text-blue-700" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                  <div>
                    <p className="text-sm text-blue-600">اسم الموظف</p>
                    <p className="font-semibold text-blue-900">{selectedEmployee.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">المسمى الوظيفي</p>
                    <p className="font-semibold text-blue-900">{selectedEmployee.job_title}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">الإدارة</p>
                    <p className="font-semibold text-blue-900">{selectedEmployee.department_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">الرقم الوظيفي</p>
                    <p className="font-semibold text-blue-900">{selectedEmployee.employee_number}</p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : evaluations.length === 0 ? (
            <Card>
              <CardBody className="text-center py-16">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-ds-faint text-lg">لا توجد تقييمات لهذا الموظف في الفترة المحددة</p>
              </CardBody>
            </Card>
          ) : (
            <>
              {/* Annual/Quarterly Summary */}
              {(annualSummary || quarterlySummary) && (
                <Card className="border-blue-200">
                  <CardHeader className="bg-blue-50">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                      <h2 className="text-lg font-semibold text-blue-900">
                        {annualSummary ? `الملخص السنوي — ${selectedYear}` : `ملخص ${quarterLabels[selectedQuarter]} — ${selectedYear}`}
                      </h2>
                    </div>
                  </CardHeader>
                  <CardBody>
                    {(() => {
                      const summary = annualSummary || quarterlySummary!;
                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="bg-blue-50 rounded-lg p-4 text-center">
                              <p className="text-xs text-blue-600 mb-1">عدد التقييمات</p>
                              <p className="text-2xl font-bold text-blue-700">{summary.count}</p>
                            </div>
                            <div className="bg-purple-50 rounded-lg p-4 text-center">
                              <p className="text-xs text-purple-600 mb-1">متوسط النتيجة / 500</p>
                              <p className="text-2xl font-bold text-purple-700">{summary.avgScore500.toFixed(0)}</p>
                            </div>
                            <div className="bg-indigo-50 rounded-lg p-4 text-center">
                              <p className="text-xs text-indigo-600 mb-1">متوسط النتيجة / 5</p>
                              <p className="text-2xl font-bold text-indigo-700">{summary.avgScore5.toFixed(2)}</p>
                            </div>
                            <div className="bg-teal-50 rounded-lg p-4 text-center">
                              <p className="text-xs text-teal-600 mb-1">متوسط النسبة المئوية</p>
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
                              {evaluations
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
                      );
                    })()}
                  </CardBody>
                </Card>
              )}

              {/* Individual evaluations */}
              {evaluations
                .slice()
                .sort((a, b) => (b.period?.month || 0) - (a.period?.month || 0))
                .map(ev => {
                  const evalScores = scores[ev.id] || [];
                  const generalScores = evalScores.filter(s => s.type === 'general');
                  const specificScores = evalScores.filter(s => s.type === 'specific');
                  const evalDevPlans = devPlans[ev.id] || [];

                  return (
                    <Card key={ev.id}>
                      {/* Period header */}
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
                              <p className="text-xs text-ds-faint">المدير المقيّم: {ev.manager?.full_name || '-'}</p>
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
                        {(ev.manager_note || ev.employee_note || ev.ceo_comment) && (
                          <div className="space-y-3">
                            {ev.manager_note && (
                              <div className="bg-blue-50 rounded-lg p-4">
                                <p className="text-xs font-medium text-blue-700 mb-1 flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" /> ملاحظات المدير
                                </p>
                                <p className="text-sm text-ds-text">{ev.manager_note}</p>
                              </div>
                            )}
                            {ev.employee_note && (
                              <div className="bg-teal-50 rounded-lg p-4">
                                <p className="text-xs font-medium text-teal-700 mb-1 flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" /> رد الموظف
                                </p>
                                <p className="text-sm text-ds-text">{ev.employee_note}</p>
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

                        {/* Development Plans */}
                        {evalDevPlans.length > 0 && (
                          <div>
                            <h3 className="text-sm font-bold text-ds-muted mb-2 flex items-center gap-2">
                              <Target className="h-4 w-4" /> خطة التطوير
                            </h3>
                            <div className="border rounded-lg overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-ds-bg">
                                  <tr>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-ds-muted">#</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-ds-muted">الهدف التطويري</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-ds-muted">الإجراء</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-ds-muted">المدة</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-ds-muted">ملاحظات</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-ds-border-subtle">
                                  {evalDevPlans.map((plan, i) => (
                                    <tr key={i}>
                                      <td className="px-4 py-2 text-ds-faint">{plan.item_order}</td>
                                      <td className="px-4 py-2 font-medium text-ds-text">{plan.development_goal}</td>
                                      <td className="px-4 py-2 text-ds-muted">{plan.action_plan}</td>
                                      <td className="px-4 py-2 text-ds-muted">{plan.duration}</td>
                                      <td className="px-4 py-2 text-ds-faint">{plan.notes || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </CardBody>
                    </Card>
                  );
                })}
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
