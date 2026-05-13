import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { percentageToScore5, percentageToRating } from '../../lib/scoring';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ModernSelect } from '../../components/ui/ModernSelect';
import {
  FileX, ChevronDown, ChevronUp, Calendar, BarChart3, Users, TrendingUp, Award, MessageSquare,
} from 'lucide-react';

const quarterLabels: Record<number, string> = {
  1: 'الربع الأول',
  2: 'الربع الثاني',
  3: 'الربع الثالث',
  4: 'الربع الرابع',
};

const ratingVariant = (rating: string): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
    'ممتاز': 'success',
    'جيد جدًا': 'info',
    'جيد': 'warning',
    'يحتاج تحسين': 'danger',
  };
  return map[rating] || 'default';
};

interface CeoEvaluation {
  id: string;
  total_score: number;
  percentage: number;
  evaluator_note: string | null;
  quarter: number;
  year: number;
  created_at: string;
}

interface CeoScoreDetail {
  id: string;
  score_1_to_5: number;
  weighted_result: number;
  criterion: {
    title: string;
    weight: number;
  };
}

export const MyCeoEvaluations: React.FC = () => {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<CeoEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, CeoScoreDetail[]>>({});
  const [scoresLoading, setScoresLoading] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<number>(0);
  const [filterQuarter, setFilterQuarter] = useState<number>(0);

  useEffect(() => {
    if (user) fetchEvaluations();
  }, [user]);

  const fetchEvaluations = async () => {
    if (!user) return;

    // Direct query instead of the legacy `get_ceo_evaluations_anonymous`
    // RPC. Two reasons:
    //   1) The RPC filtered by `ce.ceo_id = p_ceo_id`, but the collective
    //      migration switched submissions to `ceo_id IS NULL` — so the
    //      old RPC version returns zero rows in any DB where the update
    //      migration hasn't run.
    //   2) The RPC's row shape exposed `final_score_5` but the page
    //      stores it under `total_score`; reading directly lets us map
    //      the field in one place.
    // RLS policy `ceo_read_collective_ceo_eval` (migration
    // 20260427002000) permits CEO users to read collective rows.
    // `ceo_evaluation_scores!inner(id)` forces an INNER join, so only
    // evaluations that actually have at least one criterion score come
    // back. Hides orphan parent rows that the legacy save flow created
    // before the score insert was wired up (status='تم الإرسال' with
    // no underlying scores), which would otherwise expand to an empty
    // "لا توجد تفاصيل" card.
    const { data, error } = await supabase
      .from('ceo_evaluations')
      .select(`
        id, final_score_5, percentage, evaluator_note, created_at,
        period:ceo_evaluation_periods(quarter, year),
        scores:ceo_evaluation_scores!inner(id)
      `)
      .is('ceo_id', null)
      .eq('status', 'تم الإرسال')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching CEO evaluations:', error);
      setLoading(false);
      return;
    }

    const flat: CeoEvaluation[] = ((data || []) as any[]).map(r => ({
      id: r.id,
      total_score: Number(r.final_score_5) || 0,
      percentage: Number(r.percentage) || 0,
      evaluator_note: r.evaluator_note,
      quarter: r.period?.quarter ?? 0,
      year: r.period?.year ?? 0,
      created_at: r.created_at,
    }));

    setEvaluations(flat);
    setLoading(false);
  };

  const toggleExpand = async (evalId: string) => {
    if (expandedId === evalId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(evalId);

    if (!scores[evalId]) {
      setScoresLoading(evalId);
      try {
        const { data } = await supabase
          .from('ceo_evaluation_scores')
          .select(`
            id, score_1_to_5, weighted_result,
            criterion:ceo_evaluation_criteria(title, weight)
          `)
          .eq('evaluation_id', evalId);

        setScores(prev => ({
          ...prev,
          [evalId]: (data || []) as unknown as CeoScoreDetail[],
        }));
      } catch (error) {
        console.error('Error fetching scores:', error);
      } finally {
        setScoresLoading(null);
      }
    }
  };

  const filtered = evaluations.filter(e => {
    if (filterYear && e.year !== filterYear) return false;
    if (filterQuarter && e.quarter !== filterQuarter) return false;
    return true;
  });

  const avgScore = filtered.length > 0
    ? filtered.reduce((sum, e) => sum + (e.total_score || 0), 0) / filtered.length
    : 0;

  const avgPercentage = filtered.length > 0
    ? filtered.reduce((sum, e) => sum + (e.percentage || 0), 0) / filtered.length
    : 0;

  const avgRating = avgPercentage > 0 ? percentageToRating(avgPercentage) : '—';

  const ratingDistribution = filtered.reduce<Record<string, number>>((acc, e) => {
    const rating = percentageToRating(e.percentage);
    acc[rating] = (acc[rating] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="page-loading-placeholder" aria-hidden="true" />
    );
  }

  return (
    <div className="space-y-6">
      <div
        className="rounded-ds-xl p-4 sm:p-5 lg:p-8"
        style={{
          background: 'var(--sc-amber-grad)',
          border: '1px solid var(--sc-amber-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--sc-amber-val)' }}>تقييماتي من الموظفين</h1>
        <p className="mt-2" style={{ color: 'var(--sc-amber-label)' }}>تقييمات أداء الإدارة العليا من قبل الموظفين — بشكل مجهول</p>
      </div>

      {/* Filters */}
      <Card>
        <CardBody className="flex items-center gap-4 flex-wrap py-3">
          <Calendar className="h-5 w-5 text-ds-faint" />
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-ds-muted">السنة:</label>
            <ModernSelect
              value={String(filterYear)}
              onChange={(v) => { setFilterYear(Number(v)); setFilterQuarter(0); }}
              ariaLabel="السنة"
              className="min-w-[140px]"
              options={[
                { value: '0', label: 'الكل' },
                ...[...new Set(evaluations.map(e => e.year).filter(Boolean))]
                  .sort((a, b) => b - a)
                  .map(y => ({ value: String(y), label: String(y) })),
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-ds-muted">الربع:</label>
            <ModernSelect
              value={String(filterQuarter)}
              onChange={(v) => setFilterQuarter(Number(v))}
              ariaLabel="الربع"
              disabled={filterYear === 0}
              className="min-w-[260px]"
              options={[
                { value: '0', label: 'الكل' },
                ...Object.entries(quarterLabels).map(([q, label]) => ({ value: q, label })),
              ]}
            />
          </div>
          {(filterYear !== 0 || filterQuarter !== 0) && (
            <button
              onClick={() => { setFilterYear(0); setFilterQuarter(0); }}
              className="text-xs text-ds-accent hover:underline"
            >
              مسح الفلتر
            </button>
          )}
        </CardBody>
      </Card>

      {/* Summary Stats */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardBody className="text-center py-4">
              <Users className="h-6 w-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-ds-text">{filtered.length}</p>
              <p className="text-sm text-ds-faint">عدد التقييمات</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center py-4">
              <TrendingUp className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-ds-text">{avgScore.toFixed(2)} / 5</p>
              <p className="text-sm text-ds-faint">متوسط الدرجة</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center py-4">
              <BarChart3 className="h-6 w-6 text-purple-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-ds-text">{avgPercentage.toFixed(1)}%</p>
              <p className="text-sm text-ds-faint">متوسط النسبة</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center py-4">
              <Badge variant={ratingVariant(avgRating)} size="sm">
                {avgRating}
              </Badge>
              <p className="text-sm text-ds-faint mt-2">التقييم العام</p>
              <div className="mt-2 space-y-1">
                {Object.entries(ratingDistribution).map(([rating, count]) => (
                  <div key={rating} className="flex items-center justify-between text-xs px-2">
                    <Badge variant={ratingVariant(rating)} size="sm">{rating}</Badge>
                    <span className="text-ds-muted">{count}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Evaluations List */}
      {filtered.length === 0 ? (
        <Card>
          <CardBody className="text-center py-16">
            <FileX className="h-16 w-16 text-ds-faint mx-auto mb-4" />
            <p className="text-ds-faint text-lg">
              {evaluations.length === 0
                ? 'لا توجد تقييمات حالياً'
                : 'لا توجد تقييمات للفترة المحددة'}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((ev, index) => {
            const rating = percentageToRating(ev.percentage);
            const score5 = percentageToScore5(ev.percentage);
            const isExpanded = expandedId === ev.id;

            return (
              <Card key={ev.id} className="overflow-hidden">
                <button
                  onClick={() => toggleExpand(ev.id)}
                  className="w-full text-right"
                >
                  <div className={`px-6 py-5 flex items-center gap-5 transition-colors ${isExpanded ? 'bg-ds-overlay' : 'hover:bg-ds-bg'}`}>
                    {isExpanded
                      ? <ChevronUp className="h-5 w-5 text-ds-faint flex-shrink-0" />
                      : <ChevronDown className="h-5 w-5 text-ds-faint flex-shrink-0" />}

                    <div className="flex-1 flex items-center justify-between gap-4 min-w-0">
                      {/* RTL right side — identity tile */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-ds-info-bg border border-ds-info-border flex items-center justify-center flex-shrink-0">
                          <span className="font-extrabold text-ds-info-text text-sm">#{index + 1}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-ds-text text-base flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-ds-faint" />
                            {quarterLabels[ev.quarter]} {ev.year}
                          </p>
                          <p className="text-xs text-ds-faint mt-0.5">تقييم مجهول من أحد الموظفين</p>
                        </div>
                      </div>

                      {/* RTL left side — figures + rating badge */}
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-left">
                          <p className="text-2xl font-extrabold text-ds-text leading-none">
                            {ev.percentage?.toFixed(1)}%
                          </p>
                          <p className="text-xs text-ds-faint mt-1">{score5.toFixed(2)} / 5</p>
                        </div>
                        <Badge variant={ratingVariant(rating)} size="md">{rating}</Badge>
                      </div>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-ds-border bg-ds-bg">
                    {scoresLoading === ev.id ? (
                      <div className="page-loading-placeholder" aria-hidden="true" />
                    ) : (
                      <>
                        {/* Stat-card row mirrors the look of the other
                            evaluation detail pages so the CEO gets the
                            same three-tile summary at a glance. */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-6 py-5">
                          <div className="bg-ds-surface rounded-xl p-4 border border-ds-border flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-ds-info-bg flex items-center justify-center flex-shrink-0">
                              <TrendingUp className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                              <p className="text-xs text-ds-faint">النسبة المئوية</p>
                              <p className="font-bold text-ds-text text-lg">{ev.percentage?.toFixed(1)}%</p>
                            </div>
                          </div>
                          <div className="bg-ds-surface rounded-xl p-4 border border-ds-border flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-ds-success-bg flex items-center justify-center flex-shrink-0">
                              <BarChart3 className="h-5 w-5 text-emerald-500" />
                            </div>
                            <div>
                              <p className="text-xs text-ds-faint">الدرجة</p>
                              <p className="font-bold text-ds-text text-lg">{score5.toFixed(2)} / 5</p>
                            </div>
                          </div>
                          <div className="bg-ds-surface rounded-xl p-4 border border-ds-border flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-ds-warning-bg flex items-center justify-center flex-shrink-0">
                              <Award className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                              <p className="text-xs text-ds-faint">التقدير</p>
                              <Badge variant={ratingVariant(rating)} size="md">{rating}</Badge>
                            </div>
                          </div>
                        </div>

                        {/* Criterion scores */}
                        {scores[ev.id] && scores[ev.id].length > 0 ? (
                          <div className="px-6 pb-5">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                              <h4 className="text-sm font-bold text-ds-text">تفاصيل معايير التقييم</h4>
                            </div>
                            <div className="space-y-2">
                              {scores[ev.id].map(score => {
                                const pct = (Number(score.score_1_to_5) / 5) * 100;
                                const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
                                return (
                                  <div
                                    key={score.id}
                                    className="bg-ds-surface rounded-xl p-4 border border-ds-border"
                                  >
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-ds-text truncate">
                                          {score.criterion?.title || '—'}
                                        </p>
                                        <p className="text-xs text-ds-faint mt-0.5">
                                          الوزن: {score.criterion?.weight || 0}%
                                          {score.weighted_result != null && (
                                            <> · المرجحة: {score.weighted_result.toFixed(1)}</>
                                          )}
                                        </p>
                                      </div>
                                      <div className="text-left flex-shrink-0">
                                        <p className="font-bold text-ds-text text-base">
                                          {score.score_1_to_5}
                                          <span className="text-xs text-ds-faint font-normal mr-1">/ 5</span>
                                        </p>
                                      </div>
                                    </div>
                                    <div className="h-1.5 w-full bg-ds-track rounded-full overflow-hidden">
                                      <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-center text-ds-faint py-6 px-6">
                            لا توجد تفاصيل درجات لهذا التقييم
                          </p>
                        )}

                        {/* Evaluator note */}
                        {ev.evaluator_note && (
                          <div className="px-6 pb-5">
                            <div className="bg-ds-info-bg border border-ds-info-border rounded-xl p-4">
                              <div className="flex items-center gap-2 mb-1">
                                <MessageSquare className="h-4 w-4 text-blue-500" />
                                <p className="text-xs font-bold text-ds-info-text">ملاحظات المقيّم</p>
                              </div>
                              <p className="text-sm text-ds-info-text leading-relaxed">{ev.evaluator_note}</p>
                            </div>
                          </div>
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
