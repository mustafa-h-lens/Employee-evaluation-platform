import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Crown, Users, UserCheck, Eye, Filter, Star } from 'lucide-react';

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
    case 'بانتظار الموافقة': return 'warning';
    case 'موافقة': case 'تم الإرسال': case 'اطلع الموظف': case 'اطلع المدير': case 'مغلق': case 'مكتمل': return 'success';
    case 'مرفوض': return 'danger';
    default: return 'default';
  }
};

const getStatusLabel = (status: string): string => {
  if (status === 'بانتظار الموافقة') return 'بانتظار اعتماد التقييم';
  if (['موافقة', 'تم الإرسال', 'اطلع الموظف', 'اطلع المدير', 'مغلق', 'مكتمل'].includes(status)) return 'تم اعتماد التقييم';
  if (status === 'مرفوض') return 'مرفوض';
  if (!status || status === 'مسودة') return 'بانتظار التقييم';
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
}

interface DirectorEval {
  id: string;
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

interface ManagerEval {
  id: string;
  employee: { full_name: string; job_title: string; employee_number: string } | null;
  manager: { full_name: string } | null;
  department: { name: string } | null;
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

interface ScoreDetail {
  criterion_title: string;
  criterion_description: string;
  criterion_weight: number;
  score: number;
  weighted_result: number;
  type: 'general' | 'specific';
}

type TabType = 'directors' | 'managers' | 'employees';

export const AllEvaluations: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('managers');
  const [loading, setLoading] = useState(true);

  // Data
  const [directorEvals, setDirectorEvals] = useState<DirectorEval[]>([]);
  const [managerEvals, setManagerEvals] = useState<ManagerEval[]>([]);
  const [employeeEvals, setEmployeeEvals] = useState<ManagerEval[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Filters
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');

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
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchFilters = useCallback(async () => {
    const [{ data: periodsData }, { data: deptsData }] = await Promise.all([
      supabase.from('evaluation_periods').select('id, year, month').order('year', { ascending: false }).order('month', { ascending: false }),
      supabase.from('departments').select('id, name').order('name'),
    ]);
    setPeriods(periodsData || []);
    setDepartments(deptsData || []);
  }, []);

  const fetchDirectorEvals = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('director_evaluations')
      .select(`
        id, status, final_score_500, final_score_5, percentage, general_rating,
        evaluator_note, director_note, submitted_at,
        director:users!director_evaluations_director_id_fkey(id, full_name, email, job_title),
        evaluator:users!director_evaluations_evaluator_id_fkey(full_name),
        period:evaluation_periods(year, month)
      `)
      .order('created_at', { ascending: false });

    if (filterPeriod) query = query.eq('period_id', filterPeriod);

    const { data } = await query;
    setDirectorEvals((data as unknown as DirectorEval[]) || []);
    setLoading(false);
  }, [filterPeriod]);

  const fetchManagerEvals = useCallback(async () => {
    setLoading(true);

    // Fetch manager user IDs
    const { data: managerUsers } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'manager');
    const managerUserIds = (managerUsers || []).map((u: any) => u.id);

    // Fetch employee records that are linked to manager users
    const { data: managerEmployees } = await supabase
      .from('employees')
      .select('id')
      .in('user_id', managerUserIds);
    const managerEmployeeIds = (managerEmployees || []).map((e: any) => e.id);

    let query = supabase
      .from('evaluations')
      .select(`
        id, status, final_score_500, final_score_5, percentage, general_rating,
        manager_note, employee_note, submitted_at, department_id,
        employee:employees(full_name, job_title, employee_number),
        manager:users!evaluations_manager_id_fkey(full_name),
        department:departments(name),
        period:evaluation_periods(year, month)
      `)
      .order('created_at', { ascending: false });

    if (managerEmployeeIds.length > 0) {
      query = query.in('employee_id', managerEmployeeIds);
    } else {
      // No manager employees found, return empty
      setManagerEvals([]);
      setLoading(false);
      return;
    }

    if (filterPeriod) query = query.eq('period_id', filterPeriod);
    if (filterDepartment) query = query.eq('department_id', filterDepartment);

    const { data } = await query;
    setManagerEvals((data as unknown as ManagerEval[]) || []);
    setLoading(false);
  }, [filterPeriod, filterDepartment]);

  const fetchEmployeeEvals = useCallback(async () => {
    setLoading(true);

    // Get non-manager, non-director employee IDs
    const { data: nonEmployeeUsers } = await supabase
      .from('users')
      .select('id')
      .in('role', ['manager', 'director', 'ceo', 'admin']);
    const nonEmployeeUserIds = (nonEmployeeUsers || []).map((u: any) => u.id);

    let query = supabase
      .from('evaluations')
      .select(`
        id, status, final_score_500, final_score_5, percentage, general_rating,
        manager_note, employee_note, submitted_at, department_id,
        employee:employees(full_name, job_title, employee_number, user_id),
        manager:users!evaluations_manager_id_fkey(full_name),
        department:departments(name),
        period:evaluation_periods(year, month)
      `)
      .order('created_at', { ascending: false });

    if (filterPeriod) query = query.eq('period_id', filterPeriod);
    if (filterDepartment) query = query.eq('department_id', filterDepartment);

    const { data } = await query;

    // Filter client-side: only employees whose user_id is NOT a manager/director/ceo/admin
    const filtered = ((data as unknown as any[]) || []).filter((ev: any) => {
      if (!ev.employee?.user_id) return true;
      return !nonEmployeeUserIds.includes(ev.employee.user_id);
    });

    setEmployeeEvals(filtered as ManagerEval[]);
    setLoading(false);
  }, [filterPeriod, filterDepartment]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    if (activeTab === 'directors') {
      fetchDirectorEvals();
    } else if (activeTab === 'managers') {
      fetchManagerEvals();
    } else {
      fetchEmployeeEvals();
    }
  }, [activeTab, fetchDirectorEvals, fetchManagerEvals, fetchEmployeeEvals]);

  const resetFilters = () => {
    setFilterPeriod('');
    setFilterDepartment('');
  };

  const viewDirectorDetail = async (ev: DirectorEval) => {
    setDetailLoading(true);
    setDetailModal(true);

    const { data: scores } = await supabase
      .from('director_evaluation_scores')
      .select(`
        score_1_to_5, weighted_result, criterion_type,
        criterion:evaluation_criteria(title, description, weight)
      `)
      .eq('evaluation_id', ev.id);

    const scoreDetails: ScoreDetail[] = (scores || []).map((s: any) => ({
      criterion_title: s.criterion?.title || '',
      criterion_description: s.criterion?.description || '',
      criterion_weight: s.criterion?.weight || 0,
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

  const viewEvalDetail = async (ev: ManagerEval) => {
    setDetailLoading(true);
    setDetailModal(true);

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

  const generalScores = detailData?.scores.filter(s => s.type === 'general') || [];
  const specificScores = detailData?.scores.filter(s => s.type === 'specific') || [];

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'managers', label: 'تقييمات مدراء الأقسام', icon: <Users className="h-4 w-4" /> },
    { key: 'directors', label: 'تقييمات مدراء الإدارات', icon: <Crown className="h-4 w-4" /> },
    { key: 'employees', label: 'تقييمات الإدارة العليا', icon: <UserCheck className="h-4 w-4" /> },
  ];

  const renderEvalTable = (evals: ManagerEval[], emptyMessage: string) => (
    <Card>
      <CardBody className="p-0">
        {evals.length === 0 ? (
          <EmptyState
            message={emptyMessage}
            icon={<Users className="h-12 w-12 text-gray-400" />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الموظف</TableHead>
                <TableHead>القسم</TableHead>
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
                    <span className="text-sm text-gray-700">{ev.manager?.full_name || '-'}</span>
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
                    <Button size="sm" variant="outline" onClick={() => viewEvalDetail(ev)} className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      <span>عرض التفاصيل</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">جميع التقييمات</h1>
        <p className="text-gray-600 mt-2">عرض جميع تقييمات مديري الإدارات ومدراء الأقسام والموظفين</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
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
            <div className="flex items-center gap-2 text-gray-500">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">تصفية:</span>
            </div>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">جميع الفترات</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>{monthLabels[p.month]} {p.year}</option>
              ))}
            </select>
            {(activeTab === 'managers' || activeTab === 'employees') && (
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">جميع الأقسام</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
            {(filterPeriod || filterDepartment) && (
              <button
                onClick={resetFilters}
                className="text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                مسح الفلاتر
              </button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-gray-500">جاري التحميل...</div>
        </div>
      ) : activeTab === 'directors' ? (
        <Card>
          <CardBody className="p-0">
            {directorEvals.length === 0 ? (
              <EmptyState
                message="لا توجد تقييمات لمديري الإدارات"
                icon={<Crown className="h-12 w-12 text-gray-400" />}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>مدير الإدارة</TableHead>
                    <TableHead>المسمى الوظيفي</TableHead>
                    <TableHead>فترة التقييم</TableHead>
                    <TableHead>النتيجة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {directorEvals.map(ev => (
                    <TableRow key={ev.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                            {ev.director?.full_name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">{ev.director?.full_name}</span>
                            <p className="text-xs text-gray-500">{ev.director?.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 text-sm">{ev.director?.job_title || '-'}</span>
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
                        <Button size="sm" variant="outline" onClick={() => viewDirectorDetail(ev)} className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          <span>عرض التفاصيل</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      ) : activeTab === 'managers' ? (
        renderEvalTable(managerEvals, 'لا توجد تقييمات لمدراء الأقسام')
      ) : (
        renderEvalTable(employeeEvals, 'لا توجد تقييمات للموظفين')
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={detailModal}
        onClose={() => { setDetailModal(false); setDetailData(null); }}
        title={detailData ? `تفاصيل تقييم: ${detailData.name}` : 'تفاصيل التقييم'}
        size="lg"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">جاري التحميل...</div>
          </div>
        ) : detailData ? (
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900 text-lg">{detailData.name}</p>
                  <p className="text-sm text-gray-600">{detailData.jobTitle}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">فترة التقييم</p>
                  <p className="font-medium text-gray-900">{detailData.period}</p>
                </div>
              </div>
            </div>

            {/* Final Results */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 mb-1">النتيجة / 500</p>
                <p className="text-xl font-bold text-blue-700">{detailData.finalScore500?.toFixed(1)}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <p className="text-xs text-purple-600 mb-1">النتيجة / 5</p>
                <p className="text-xl font-bold text-purple-700">{detailData.finalScore5?.toFixed(2)}</p>
              </div>
              <div className="bg-teal-50 rounded-lg p-3 text-center">
                <p className="text-xs text-teal-600 mb-1">النسبة المئوية</p>
                <p className="text-xl font-bold text-teal-700">{detailData.percentage?.toFixed(0)}%</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-xs text-amber-600 mb-1">التقدير العام</p>
                {detailData.generalRating ? (
                  <Badge variant={getRatingVariant(detailData.generalRating)}>{detailData.generalRating}</Badge>
                ) : (
                  <span className="text-gray-400 text-sm">-</span>
                )}
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
            {(detailData.evaluatorNote || detailData.subjectNote) && (
              <div className="space-y-3">
                {detailData.evaluatorNote && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-xs font-medium text-blue-700 mb-1">ملاحظات المقيّم</p>
                    <p className="text-sm text-gray-800">{detailData.evaluatorNote}</p>
                  </div>
                )}
                {detailData.subjectNote && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs font-medium text-gray-700 mb-1">ملاحظات المُقيَّم</p>
                    <p className="text-sm text-gray-800">{detailData.subjectNote}</p>
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
