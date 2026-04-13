import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Crown, Filter, ChevronDown, ChevronUp, Users, BarChart3 } from 'lucide-react';
import { percentageToRating, percentageToScore5 } from '../../lib/scoring';

const quarterLabels: Record<number, string> = {
  1: 'الربع الأول',
  2: 'الربع الثاني',
  3: 'الربع الثالث',
  4: 'الربع الرابع',
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

const getStatusVariant = (status: string): 'success' | 'warning' | 'default' => {
  switch (status) {
    case 'تم الإرسال': return 'success';
    case 'مسودة': return 'warning';
    default: return 'default';
  }
};

const getStatusLabel = (status: string): string => {
  if (status === 'تم الإرسال') return 'تم الإرسال';
  if (status === 'مسودة') return 'مسودة';
  return status || 'بانتظار التقييم';
};

interface CeoPeriod {
  id: string;
  year: number;
  quarter: number;
  status: string;
}

interface CeoUser {
  id: string;
  full_name: string;
}

interface CeoEvaluation {
  id: string;
  ceo_id: string;
  evaluator_id: string;
  period_id: string;
  status: string;
  final_score_500: number;
  final_score_5: number;
  percentage: number;
  general_rating: string | null;
  evaluator_note: string | null;
  submitted_at: string | null;
  ceo: { full_name: string } | null;
  evaluator: { full_name: string } | null;
  period: { year: number; quarter: number } | null;
}

interface CriterionScore {
  criterion_title: string;
  criterion_description: string;
  criterion_weight: number;
  score: number;
  weighted_result: number;
}

export const AllCeoEvaluations: React.FC = () => {
  const { } = useAuth();

  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState<CeoEvaluation[]>([]);
  const [periods, setPeriods] = useState<CeoPeriod[]>([]);
  const [ceoUsers, setCeoUsers] = useState<CeoUser[]>([]);

  // Filters
  const [filterCeo, setFilterCeo] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');

  // Expandable rows
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [expandedScores, setExpandedScores] = useState<CriterionScore[]>([]);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);

  const fetchFilters = useCallback(async () => {
    const [{ data: periodsData }, { data: ceosData }] = await Promise.all([
      supabase.from('ceo_evaluation_periods').select('*').order('year', { ascending: false }).order('quarter', { ascending: false }),
      supabase.from('users').select('id, full_name').eq('role', 'ceo'),
    ]);
    setPeriods(periodsData || []);
    setCeoUsers(ceosData || []);
  }, []);

  const fetchEvaluations = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('ceo_evaluations')
      .select(`
        id, ceo_id, evaluator_id, period_id, status, final_score_500, final_score_5, percentage, general_rating,
        evaluator_note, submitted_at,
        ceo:users!ceo_evaluations_ceo_id_fkey(full_name),
        evaluator:users!ceo_evaluations_evaluator_id_fkey(full_name),
        period:ceo_evaluation_periods(year, quarter)
      `)
      .order('created_at', { ascending: false });

    if (filterCeo) query = query.eq('ceo_id', filterCeo);
    if (filterPeriod) query = query.eq('period_id', filterPeriod);

    const { data } = await query;
    setEvaluations((data as unknown as CeoEvaluation[]) || []);
    setLoading(false);
  }, [filterCeo, filterPeriod]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchEvaluations();
  }, [fetchEvaluations]);

  const resetFilters = () => {
    setFilterCeo('');
    setFilterPeriod('');
  };

  // Summary stats
  const summaryStats = useMemo(() => {
    const submitted = evaluations.filter(e => e.status === 'تم الإرسال');
    const totalEvaluations = evaluations.length;
    const submissionRate = totalEvaluations > 0
      ? ((submitted.length / totalEvaluations) * 100).toFixed(0)
      : '0';

    // Average score per CEO
    const ceosMap = new Map<string, { name: string; totalPercentage: number; count: number }>();
    submitted.forEach(ev => {
      const ceoName = ev.ceo?.full_name || 'غير معروف';
      if (!ceosMap.has(ev.ceo_id)) {
        ceosMap.set(ev.ceo_id, { name: ceoName, totalPercentage: 0, count: 0 });
      }
      const entry = ceosMap.get(ev.ceo_id)!;
      entry.totalPercentage += ev.percentage || 0;
      entry.count += 1;
    });

    const ceoAverages = Array.from(ceosMap.values()).map(c => ({
      name: c.name,
      avgPercentage: c.count > 0 ? c.totalPercentage / c.count : 0,
    }));

    const overallAvg = submitted.length > 0
      ? submitted.reduce((sum, e) => sum + (e.percentage || 0), 0) / submitted.length
      : 0;

    return { totalEvaluations, submissionRate, ceoAverages, overallAvg };
  }, [evaluations]);

  const toggleExpandRow = async (evalId: string) => {
    if (expandedRow === evalId) {
      setExpandedRow(null);
      setExpandedScores([]);
      setExpandedNote(null);
      return;
    }

    setExpandLoading(true);
    setExpandedRow(evalId);

    const ev = evaluations.find(e => e.id === evalId);

    const { data: scores } = await supabase
      .from('ceo_evaluation_scores')
      .select(`
        score_1_to_5, weighted_result,
        criterion:ceo_evaluation_criteria(title, description, weight)
      `)
      .eq('evaluation_id', evalId);

    const criterionScores: CriterionScore[] = (scores || []).map((s: any) => ({
      criterion_title: s.criterion?.title || '',
      criterion_description: s.criterion?.description || '',
      criterion_weight: s.criterion?.weight || 0,
      score: s.score_1_to_5,
      weighted_result: s.weighted_result,
    }));

    setExpandedScores(criterionScores);
    setExpandedNote(ev?.evaluator_note || null);
    setExpandLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">تقييمات الإدارة العليا</h1>
        <p className="text-gray-600 mt-2">جميع تقييمات الموظفين للإدارة العليا</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">إجمالي التقييمات</p>
                <p className="text-2xl font-bold text-gray-900">{summaryStats.totalEvaluations}</p>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Crown className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">متوسط النتيجة العام</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summaryStats.overallAvg > 0 ? `${summaryStats.overallAvg.toFixed(0)}%` : '-'}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">نسبة الإرسال</p>
                <p className="text-2xl font-bold text-gray-900">{summaryStats.submissionRate}%</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Per-CEO average scores */}
      {summaryStats.ceoAverages.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {summaryStats.ceoAverages.map((ceo, i) => (
            <Card key={i}>
              <CardBody className="py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{ceo.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-900">{ceo.avgPercentage.toFixed(0)}%</span>
                    <Badge variant={getRatingVariant(percentageToRating(ceo.avgPercentage))} size="sm">
                      {percentageToRating(ceo.avgPercentage)}
                    </Badge>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-gray-500">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">تصفية:</span>
            </div>
            <select
              value={filterCeo}
              onChange={(e) => setFilterCeo(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">جميع المدراء التنفيذيين</option>
              {ceoUsers.map(c => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">جميع الفترات</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>{quarterLabels[p.quarter]} {p.year}</option>
              ))}
            </select>
            {(filterCeo || filterPeriod) && (
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
      ) : (
        <Card>
          <CardBody className="p-0">
            {evaluations.length === 0 ? (
              <EmptyState
                message="لا توجد تقييمات للإدارة العليا"
                icon={<Crown className="h-12 w-12 text-gray-400" />}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المُقيّم</TableHead>
                    <TableHead>المُقيَّم</TableHead>
                    <TableHead>الفترة</TableHead>
                    <TableHead>النتيجة</TableHead>
                    <TableHead>النسبة</TableHead>
                    <TableHead>التقدير</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>التفاصيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluations.map(ev => (
                    <React.Fragment key={ev.id}>
                      <TableRow>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                              {ev.evaluator?.full_name?.charAt(0) || '?'}
                            </div>
                            <span className="font-medium text-gray-900">{ev.evaluator?.full_name || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                              {ev.ceo?.full_name?.charAt(0) || '?'}
                            </div>
                            <span className="font-medium text-gray-900">{ev.ceo?.full_name || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {ev.period && (
                            <span className="text-sm text-gray-700">{quarterLabels[ev.period.quarter]} {ev.period.year}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-gray-900">{ev.final_score_5?.toFixed(2)}/5</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-gray-900">{ev.percentage?.toFixed(0)}%</span>
                        </TableCell>
                        <TableCell>
                          {ev.general_rating ? (
                            <Badge variant={getRatingVariant(ev.general_rating)} size="sm">
                              {ev.general_rating}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(ev.status)} size="sm">
                            {getStatusLabel(ev.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleExpandRow(ev.id)}
                            className="flex items-center gap-1"
                          >
                            {expandedRow === ev.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <span>{expandedRow === ev.id ? 'إخفاء' : 'عرض'}</span>
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Expanded row */}
                      {expandedRow === ev.id && (
                        <TableRow>
                          <TableCell colSpan={8}>
                            {expandLoading ? (
                              <div className="flex items-center justify-center py-6">
                                <div className="text-gray-500">جاري التحميل...</div>
                              </div>
                            ) : (
                              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                                {/* Criterion scores */}
                                {expandedScores.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-bold text-blue-700 mb-2">درجات المعايير</h4>
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
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                          {expandedScores.map((s, i) => (
                                            <tr key={i}>
                                              <td className="px-4 py-2">
                                                <p className="font-medium text-gray-900">{s.criterion_title}</p>
                                                {s.criterion_description && (
                                                  <p className="text-xs text-gray-500">{s.criterion_description}</p>
                                                )}
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

                                {/* Evaluator note */}
                                {expandedNote && (
                                  <div>
                                    <h4 className="text-sm font-bold text-gray-700 mb-1">ملاحظات المُقيّم</h4>
                                    <p className="text-sm text-gray-600 bg-white rounded-lg p-3 border">{expandedNote}</p>
                                  </div>
                                )}

                                {expandedScores.length === 0 && !expandedNote && (
                                  <p className="text-sm text-gray-400 text-center py-4">لا توجد تفاصيل متاحة</p>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
};
