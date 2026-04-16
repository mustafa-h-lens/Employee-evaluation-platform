import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Crown, Users, Eye, Filter, Star, Shield, ArrowUp } from 'lucide-react';
import { percentageToRating } from '../../lib/scoring';
import { AllCeoEvaluations } from './AllCeoEvaluations';

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
    case 'موافقة': case 'اطلع الموظف': case 'اطلع المدير': case 'مغلق': case 'مكتمل': return 'success';
    case 'مرفوض': return 'danger';
    default: return 'default';
  }
};

const getStatusLabel = (status: string, context?: string): string => {
  if (!status || status === 'مسودة') return 'بانتظار التقييم';
  if (status === 'تم الإرسال' && context === 'ceo') return 'بانتظار تقييم الشريك';
  if (status === 'تم الإرسال') return 'بانتظار الموافقة';
  if (status === 'بانتظار الموافقة') return 'بانتظار الموافقة';
  if (['موافقة', 'اطلع الموظف', 'اطلع المدير', 'مغلق', 'مكتمل'].includes(status)) return 'تم اعتماد التقييم';
  if (status === 'مرفوض') return 'التقييم مرفوض';
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
  directorate_id: string | null;
}

interface DirectorateFilter {
  id: string;
  name: string;
  director_id: string | null;
  secondary_director_id: string | null;
}

interface DirectorEval {
  id: string;
  director_id: string;
  period_id: string;
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

interface EvalItem {
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

interface SupervisorEval {
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

type TabType = 'ceo' | 'directors' | 'supervisors' | 'ceo-eval';

export const AllEvaluations: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('ceo');
  const [loading, setLoading] = useState(true);

  // Data
  const [directorEvals, setDirectorEvals] = useState<DirectorEval[]>([]);
  const [employeeEvals, setEmployeeEvals] = useState<EvalItem[]>([]);
  const [supervisorEvals, setSupervisorEvals] = useState<SupervisorEval[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [directoratesFilter, setDirectoratesFilter] = useState<DirectorateFilter[]>([]);

  // Filters
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterDirectorate, setFilterDirectorate] = useState('');

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
    const [{ data: periodsData }, { data: deptsData }, { data: dirsData }] = await Promise.all([
      supabase.from('evaluation_periods').select('id, year, month').order('year', { ascending: false }).order('month', { ascending: false }),
      supabase.from('departments').select('id, name, directorate_id').order('name'),
      supabase.from('directorates').select('id, name, director_id, secondary_director_id').order('name'),
    ]);
    setPeriods(periodsData || []);
    setDepartments(deptsData || []);
    setDirectoratesFilter((dirsData as DirectorateFilter[]) || []);
  }, []);

  const fetchDirectorEvals = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('director_evaluations')
      .select(`
        id, director_id, period_id, status, final_score_500, final_score_5, percentage, general_rating,
        evaluator_note, director_note, submitted_at,
        director:users!director_evaluations_director_id_fkey(id, full_name, email, job_title),
        evaluator:users!director_evaluations_evaluator_id_fkey(full_name),
        period:evaluation_periods(year, month)
      `)
      .order('created_at', { ascending: false });

    if (filterPeriod) query = query.eq('period_id', filterPeriod);

    if (filterDirectorate) {
      const dir = directoratesFilter.find(d => d.id === filterDirectorate);
      if (dir) {
        const directorIds = [dir.director_id, dir.secondary_director_id].filter(Boolean) as string[];
        if (directorIds.length > 0) {
          query = query.in('director_id', directorIds);
        }
      }
    }

    const { data } = await query;
    setDirectorEvals((data as unknown as DirectorEval[]) || []);
    setLoading(false);
  }, [filterPeriod, filterDirectorate, directoratesFilter]);

  const fetchEmployeeEvals = useCallback(async () => {
    setLoading(true);

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

    if (filterPeriod) query = query.eq('period_id', filterPeriod);
    if (filterDirectorate) {
      const deptIds = departments.filter(d => d.directorate_id === filterDirectorate).map(d => d.id);
      if (deptIds.length > 0) {
        query = query.in('department_id', deptIds);
      } else {
        // No departments under this directorate — return empty
        setEmployeeEvals([]);
        setLoading(false);
        return;
      }
    }

    const { data } = await query;

    setEmployeeEvals((data as unknown as EvalItem[]) || []);
    setLoading(false);
  }, [filterPeriod, filterDirectorate, departments]);

  const fetchSupervisorEvals = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('supervisor_evaluations')
      .select(`
        id, status, final_score_500, final_score_5, percentage, general_rating,
        supervisor_note, employee_note, submitted_at,
        supervisor:users!supervisor_evaluations_supervisor_id_fkey(full_name),
        employee:employees!supervisor_evaluations_employee_id_fkey(full_name, job_title, employee_number),
        period:evaluation_periods(year, month)
      `)
      .order('created_at', { ascending: false });

    if (filterPeriod) query = query.eq('period_id', filterPeriod);

    const { data } = await query;
    setSupervisorEvals((data as unknown as SupervisorEval[]) || []);
    setLoading(false);
  }, [filterPeriod]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    if (activeTab === 'ceo') {
      fetchDirectorEvals();
    } else if (activeTab === 'directors') {
      fetchEmployeeEvals();
    } else if (activeTab === 'supervisors') {
      fetchSupervisorEvals();
    }
    // 'ceo-eval' tab is handled by embedded AllCeoEvaluations component
  }, [activeTab, fetchDirectorEvals, fetchEmployeeEvals, fetchSupervisorEvals]);

  const resetFilters = () => {
    setFilterPeriod('');
    setFilterDepartment('');
    setFilterDirectorate('');
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

  const viewEvalDetail = async (ev: EvalItem) => {
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

  const viewSupervisorDetail = async (ev: SupervisorEval) => {
    setDetailLoading(true);
    setDetailModal(true);

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

    setDetailData({
      name: ev.employee?.full_name || '',
      jobTitle: ev.employee?.job_title || '',
      period: ev.period ? `${monthLabels[ev.period.month]} ${ev.period.year}` : '',
      scores: scoreDetails,
      finalScore500: ev.final_score_500,
      finalScore5: ev.final_score_5,
      percentage: ev.percentage,
      generalRating: ev.general_rating,
      evaluatorNote: ev.supervisor_note,
      subjectNote: ev.employee_note,
      status: ev.status,
    });
    setDetailLoading(false);
  };

  // Group director evaluations by director+period for combined display
  const combinedDirectorEvals = useMemo(() => {
    const groups = new Map<string, DirectorEval[]>();
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

  const viewCombinedDirectorDetail = async (combined: { evals: DirectorEval[]; avg_percentage: number; avg_score_500: number; avg_score_5: number; avg_rating: string | null; director: DirectorEval['director']; period: DirectorEval['period'] }) => {
    setDetailLoading(true);
    setDetailModal(true);

    const allIds = combined.evals.map(e => e.id);
    const { data: scores } = await supabase
      .from('director_evaluation_scores')
      .select(`
        evaluation_id, score_1_to_5, weighted_result, criterion_type,
        criterion:evaluation_criteria(title, description, weight)
      `)
      .in('evaluation_id', allIds);

    const criterionMap = new Map<string, { totalScore: number; totalWeighted: number; count: number; title: string; desc: string; weight: number; type: string }>();
    (scores || []).forEach((s: any) => {
      const title = s.criterion?.title || '';
      const desc = s.criterion?.description || '';
      const weight = s.criterion?.weight || 0;
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

    const evaluatorNames = combined.evals.map(ev => `${ev.evaluator?.full_name} (${ev.percentage?.toFixed(0)}%)`).join(' | ');

    setDetailData({
      name: combined.director?.full_name || '',
      jobTitle: `${combined.director?.job_title || ''} — المقيّمون: ${evaluatorNames}`,
      period: combined.period ? `${monthLabels[combined.period.month]} ${combined.period.year}` : '',
      scores: scoreDetails,
      finalScore500: combined.avg_score_500,
      finalScore5: combined.avg_score_5,
      percentage: combined.avg_percentage,
      generalRating: combined.avg_rating,
      evaluatorNote: combined.evals.map(ev => ev.evaluator_note).filter(Boolean).join('\n---\n') || null,
      subjectNote: combined.evals.find(ev => ev.director_note)?.director_note || null,
      status: combined.status,
    });
    setDetailLoading(false);
  };

  const generalScores = detailData?.scores.filter(s => s.type === 'general') || [];
  const specificScores = detailData?.scores.filter(s => s.type === 'specific') || [];

  const tabs: { key: TabType; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'ceo', label: 'تقييمات الإدارة العليا', icon: <Crown className="h-4 w-4" />, color: 'amber' },
    { key: 'directors', label: 'تقييمات مدراء الإدارات', icon: <Users className="h-4 w-4" />, color: 'blue' },
    { key: 'supervisors', label: 'تقييمات المشرفين', icon: <Shield className="h-4 w-4" />, color: 'emerald' },
    { key: 'ceo-eval', label: 'تقييمات الموظفين للرؤساء', icon: <ArrowUp className="h-4 w-4" />, color: 'rose' },
  ];

  const renderEvalTable = (evals: EvalItem[], emptyMessage: string) => (
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
                <TableHead>الإدارة</TableHead>
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
        <p className="text-gray-600 mt-2">عرض جميع تقييمات الإدارة العليا ومدراء الإدارات والمشرفين</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab.key
                ? tab.color === 'amber' ? 'border-amber-600 text-amber-600 bg-amber-50' : tab.color === 'blue' ? 'border-blue-600 text-blue-600 bg-blue-50' : tab.color === 'rose' ? 'border-rose-600 text-rose-600 bg-rose-50' : 'border-emerald-600 text-emerald-600 bg-emerald-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      {activeTab !== 'ceo-eval' && <Card>
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
            {activeTab === 'directors' && (
              <select
                value={filterDirectorate}
                onChange={(e) => setFilterDirectorate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">جميع الإدارات</option>
                {directoratesFilter.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
            {(filterPeriod || filterDepartment || filterDirectorate) && (
              <button
                onClick={resetFilters}
                className="text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                مسح الفلاتر
              </button>
            )}
          </div>
        </CardBody>
      </Card>}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-gray-500">جاري التحميل...</div>
        </div>
      ) : activeTab === 'ceo' ? (
        <Card>
          <CardBody className="p-0">
            {combinedDirectorEvals.length === 0 ? (
              <EmptyState
                message="لا توجد تقييمات من الإدارة العليا"
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
                    <TableHead>الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {combinedDirectorEvals.map(combined => (
                    <TableRow key={`${combined.director_id}_${combined.period_id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
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
                        <Badge variant={getStatusVariant(combined.status)} size="sm">{getStatusLabel(combined.status, 'ceo')}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => viewCombinedDirectorDetail(combined)} className="flex items-center gap-1">
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
      ) : activeTab === 'directors' ? (
        renderEvalTable(employeeEvals, 'لا توجد تقييمات من مدراء الإدارات')
      ) : activeTab === 'supervisors' ? (
        <Card>
          <CardBody className="p-0">
            {supervisorEvals.length === 0 ? (
              <EmptyState
                message="لا توجد تقييمات من المشرفين"
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
                    <TableHead>الإجراء</TableHead>
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
                        <Button size="sm" variant="outline" onClick={() => viewSupervisorDetail(ev)} className="flex items-center gap-1">
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
      ) : (
        <AllCeoEvaluations embedded />
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
