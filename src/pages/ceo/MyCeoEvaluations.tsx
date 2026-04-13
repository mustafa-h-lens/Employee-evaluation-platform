import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { percentageToScore5, percentageToRating } from '../../lib/scoring';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
  FileX, ChevronDown, ChevronUp, Calendar, BarChart3, Users, TrendingUp,
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
  score: number;
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

    const { data, error } = await supabase.rpc('get_ceo_evaluations_anonymous', {
      p_ceo_id: user.id,
    });

    if (error) {
      console.error('Error fetching CEO evaluations:', error);
      setLoading(false);
      return;
    }

    setEvaluations((data as CeoEvaluation[]) || []);
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
            id, score,
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
      <div className="flex items-center justify-center py-16">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">تقييماتي من الموظفين</h1>
        <p className="text-gray-600 mt-2">تقييمات أداء الإدارة العليا من قبل الموظفين — بشكل مجهول</p>
      </div>

      {/* Filters */}
      <Card>
        <CardBody className="flex items-center gap-4 flex-wrap py-3">
          <Calendar className="h-5 w-5 text-gray-400" />
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">السنة:</label>
            <select
              value={filterYear}
              onChange={e => { setFilterYear(Number(e.target.value)); setFilterQuarter(0); }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={0}>الكل</option>
              {[...new Set(evaluations.map(e => e.year).filter(Boolean))]
                .sort((a, b) => b - a)
                .map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">الربع:</label>
            <select
              value={filterQuarter}
              onChange={e => setFilterQuarter(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={filterYear === 0}
            >
              <option value={0}>الكل</option>
              {Object.entries(quarterLabels).map(([q, label]) => (
                <option key={q} value={q}>{label}</option>
              ))}
            </select>
          </div>
          {(filterYear !== 0 || filterQuarter !== 0) && (
            <button
              onClick={() => { setFilterYear(0); setFilterQuarter(0); }}
              className="text-xs text-blue-600 hover:underline"
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
              <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
              <p className="text-sm text-gray-500">عدد التقييمات</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center py-4">
              <TrendingUp className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{avgScore.toFixed(2)} / 5</p>
              <p className="text-sm text-gray-500">متوسط الدرجة</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center py-4">
              <BarChart3 className="h-6 w-6 text-purple-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{avgPercentage.toFixed(1)}%</p>
              <p className="text-sm text-gray-500">متوسط النسبة</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center py-4">
              <Badge variant={ratingVariant(avgRating)} size="sm">
                {avgRating}
              </Badge>
              <p className="text-sm text-gray-500 mt-2">التقييم العام</p>
              <div className="mt-2 space-y-1">
                {Object.entries(ratingDistribution).map(([rating, count]) => (
                  <div key={rating} className="flex items-center justify-between text-xs px-2">
                    <Badge variant={ratingVariant(rating)} size="sm">{rating}</Badge>
                    <span className="text-gray-600">{count}</span>
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
            <FileX className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
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

            return (
              <Card key={ev.id} className="overflow-hidden">
                <button
                  onClick={() => toggleExpand(ev.id)}
                  className="w-full text-right"
                >
                  <div className="px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Badge variant={ratingVariant(rating)}>
                        {rating}
                      </Badge>
                      {expandedId === ev.id
                        ? <ChevronUp className="h-5 w-5 text-gray-400" />
                        : <ChevronDown className="h-5 w-5 text-gray-400" />}
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="font-bold text-lg text-gray-900">
                        {ev.percentage?.toFixed(1)}%
                      </span>
                      <span className="text-gray-300">|</span>
                      <span className="text-sm font-semibold text-blue-600">
                        {score5.toFixed(2)} / 5
                      </span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-700 font-semibold">
                        {quarterLabels[ev.quarter]} - {ev.year}
                      </span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-600 font-medium">
                        تقييم #{index + 1}
                      </span>
                    </div>
                  </div>
                </button>

                {expandedId === ev.id && (
                  <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 space-y-4">
                    {scoresLoading === ev.id ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : (
                      <>
                        {/* Criterion Scores */}
                        {scores[ev.id] && scores[ev.id].length > 0 ? (
                          <div>
                            <h4 className="text-sm font-bold text-blue-800 mb-2">تفاصيل معايير التقييم</h4>
                            <div className="space-y-2">
                              {scores[ev.id].map(score => (
                                <div
                                  key={score.id}
                                  className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200"
                                >
                                  <div>
                                    <p className="font-medium text-gray-900">
                                      {score.criterion?.title || '—'}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      الوزن: {score.criterion?.weight || 0}%
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-blue-600">
                                      {score.score} / 5
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-center text-gray-400 py-4">
                            لا توجد تفاصيل درجات لهذا التقييم
                          </p>
                        )}

                        {/* Evaluator Note */}
                        {ev.evaluator_note && (
                          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                            <p className="text-xs font-medium text-blue-700 mb-1">ملاحظات المقيّم</p>
                            <p className="text-sm text-blue-900 leading-relaxed">{ev.evaluator_note}</p>
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
