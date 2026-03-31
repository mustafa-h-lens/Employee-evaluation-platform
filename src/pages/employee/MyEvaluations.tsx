import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge, getStatusBadgeVariant } from '../../components/ui/Badge';
import { FileText, ChevronDown, ChevronUp, Calendar, Award, TrendingUp, Target } from 'lucide-react';

interface EvaluationScore {
  id: string;
  score_1_to_5: number;
  weighted_result: number;
  criterion: {
    title: string;
    description: string;
    weight: number;
  };
}

interface DevelopmentPlan {
  id: string;
  item_order: number;
  development_goal: string;
  action_plan: string;
  duration: string;
  notes: string | null;
}

interface Evaluation {
  id: string;
  status: string;
  final_score_500: number;
  final_score_5: number;
  percentage: number;
  general_rating: string;
  manager_note: string | null;
  employee_note: string | null;
  submitted_at: string | null;
  viewed_by_employee_at: string | null;
  created_at: string;
  period: {
    year: number;
    quarter: number;
  };
  manager: {
    full_name: string;
  };
}

export const MyEvaluations: React.FC = () => {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, EvaluationScore[]>>({});
  const [devPlans, setDevPlans] = useState<Record<string, DevelopmentPlan[]>>({});
  const [loading, setLoading] = useState(true);

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
        id, status, final_score_500, final_score_5, percentage, general_rating,
        manager_note, employee_note, submitted_at, viewed_by_employee_at, created_at,
        period:evaluation_periods(year, quarter),
        manager:users!evaluations_manager_id_fkey(full_name)
      `)
      .eq('employee_id', employee.id)
      .in('status', ['تم الإرسال', 'اطلع الموظف', 'مغلق'])
      .order('created_at', { ascending: false });

    setEvaluations((data as Evaluation[]) || []);

    if (data) {
      for (const ev of data) {
        if (ev.status === 'تم الإرسال') {
          await supabase
            .from('evaluations')
            .update({
              status: 'اطلع الموظف',
              viewed_by_employee_at: new Date().toISOString()
            })
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
      const { data: scoreData } = await supabase
        .from('evaluation_scores')
        .select('id, score_1_to_5, weighted_result, criterion:evaluation_criteria(title, description, weight)')
        .eq('evaluation_id', evalId);

      setScores(prev => ({ ...prev, [evalId]: (scoreData as EvaluationScore[]) || [] }));
    }

    if (!devPlans[evalId]) {
      const { data: planData } = await supabase
        .from('development_plans')
        .select('*')
        .eq('evaluation_id', evalId)
        .order('item_order');

      setDevPlans(prev => ({ ...prev, [evalId]: planData || [] }));
    }
  };

  const getRatingColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 bg-green-50';
    if (percentage >= 80) return 'text-blue-600 bg-blue-50';
    if (percentage >= 70) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">تقييماتي</h1>
        <p className="text-gray-600 mt-2">عرض جميع التقييمات الخاصة بك</p>
      </div>

      {evaluations.length === 0 ? (
        <Card>
          <CardBody className="text-center py-16">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">لا توجد تقييمات متاحة حاليا</p>
            <p className="text-gray-400 text-sm mt-2">ستظهر تقييماتك هنا بمجرد اعتمادها من مديرك المباشر</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {evaluations.map(ev => (
            <Card key={ev.id} className="overflow-hidden">
              <button
                onClick={() => toggleExpand(ev.id)}
                className="w-full text-right"
              >
                <div className="px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge variant={getStatusBadgeVariant(ev.status)} size="sm">
                      {ev.status}
                    </Badge>
                    {expandedId === ev.id ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="flex items-center gap-6">
                      <div className="text-left">
                        <span className={`text-2xl font-bold ${getRatingColor(ev.percentage).split(' ')[0]}`}>
                          {ev.percentage?.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-left">
                        <Badge
                          variant={getStatusBadgeVariant(ev.general_rating)}
                          size="sm"
                        >
                          {ev.general_rating}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-gray-700">
                      <span className="font-semibold text-lg">
                        الربع {ev.period?.quarter} - {ev.period?.year}
                      </span>
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              </button>

              {expandedId === ev.id && (
                <div className="border-t border-gray-200">
                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className={`text-center p-4 rounded-xl ${getRatingColor(ev.percentage)}`}>
                        <Award className="h-5 w-5 mx-auto mb-2 opacity-60" />
                        <p className="text-xs opacity-70 mb-1">التقدير العام</p>
                        <p className="font-bold text-lg">{ev.general_rating}</p>
                      </div>
                      <div className="text-center p-4 rounded-xl bg-blue-50 text-blue-700">
                        <TrendingUp className="h-5 w-5 mx-auto mb-2 opacity-60" />
                        <p className="text-xs opacity-70 mb-1">الدرجة من 500</p>
                        <p className="font-bold text-lg">{ev.final_score_500?.toFixed(0)}</p>
                      </div>
                      <div className="text-center p-4 rounded-xl bg-teal-50 text-teal-700">
                        <Target className="h-5 w-5 mx-auto mb-2 opacity-60" />
                        <p className="text-xs opacity-70 mb-1">التقييم من 5</p>
                        <p className="font-bold text-lg">{ev.final_score_5?.toFixed(2)}</p>
                      </div>
                      <div className={`text-center p-4 rounded-xl ${getRatingColor(ev.percentage)}`}>
                        <TrendingUp className="h-5 w-5 mx-auto mb-2 opacity-60" />
                        <p className="text-xs opacity-70 mb-1">النسبة المئوية</p>
                        <p className="font-bold text-lg">{ev.percentage?.toFixed(1)}%</p>
                      </div>
                    </div>

                    {scores[ev.id] && scores[ev.id].length > 0 && (
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 mb-3">تفاصيل المحاور</h3>
                        <div className="space-y-3">
                          {scores[ev.id].map(score => {
                            const maxWeighted = score.criterion.weight * 5;
                            const pct = maxWeighted > 0 ? (score.weighted_result / maxWeighted) * 100 : 0;
                            return (
                              <div key={score.id} className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-3">
                                    <Badge variant="info" size="sm">{score.score_1_to_5}/5</Badge>
                                    <span className="text-sm text-gray-500">
                                      {score.weighted_result.toFixed(0)} / {maxWeighted}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-medium text-gray-900">{score.criterion.title}</p>
                                    <p className="text-xs text-gray-500">الوزن: {score.criterion.weight}%</p>
                                  </div>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2" dir="ltr">
                                  <div
                                    className={`h-2 rounded-full transition-all duration-500 ${
                                      pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {ev.manager_note && (
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-blue-800 mb-2">ملاحظات المدير المباشر</h3>
                        <p className="text-blue-900 leading-relaxed">{ev.manager_note}</p>
                      </div>
                    )}

                    {devPlans[ev.id] && devPlans[ev.id].length > 0 && (
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 mb-3">خطة التطوير</h3>
                        <div className="space-y-3">
                          {devPlans[ev.id].map((plan, idx) => (
                            <div key={plan.id} className="flex items-start gap-3 bg-gray-50 rounded-lg p-4">
                              <div className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                                {idx + 1}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{plan.development_goal}</p>
                                <p className="text-sm text-gray-600 mt-1">{plan.action_plan}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                  <span>المدة: {plan.duration}</span>
                                  {plan.notes && <span>ملاحظات: {plan.notes}</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
                      <span>المقيّم: {ev.manager?.full_name}</span>
                      {ev.submitted_at && (
                        <span>تاريخ الإرسال: {new Date(ev.submitted_at).toLocaleDateString('ar-SA')}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
