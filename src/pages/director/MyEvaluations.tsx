import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TextArea } from '../../components/ui/Input';
import { ModernSelect } from '../../components/ui/ModernSelect';
import {
  FileX, ChevronDown, ChevronUp, Send, MessageSquare, CheckCircle2, Calendar,
  User, Award, TrendingUp, BarChart3, Star,
} from 'lucide-react';

const monthLabels: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
};

const statusVariant = (status: string): 'success' | 'warning' | 'danger' | 'default' => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
    'مسودة': 'default',
    'بانتظار الموافقة': 'warning',
    'موافقة': 'success',
    'اطلع المدير': 'success',
    'مغلق': 'success',
    'مكتمل': 'success',
    'مرفوض': 'danger',
  };
  return map[status] || 'default';
};

const statusLabel = (status: string, hasReply?: boolean): string => {
  if (status === 'بانتظار الموافقة') return hasReply ? 'بانتظار اعتماد الإدارة' : 'تقييم جديد — بانتظار ردك';
  if (['موافقة', 'اطلع المدير', 'مغلق', 'مكتمل'].includes(status)) return 'تم اعتماد التقييم';
  if (status === 'مرفوض') return 'مرفوض';
  return status;
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

const percentageToRating = (pct: number): string => {
  if (pct >= 90) return 'ممتاز';
  if (pct >= 80) return 'جيد جدًا';
  if (pct >= 70) return 'جيد';
  return 'يحتاج تحسين';
};

interface EvaluationRow {
  id: string;
  percentage: number;
  final_score_5: number | null;
  general_rating: string;
  status: string;
  director_note: string | null;
  evaluator_note: string | null;
  created_at: string;
  period_id: string;
  period: { id: string; year: number; month: number } | null;
  evaluator: { full_name: string } | null;
}

interface CombinedEval {
  key: string;
  period: { id: string; year: number; month: number };
  eval_ids: string[];
  avg_percentage: number;
  avg_score_5: number;
  avg_rating: string;
  status: string;
  evaluator_notes: string[];
  director_note: string | null;
  eval_count: number;
}

interface ScoreDetail {
  criterion_title: string;
  criterion_weight: number;
  criterion_type: string;
  avg_score: number;
  avg_weighted: number;
}

export const DirectorMyEvaluations: React.FC = () => {
  const { user } = useAuth();
  const [rawEvaluations, setRawEvaluations] = useState<EvaluationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, ScoreDetail[]>>({});
  const [scoresLoading, setScoresLoading] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replySaving, setReplySaving] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<number>(0);
  const [filterMonth, setFilterMonth] = useState<number>(0);
  const [leaves, setLeaves] = useState<Array<{ start_month: string; end_month: string; type_name: string }>>([]);

  useEffect(() => {
    if (user) fetchEvaluations();
  }, [user]);

  const fetchEvaluations = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch evaluations — director sees them once both CEOs have submitted
      const { data } = await supabase
        .from('director_evaluations')
        .select(`
          id, percentage, final_score_5, general_rating, status, director_note, evaluator_note, created_at, period_id,
          period:evaluation_periods(id, year, month),
          evaluator:users!director_evaluations_evaluator_id_fkey(full_name)
        `)
        .eq('director_id', user.id)
        .eq('evaluation_type', 'ceo_director')
        .in('status', ['بانتظار الموافقة', 'موافقة', 'اطلع المدير', 'مغلق', 'مكتمل'])
        .order('created_at', { ascending: false });

      setRawEvaluations((data || []) as unknown as EvaluationRow[]);

      // Pull this director's leaves so a paused month renders a friendly chip
      // instead of the bare "لا توجد تقييمات" empty state.
      const { data: emp } = await supabase
        .from('employees').select('id').eq('user_id', user.id).maybeSingle();
      if (emp?.id) {
        const { data: leaveRows } = await supabase
          .from('employee_leaves')
          .select('start_month, end_month, leave_type:employee_leave_types(name)')
          .eq('employee_id', emp.id)
          .order('start_month');
        setLeaves(((leaveRows || []) as any[]).map((r: any) => ({
          start_month: r.start_month,
          end_month: r.end_month,
          type_name: r.leave_type?.name || 'إجازة',
        })));
      }
    } catch (error) {
      console.error('Error fetching director evaluations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group evaluations by period and compute averages
  const combinedEvaluations = useMemo<CombinedEval[]>(() => {
    const groups = new Map<string, EvaluationRow[]>();
    rawEvaluations.forEach(ev => {
      const periodId = ev.period_id || ev.period?.id || 'unknown';
      if (!groups.has(periodId)) groups.set(periodId, []);
      groups.get(periodId)!.push(ev);
    });

    const result: CombinedEval[] = [];
    groups.forEach((evals, periodId) => {
      const avgPct = evals.reduce((s, e) => s + (e.percentage || 0), 0) / evals.length;
      const avgScore5 = evals.reduce((s, e) => s + (e.final_score_5 || 0), 0) / evals.length;
      const notes = evals.map(e => e.evaluator_note).filter(Boolean) as string[];
      // Director reply is the same across all (we save to all), take first non-null
      const dirNote = evals.find(e => e.director_note)?.director_note || null;

      result.push({
        key: periodId,
        period: evals[0].period!,
        eval_ids: evals.map(e => e.id),
        avg_percentage: Math.round(avgPct * 10) / 10,
        avg_score_5: Math.round(avgScore5 * 100) / 100,
        avg_rating: percentageToRating(avgPct),
        status: evals[0].status,
        evaluator_notes: notes,
        director_note: dirNote,
        eval_count: evals.length,
      });
    });

    // Sort by period year+month descending
    result.sort((a, b) => {
      if (a.period.year !== b.period.year) return b.period.year - a.period.year;
      return b.period.month - a.period.month;
    });

    // Init reply text
    const replies: Record<string, string> = {};
    result.forEach(c => { replies[c.key] = c.director_note || ''; });
    setReplyText(prev => ({ ...prev, ...replies }));

    return result;
  }, [rawEvaluations]);

  const toggleExpand = async (combined: CombinedEval) => {
    const key = combined.key;
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);

    if (!scores[key]) {
      setScoresLoading(key);
      try {
        // Fetch scores for ALL evaluations in this group, then average by criterion
        const allIds = combined.eval_ids;
        const { data } = await supabase
          .from('director_evaluation_scores')
          .select(`
            id, score_1_to_5, weighted_result, criterion_type, evaluation_id,
            criterion:evaluation_criteria(title, weight),
            department_criterion:department_criteria(title, weight, group:department_criteria_groups(name))
          `)
          .in('evaluation_id', allIds);

        // Group by criterion title+type and average
        const criterionMap = new Map<string, { title: string; weight: number; type: string; totalScore: number; totalWeighted: number; count: number }>();
        (data || []).forEach((s: any) => {
          const title = s.criterion_type === 'general'
            ? s.criterion?.title
            : s.department_criterion?.title;
          const weight = s.criterion_type === 'general'
            ? s.criterion?.weight
            : s.department_criterion?.weight;
          if (!title) return;
          const mapKey = `${s.criterion_type}_${title}`;
          if (!criterionMap.has(mapKey)) {
            criterionMap.set(mapKey, { title, weight: weight || 0, type: s.criterion_type, totalScore: 0, totalWeighted: 0, count: 0 });
          }
          const entry = criterionMap.get(mapKey)!;
          entry.totalScore += s.score_1_to_5;
          entry.totalWeighted += s.weighted_result;
          entry.count += 1;
        });

        const avgScores: ScoreDetail[] = Array.from(criterionMap.values()).map(entry => ({
          criterion_title: entry.title,
          criterion_weight: entry.weight,
          criterion_type: entry.type,
          avg_score: Math.round((entry.totalScore / entry.count) * 100) / 100,
          avg_weighted: Math.round((entry.totalWeighted / entry.count) * 10) / 10,
        }));

        setScores(prev => ({ ...prev, [key]: avgScores }));
      } catch (error) {
        console.error('Error fetching scores:', error);
      } finally {
        setScoresLoading(null);
      }
    }
  };

  const handleSaveReply = async (combined: CombinedEval) => {
    const text = replyText[combined.key]?.trim();
    if (!text) return;

    setReplySaving(combined.key);
    try {
      // Save reply to ALL evaluations in the group
      for (const id of combined.eval_ids) {
        await supabase
          .from('director_evaluations')
          .update({ director_note: text })
          .eq('id', id);
      }

      setRawEvaluations(prev =>
        prev.map(ev => combined.eval_ids.includes(ev.id) ? { ...ev, director_note: text } : ev)
      );
      setSuccessMsg('تم إرسال الرد بنجاح');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error) {
      console.error('Error saving reply:', error);
    } finally {
      setReplySaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const filtered = combinedEvaluations.filter(c => {
    if (filterYear && c.period?.year !== filterYear) return false;
    if (filterMonth && c.period?.month !== filterMonth) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Success Toast */}
      {successMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      <div
        className="rounded-ds-xl p-8"
        style={{
          background: 'var(--sc-purple-grad)',
          border: '1px solid var(--sc-purple-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-purple-val)' }}>تقييماتي</h1>
        <p className="mt-2" style={{ color: 'var(--sc-purple-label)' }}>عرض جميع التقييمات الخاصة بك من الإدارة العليا</p>
      </div>

      {/* Date Filter */}
      <Card>
        <CardBody className="flex items-center gap-4 flex-wrap py-3">
          <Calendar className="h-5 w-5 text-ds-faint" />
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-ds-muted">السنة:</label>
            <ModernSelect
              value={String(filterYear)}
              onChange={(v) => { setFilterYear(Number(v)); setFilterMonth(0); }}
              ariaLabel="السنة"
              className="min-w-[140px]"
              options={[
                { value: '0', label: 'الكل' },
                ...[...new Set(combinedEvaluations.map(c => c.period?.year).filter(Boolean))]
                  .sort((a, b) => (b as number) - (a as number))
                  .map(y => ({ value: String(y), label: String(y) })),
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-ds-muted">الشهر:</label>
            <ModernSelect
              value={String(filterMonth)}
              onChange={(v) => setFilterMonth(Number(v))}
              ariaLabel="الشهر"
              disabled={filterYear === 0}
              className="min-w-[160px]"
              options={[
                { value: '0', label: 'الكل' },
                ...Object.entries(monthLabels).map(([m, label]) => ({ value: m, label })),
              ]}
            />
          </div>
          {(filterYear !== 0 || filterMonth !== 0) && (
            <button onClick={() => { setFilterYear(0); setFilterMonth(0); }} className="text-xs text-blue-600 hover:underline">مسح الفلتر</button>
          )}
        </CardBody>
      </Card>

      {filtered.length === 0 ? (() => {
        const matchedLeave = (() => {
          if (!filterYear) return null;
          const monthIso = filterMonth
            ? `${filterYear}-${String(filterMonth).padStart(2, '0')}-01`
            : null;
          return leaves.find(l => {
            if (monthIso) return l.start_month <= monthIso && l.end_month >= monthIso;
            const yearStart = `${filterYear}-01-01`;
            const yearEnd = `${filterYear}-12-01`;
            return l.start_month <= yearEnd && l.end_month >= yearStart;
          }) || null;
        })();
        return (
          <Card>
            <CardBody className="text-center py-16">
              {matchedLeave ? (
                <>
                  <Calendar className="h-16 w-16 text-amber-300 mx-auto mb-4" />
                  <p className="text-ds-text text-lg font-medium mb-1">أنت في إجازة خلال هذا الوقت — لا تقييم مطلوب</p>
                  <p className="text-ds-faint text-sm">{matchedLeave.type_name}</p>
                </>
              ) : (
                <>
                  <FileX className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-ds-faint text-lg">{combinedEvaluations.length === 0 ? 'لا توجد تقييمات حتى الآن' : 'لا توجد تقييمات للفترة المحددة'}</p>
                </>
              )}
            </CardBody>
          </Card>
        );
      })() : (
        <div className="space-y-4">
          {filtered.map(combined => {
            const isExpanded = expandedKey === combined.key;
            const scorePercent = combined.avg_percentage;
            const barColor = scorePercent >= 80 ? 'bg-emerald-500' : scorePercent >= 60 ? 'bg-blue-500' : scorePercent >= 40 ? 'bg-amber-500' : 'bg-red-500';

            return (
              <Card key={combined.key} className="overflow-hidden">
                <button
                  onClick={() => toggleExpand(combined)}
                  className="w-full text-right"
                >
                  <div className="px-6 py-5 hover:bg-ds-bg transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant={statusVariant(combined.status)}>
                          {statusLabel(combined.status, !!combined.director_note)}
                        </Badge>
                        {isExpanded
                          ? <ChevronUp className="h-5 w-5 text-ds-faint" />
                          : <ChevronDown className="h-5 w-5 text-ds-faint" />}
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-bold text-lg text-ds-text">
                          {combined.avg_percentage.toFixed(1)}%
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className="text-sm font-semibold text-blue-600">
                          {combined.avg_score_5.toFixed(2)} / 5
                        </span>
                        <span className="text-gray-300">|</span>
                        <Badge variant={ratingVariant(combined.avg_rating)} size="sm">
                          {combined.avg_rating}
                        </Badge>
                        <span className="text-gray-300">|</span>
                        <span className="text-ds-muted flex items-center gap-1">
                          <Award className="h-4 w-4 text-amber-500" />
                          الإدارة العليا
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className="text-ds-muted font-semibold">
                          {combined.period
                            ? `${monthLabels[combined.period.month]} - ${combined.period.year}`
                            : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 w-full bg-ds-overlay rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(scorePercent, 100)}%` }} />
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-ds-border px-6 py-5 bg-ds-bg space-y-5">
                    {scoresLoading === combined.key ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : (
                      <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-ds-surface rounded-xl p-4 border border-ds-border text-center">
                            <TrendingUp className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                            <p className="text-xs text-ds-faint">النسبة المئوية</p>
                            <p className="text-lg font-bold text-ds-text">{combined.avg_percentage.toFixed(1)}%</p>
                          </div>
                          <div className="bg-ds-surface rounded-xl p-4 border border-ds-border text-center">
                            <BarChart3 className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                            <p className="text-xs text-ds-faint">الدرجة من 5</p>
                            <p className="text-lg font-bold text-ds-text">{combined.avg_score_5.toFixed(2)}</p>
                          </div>
                          <div className="bg-ds-surface rounded-xl p-4 border border-ds-border text-center">
                            <Star className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                            <p className="text-xs text-ds-faint">التقدير العام</p>
                            <Badge variant={ratingVariant(combined.avg_rating)} size="sm">{combined.avg_rating}</Badge>
                          </div>
                          <div className="bg-ds-surface rounded-xl p-4 border border-ds-border text-center">
                            <User className="h-5 w-5 text-indigo-500 mx-auto mb-1" />
                            <p className="text-xs text-ds-faint">جهة التقييم</p>
                            <p className="text-sm font-semibold text-ds-text">الإدارة العليا</p>
                          </div>
                        </div>

                        {/* General Criteria Scores */}
                        {scores[combined.key]?.filter(s => s.criterion_type === 'general').length > 0 && (
                          <div>
                            <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              معايير التقييم العامة
                            </h4>
                            <div className="space-y-2">
                              {scores[combined.key]
                                .filter(s => s.criterion_type === 'general')
                                .map((score, idx) => {
                                  const pct = (score.avg_score / 5) * 100;
                                  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
                                  return (
                                    <div key={idx} className="bg-ds-surface rounded-lg p-3 border border-ds-border">
                                      <div className="flex items-center justify-between mb-2">
                                        <div>
                                          <p className="font-medium text-ds-text">{score.criterion_title}</p>
                                          <p className="text-xs text-ds-faint">الوزن: {score.criterion_weight}%</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="font-semibold text-blue-600">{score.avg_score.toFixed(2)} / 5</p>
                                          <p className="text-xs text-ds-faint">المرجحة: {score.avg_weighted.toFixed(1)}</p>
                                        </div>
                                      </div>
                                      <div className="w-full bg-ds-overlay rounded-full h-1.5">
                                        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                        {/* Specific Criteria Scores */}
                        {scores[combined.key]?.filter(s => s.criterion_type === 'specific').length > 0 && (
                          <div>
                            <h4 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                              معايير التقييم الخاصة
                            </h4>
                            <div className="space-y-2">
                              {scores[combined.key]
                                .filter(s => s.criterion_type === 'specific')
                                .map((score, idx) => {
                                  const pct = (score.avg_score / 5) * 100;
                                  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
                                  return (
                                    <div key={idx} className="bg-ds-surface rounded-lg p-3 border border-ds-border">
                                      <div className="flex items-center justify-between mb-2">
                                        <div>
                                          <p className="font-medium text-ds-text">{score.criterion_title}</p>
                                          <p className="text-xs text-ds-faint">الوزن: {score.criterion_weight}%</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="font-semibold text-emerald-600">{score.avg_score.toFixed(2)} / 5</p>
                                          <p className="text-xs text-ds-faint">المرجحة: {score.avg_weighted.toFixed(1)}</p>
                                        </div>
                                      </div>
                                      <div className="w-full bg-ds-overlay rounded-full h-1.5">
                                        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                        {(!scores[combined.key] || scores[combined.key].length === 0) && (
                          <p className="text-center text-ds-faint py-4">لا توجد تفاصيل درجات لهذا التقييم</p>
                        )}

                        {/* Evaluator Notes */}
                        {combined.evaluator_notes.length > 0 && (
                          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                            <p className="text-xs font-medium text-blue-700 mb-2">ملاحظات الإدارة العليا</p>
                            {combined.evaluator_notes.map((note, idx) => (
                              <p key={idx} className="text-sm text-blue-900 leading-relaxed">{note}</p>
                            ))}
                          </div>
                        )}

                        {/* Reply Section */}
                        {(combined.status === 'بانتظار الموافقة' || combined.status === 'موافقة') && (
                          <div className="bg-teal-50 border border-teal-100 rounded-lg p-4">
                            <h4 className="text-sm font-bold text-teal-800 mb-2 flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              ردك على التقييم
                            </h4>
                            {combined.director_note ? (
                              <p className="text-sm text-ds-text leading-relaxed bg-ds-surface rounded-lg p-3 border border-teal-200">{combined.director_note}</p>
                            ) : (
                              <>
                                <TextArea
                                  value={replyText[combined.key] || ''}
                                  onChange={(e) => setReplyText(prev => ({ ...prev, [combined.key]: e.target.value }))}
                                  rows={3}
                                  placeholder="اكتب ردك أو ملاحظاتك على هذا التقييم..."
                                />
                                <div className="flex justify-end mt-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveReply(combined)}
                                    loading={replySaving === combined.key}
                                    disabled={!replyText[combined.key]?.trim()}
                                    className="flex items-center gap-1"
                                  >
                                    <Send className="h-4 w-4" />
                                    <span>إرسال الرد</span>
                                  </Button>
                                </div>
                              </>
                            )}
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
