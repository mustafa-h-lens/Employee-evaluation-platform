import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TextArea } from '../../components/ui/Input';
import {
  FileX, ChevronDown, ChevronUp, Calendar, MessageSquare, Send, CheckCircle2,
} from 'lucide-react';

const monthLabels: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
};

const statusLabel = (status: string): string => {
  if (status === 'بانتظار الموافقة') return 'بانتظار اعتماد التقييم';
  if (status === 'موافقة' || status === 'اطلع الموظف' || status === 'مغلق') return 'تم اعتماد التقييم';
  if (status === 'مرفوض') return 'مرفوض';
  return status;
};

const statusVariant = (status: string): 'success' | 'warning' | 'danger' | 'default' => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
    'موافقة': 'success',
    'بانتظار الموافقة': 'warning',
    'مرفوض': 'danger',
    'تم الإرسال': 'warning',
    'اطلع الموظف': 'success',
    'مغلق': 'success',
  };
  return map[status] || 'default';
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

interface Evaluation {
  id: string;
  status: string;
  percentage: number;
  final_score_5: number | null;
  general_rating: string;
  manager_note: string | null;
  employee_note: string | null;
  created_at: string;
  period: { year: number; month: number };
  manager: { full_name: string };
}

interface ScoreDetail {
  id: string;
  score_1_to_5: number;
  weighted_result: number;
  criterion_type: string;
  criterion: { title: string; weight: number } | null;
  dept_criterion: { title: string; weight: number } | null;
}

export const MyEvaluations: React.FC = () => {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, ScoreDetail[]>>({});
  const [scoresLoading, setScoresLoading] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replySaving, setReplySaving] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<number>(0);
  const [filterMonth, setFilterMonth] = useState<number>(0);

  useEffect(() => {
    if (user) fetchEvaluations();
  }, [user]);

  const fetchEvaluations = async () => {
    if (!user) return;

    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!employee) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('evaluations')
      .select(`
        id, status, percentage, final_score_5, general_rating,
        manager_note, employee_note, created_at,
        period:evaluation_periods(year, month),
        manager:users!evaluations_manager_id_fkey(full_name)
      `)
      .eq('employee_id', employee.id)
      .in('status', ['موافقة', 'تم الإرسال', 'اطلع الموظف', 'مغلق'])
      .order('created_at', { ascending: false });

    const evalList = (data as Evaluation[]) || [];
    setEvaluations(evalList);

    const replies: Record<string, string> = {};
    evalList.forEach(ev => { replies[ev.id] = ev.employee_note || ''; });
    setReplyText(replies);

    // Mark "تم الإرسال" as viewed
    if (data) {
      for (const ev of data) {
        if (ev.status === 'تم الإرسال') {
          await supabase
            .from('evaluations')
            .update({ status: 'اطلع الموظف', viewed_by_employee_at: new Date().toISOString() })
            .eq('id', ev.id);
        }
      }
    }

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
          .from('evaluation_scores')
          .select(`
            id, score_1_to_5, weighted_result, criterion_type,
            criterion:evaluation_criteria(title, weight),
            dept_criterion:department_criteria(title, weight)
          `)
          .eq('evaluation_id', evalId);

        setScores(prev => ({ ...prev, [evalId]: (data || []) as unknown as ScoreDetail[] }));
      } catch (error) {
        console.error('Error fetching scores:', error);
      } finally {
        setScoresLoading(null);
      }
    }
  };

  const handleSaveReply = async (evaluationId: string) => {
    const text = replyText[evaluationId]?.trim();
    if (!text) return;

    setReplySaving(evaluationId);
    try {
      await supabase
        .from('evaluations')
        .update({ employee_note: text })
        .eq('id', evaluationId);

      setEvaluations(prev =>
        prev.map(ev => ev.id === evaluationId ? { ...ev, employee_note: text } : ev)
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

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold text-gray-900">تقييماتي</h1>
        <p className="text-gray-600 mt-2">عرض جميع التقييمات الخاصة بك</p>
      </div>

      {/* Date Filter */}
      <Card>
        <CardBody className="flex items-center gap-4 flex-wrap py-3">
          <Calendar className="h-5 w-5 text-gray-400" />
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">السنة:</label>
            <select value={filterYear} onChange={e => { setFilterYear(Number(e.target.value)); setFilterMonth(0); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value={0}>الكل</option>
              {[...new Set(evaluations.map(e => e.period?.year).filter(Boolean))].sort((a, b) => (b as number) - (a as number)).map(y => <option key={y} value={y!}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">الشهر:</label>
            <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" disabled={filterYear === 0}>
              <option value={0}>الكل</option>
              {Object.entries(monthLabels).map(([m, label]) => <option key={m} value={m}>{label}</option>)}
            </select>
          </div>
          {(filterYear !== 0 || filterMonth !== 0) && (
            <button onClick={() => { setFilterYear(0); setFilterMonth(0); }} className="text-xs text-blue-600 hover:underline">مسح الفلتر</button>
          )}
        </CardBody>
      </Card>

      {(() => {
        const filtered = evaluations.filter(e => {
          if (filterYear && e.period?.year !== filterYear) return false;
          if (filterMonth && e.period?.month !== filterMonth) return false;
          return true;
        });
        return filtered.length === 0 ? (
          <Card>
            <CardBody className="text-center py-16">
              <FileX className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">{evaluations.length === 0 ? 'لا توجد تقييمات حتى الآن' : 'لا توجد تقييمات للفترة المحددة'}</p>
            </CardBody>
          </Card>
        ) : (
        <div className="space-y-4">
          {filtered.map(ev => (
            <Card key={ev.id} className="overflow-hidden">
              <button
                onClick={() => toggleExpand(ev.id)}
                className="w-full text-right"
              >
                <div className="px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge variant={statusVariant(ev.status)}>
                      {statusLabel(ev.status)}
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
                    {ev.final_score_5 != null && (
                      <>
                        <span className="text-sm font-semibold text-blue-600">
                          {ev.final_score_5.toFixed(2)} / 5
                        </span>
                        <span className="text-gray-300">|</span>
                      </>
                    )}
                    {ev.general_rating && (
                      <>
                        <Badge variant={ratingVariant(ev.general_rating)} size="sm">
                          {ev.general_rating}
                        </Badge>
                        <span className="text-gray-300">|</span>
                      </>
                    )}
                    <span className="text-gray-600">
                      {ev.manager?.full_name || '—'}
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-700 font-semibold">
                      {ev.period
                        ? `${monthLabels[ev.period.month]} - ${ev.period.year}`
                        : '—'}
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
                      {/* General Criteria */}
                      {scores[ev.id]?.filter(s => s.criterion_type === 'general').length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-blue-800 mb-2">معايير التقييم العامة</h4>
                          <div className="space-y-2">
                            {scores[ev.id]
                              .filter(s => s.criterion_type === 'general')
                              .map(score => (
                                <div key={score.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200">
                                  <div>
                                    <p className="font-medium text-gray-900">{score.criterion?.title || '—'}</p>
                                    <p className="text-xs text-gray-500">الوزن: {score.criterion?.weight || 0}%</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-blue-600">{score.score_1_to_5} / 5</p>
                                    <p className="text-xs text-gray-500">المرجحة: {score.weighted_result.toFixed(1)}</p>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Specific Criteria */}
                      {scores[ev.id]?.filter(s => s.criterion_type === 'specific').length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-emerald-800 mb-2">معايير التقييم الخاصة</h4>
                          <div className="space-y-2">
                            {scores[ev.id]
                              .filter(s => s.criterion_type === 'specific')
                              .map(score => (
                                <div key={score.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200">
                                  <div>
                                    <p className="font-medium text-gray-900">{score.dept_criterion?.title || '—'}</p>
                                    <p className="text-xs text-gray-500">الوزن: {score.dept_criterion?.weight || 0}%</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-emerald-600">{score.score_1_to_5} / 5</p>
                                    <p className="text-xs text-gray-500">المرجحة: {score.weighted_result.toFixed(1)}</p>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {(!scores[ev.id] || scores[ev.id].length === 0) && (
                        <p className="text-center text-gray-400 py-4">لا توجد تفاصيل درجات لهذا التقييم</p>
                      )}

                      {/* Manager Note */}
                      {ev.manager_note && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                          <p className="text-xs font-medium text-blue-700 mb-1">ملاحظات المقيّم</p>
                          <p className="text-sm text-blue-900 leading-relaxed">{ev.manager_note}</p>
                        </div>
                      )}

                      {/* Reply Section */}
                      {(ev.status === 'موافقة' || ev.status === 'اطلع الموظف' || ev.status === 'مغلق') && (
                        <div className="bg-teal-50 border border-teal-100 rounded-lg p-4">
                          <h4 className="text-sm font-bold text-teal-800 mb-2 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            ردك على التقييم
                          </h4>
                          {ev.employee_note ? (
                            <p className="text-sm text-gray-800 leading-relaxed bg-white rounded-lg p-3 border border-teal-200">{ev.employee_note}</p>
                          ) : (
                            <>
                              <TextArea
                                value={replyText[ev.id] || ''}
                                onChange={(e) => setReplyText(prev => ({ ...prev, [ev.id]: e.target.value }))}
                                rows={3}
                                placeholder="اكتب ردك أو ملاحظاتك على هذا التقييم..."
                              />
                              <div className="flex justify-end mt-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveReply(ev.id)}
                                  loading={replySaving === ev.id}
                                  disabled={!replyText[ev.id]?.trim()}
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
          ))}
        </div>
        );
      })()}
    </div>
  );
};
