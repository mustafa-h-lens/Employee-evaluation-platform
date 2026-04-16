import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
  Crown, ChevronDown, ChevronUp, Users, BarChart3, TrendingUp,
  Calendar, MessageSquare, FileX,
} from 'lucide-react';
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

export const AllCeoEvaluations: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState<CeoEvaluation[]>([]);
  const [periods, setPeriods] = useState<CeoPeriod[]>([]);
  const [ceoUsers, setCeoUsers] = useState<CeoUser[]>([]);

  // Filters
  const [activeCeoId, setActiveCeoId] = useState('');
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
    // Auto-select first CEO tab
    if (ceosData && ceosData.length > 0) {
      setActiveCeoId(ceosData[0].id);
    }
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

    if (filterPeriod) query = query.eq('period_id', filterPeriod);

    const { data } = await query;
    setEvaluations((data as unknown as CeoEvaluation[]) || []);
    setLoading(false);
  }, [filterPeriod]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchEvaluations();
  }, [fetchEvaluations]);

  // Filtered evaluations for active CEO tab
  const filtered = useMemo(() => {
    if (!activeCeoId) return evaluations;
    return evaluations.filter(e => e.ceo_id === activeCeoId);
  }, [evaluations, activeCeoId]);

  // Stats for the active CEO
  const ceoStats = useMemo(() => {
    const submitted = filtered.filter(e => e.status === 'تم الإرسال');
    const total = filtered.length;
    const avgPercentage = submitted.length > 0
      ? submitted.reduce((sum, e) => sum + (e.percentage || 0), 0) / submitted.length
      : 0;
    const avgScore5 = submitted.length > 0
      ? submitted.reduce((sum, e) => sum + (e.final_score_5 || 0), 0) / submitted.length
      : 0;
    const submissionRate = total > 0 ? ((submitted.length / total) * 100) : 0;

    const ratingDistribution = submitted.reduce<Record<string, number>>((acc, e) => {
      const rating = e.general_rating || percentageToRating(e.percentage);
      acc[rating] = (acc[rating] || 0) + 1;
      return acc;
    }, {});

    return { total, submitted: submitted.length, avgPercentage, avgScore5, submissionRate, ratingDistribution };
  }, [filtered]);

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

  // Get initials for avatar
  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts.length >= 2 ? parts[0].charAt(0) + parts[1].charAt(0) : parts[0].charAt(0);
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-3xl font-bold text-gray-900">تقييمات الإدارة العليا</h1>
          <p className="text-gray-600 mt-2">جميع تقييمات الموظفين للإدارة العليا</p>
        </div>
      )}

      {/* CEO Tabs */}
      {ceoUsers.length > 0 && (
        <div className="border-b border-gray-200">
          <nav className="flex gap-1 -mb-px">
            {ceoUsers.map(ceo => {
              const isActive = activeCeoId === ceo.id;
              const ceoSubmitted = evaluations.filter(e => e.ceo_id === ceo.id && e.status === 'تم الإرسال');
              const ceoAvg = ceoSubmitted.length > 0
                ? ceoSubmitted.reduce((s, e) => s + (e.percentage || 0), 0) / ceoSubmitted.length
                : 0;

              return (
                <button
                  key={ceo.id}
                  onClick={() => { setActiveCeoId(ceo.id); setExpandedRow(null); }}
                  className={`
                    relative flex items-center gap-3 px-6 py-3.5 text-sm font-semibold transition-all rounded-t-xl
                    ${isActive
                      ? 'bg-white text-blue-700 border border-gray-200 border-b-white shadow-sm -mb-px z-10'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}
                  `}>
                    {getInitials(ceo.full_name)}
                  </div>
                  <span>{ceo.full_name}</span>
                  {ceoAvg > 0 && (
                    <Badge variant={getRatingVariant(percentageToRating(ceoAvg))} size="sm">
                      {ceoAvg.toFixed(0)}%
                    </Badge>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* Period Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <Calendar className="h-4 w-4 text-gray-400" />
        <select
          value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          <option value="">جميع الفترات</option>
          {periods.map(p => (
            <option key={p.id} value={p.id}>{quarterLabels[p.quarter]} {p.year}</option>
          ))}
        </select>
        {filterPeriod && (
          <button
            onClick={() => setFilterPeriod('')}
            className="text-xs text-blue-600 hover:underline"
          >
            مسح الفلتر
          </button>
        )}
      </div>

      {/* Stats Cards for Active CEO */}
      {ceoStats.submitted > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardBody className="text-center py-4">
              <Users className="h-6 w-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{ceoStats.total}</p>
              <p className="text-sm text-gray-500">عدد التقييمات</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center py-4">
              <TrendingUp className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{ceoStats.avgScore5.toFixed(2)} / 5</p>
              <p className="text-sm text-gray-500">متوسط الدرجة</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center py-4">
              <BarChart3 className="h-6 w-6 text-purple-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{ceoStats.avgPercentage.toFixed(1)}%</p>
              <p className="text-sm text-gray-500">متوسط النسبة</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center py-4">
              <Badge variant={getRatingVariant(percentageToRating(ceoStats.avgPercentage))} size="sm">
                {percentageToRating(ceoStats.avgPercentage)}
              </Badge>
              <p className="text-sm text-gray-500 mt-2">التقييم العام</p>
              <div className="mt-2 space-y-1">
                {Object.entries(ceoStats.ratingDistribution).map(([rating, count]) => (
                  <div key={rating} className="flex items-center justify-between text-xs px-2">
                    <Badge variant={getRatingVariant(rating)} size="sm">{rating}</Badge>
                    <span className="text-gray-600">{count}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Evaluations List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardBody className="text-center py-16">
            <FileX className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">لا توجد تقييمات</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((ev, index) => {
            const rating = ev.general_rating || percentageToRating(ev.percentage);
            const score5 = ev.final_score_5 || percentageToScore5(ev.percentage);
            const isExpanded = expandedRow === ev.id;

            return (
              <Card key={ev.id} className="overflow-hidden">
                <button
                  onClick={() => toggleExpandRow(ev.id)}
                  className="w-full text-right"
                >
                  <div className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    {/* Left side - chevron + rating */}
                    <div className="flex items-center gap-3">
                      <Badge variant={getRatingVariant(rating)}>
                        {rating}
                      </Badge>
                      <Badge variant={getStatusVariant(ev.status)} size="sm">
                        {getStatusLabel(ev.status)}
                      </Badge>
                      {isExpanded
                        ? <ChevronUp className="h-5 w-5 text-gray-400" />
                        : <ChevronDown className="h-5 w-5 text-gray-400" />}
                    </div>

                    {/* Right side - info */}
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-lg text-gray-900">
                        {ev.percentage?.toFixed(1)}%
                      </span>
                      <span className="text-gray-300">|</span>
                      <span className="text-sm font-semibold text-blue-600">
                        {score5.toFixed(2)} / 5
                      </span>
                      <span className="text-gray-300">|</span>
                      {ev.period && (
                        <>
                          <span className="text-gray-700 font-medium text-sm">
                            {quarterLabels[ev.period.quarter]} {ev.period.year}
                          </span>
                          <span className="text-gray-300">|</span>
                        </>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">
                          {getInitials(ev.evaluator?.full_name)}
                        </div>
                        <span className="text-gray-700 text-sm font-medium">{ev.evaluator?.full_name || '-'}</span>
                      </div>
                      {ev.evaluator_note && (
                        <MessageSquare className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 space-y-4">
                    {expandLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : (
                      <>
                        {/* Criterion Scores */}
                        {expandedScores.length > 0 && (
                          <div>
                            <h4 className="text-sm font-bold text-blue-800 mb-3">تفاصيل معايير التقييم</h4>
                            <div className="space-y-2">
                              {expandedScores.map((s, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200"
                                >
                                  <div>
                                    <p className="font-medium text-gray-900">{s.criterion_title}</p>
                                    {s.criterion_description && (
                                      <p className="text-xs text-gray-500 mt-0.5">{s.criterion_description}</p>
                                    )}
                                    <p className="text-xs text-gray-400 mt-0.5">الوزن: {s.criterion_weight}%</p>
                                  </div>
                                  <div className="text-left">
                                    <p className="font-semibold text-blue-600">{s.score} / 5</p>
                                    {s.weighted_result != null && (
                                      <p className="text-xs text-gray-500">المرجحة: {s.weighted_result.toFixed(1)}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Evaluator Note */}
                        {expandedNote && (
                          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                            <p className="text-xs font-medium text-blue-700 mb-1">ملاحظات المُقيّم</p>
                            <p className="text-sm text-blue-900 leading-relaxed">{expandedNote}</p>
                          </div>
                        )}

                        {expandedScores.length === 0 && !expandedNote && (
                          <p className="text-sm text-gray-400 text-center py-4">لا توجد تفاصيل متاحة</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
