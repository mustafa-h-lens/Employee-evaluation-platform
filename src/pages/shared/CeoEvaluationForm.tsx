import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { computeFinalScores } from '../../lib/scoring';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TextArea } from '../../components/ui/Input';
import { Save, Send, AlertTriangle, Lock, MessageSquare, Crown, Play, Eye, ArrowRight } from 'lucide-react';
import { FractionalScoreSelector } from '../../components/ui/FractionalScoreSelector';
import { UserAvatar } from '../../components/ui/UserAvatar';

interface CeoEvalPeriod {
  id: string;
  year: number;
  quarter: number;
  status: string;
}

interface CeoCriterion {
  id: string;
  title: string;
  description: string;
  weight: number;
  order: number;
}

const quarterLabels: Record<number, string> = {
  1: 'الربع الأول',
  2: 'الربع الثاني',
  3: 'الربع الثالث',
  4: 'الربع الرابع',
};

export const CeoEvaluationForm: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<CeoEvalPeriod | null>(null);
  const [criteria, setCriteria] = useState<CeoCriterion[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [evaluatorNote, setEvaluatorNote] = useState('');
  const [evaluationStatus, setEvaluationStatus] = useState('');
  const [existingEvaluationId, setExistingEvaluationId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [leadershipTeam, setLeadershipTeam] = useState<{ id: string; full_name: string; job_title: string | null }[]>([]);

  // Get user id from users table
  useEffect(() => {
    const fetchUserId = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single();
      if (data) setCurrentUserId(data.id);
    };
    fetchUserId();
  }, [user]);

  // Fetch active CEO evaluation period
  useEffect(() => {
    const fetchPeriod = async () => {
      const { data } = await supabase
        .from('ceo_evaluation_periods')
        .select('*')
        .eq('status', 'نشطة')
        .maybeSingle();
      setActivePeriod(data || null);
    };
    fetchPeriod();
  }, []);

  // Fetch criteria
  const fetchCriteria = useCallback(async () => {
    const { data } = await supabase
      .from('ceo_evaluation_criteria')
      .select('*')
      .eq('is_active', true)
      .order('order');
    setCriteria(data || []);
  }, []);

  // Fetch leadership team — shown on the intro screen so the evaluator
  // sees who is being rated as a unit before starting.
  useEffect(() => {
    const fetchTeam = async () => {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, job_title, avatar_url')
        .eq('role', 'ceo')
        .order('full_name');
      setLeadershipTeam(data || []);
    };
    fetchTeam();
  }, []);

  // Load existing collective evaluation for the active period
  const loadExisting = useCallback(async () => {
    if (!currentUserId || !activePeriod) return;

    const { data: evaluation } = await supabase
      .from('ceo_evaluations')
      .select('*')
      .eq('evaluator_id', currentUserId)
      .eq('period_id', activePeriod.id)
      .is('ceo_id', null)
      .maybeSingle();

    if (evaluation) {
      setExistingEvaluationId(evaluation.id);
      setEvaluatorNote(evaluation.evaluator_note || '');
      setEvaluationStatus(evaluation.status || '');

      const { data: evalScores } = await supabase
        .from('ceo_evaluation_scores')
        .select('*')
        .eq('evaluation_id', evaluation.id);

      const scoresMap: Record<string, number> = {};
      evalScores?.forEach((s: any) => {
        if (s.criterion_id) scoresMap[s.criterion_id] = s.score_1_to_5 || s.score || 0;
      });
      setScores(scoresMap);
    } else {
      setExistingEvaluationId(null);
      setEvaluatorNote('');
      setEvaluationStatus('');
      setScores({});
    }
  }, [currentUserId, activePeriod]);

  useEffect(() => {
    if (currentUserId && activePeriod) {
      Promise.all([fetchCriteria(), loadExisting()]).finally(() => setDataLoading(false));
    } else if (currentUserId) {
      // No active period — stop the spinner so the empty-state renders.
      setDataLoading(false);
    }
  }, [currentUserId, activePeriod, fetchCriteria, loadExisting]);

  const calculateResults = useCallback(() => {
    let rawTotal = 0;
    let maxPossible = 0;
    criteria.forEach((criterion) => {
      const score = scores[criterion.id] || 0;
      rawTotal += score * criterion.weight;
      maxPossible += 5 * criterion.weight;
    });

    const percentage = maxPossible > 0 ? (rawTotal / maxPossible) * 100 : 0;
    return computeFinalScores(percentage);
  }, [criteria, scores]);

  const handleSubmit = async (isDraft: boolean) => {
    if (!currentUserId || !activePeriod) return;

    if (!isDraft) {
      const allScored = criteria.every((c) => scores[c.id] && scores[c.id] > 0);
      if (!allScored) {
        toast.warning('يرجى تقييم جميع المعايير قبل الإرسال');
        return;
      }
    }

    setLoading(true);

    try {
      const results = calculateResults();
      const status = isDraft ? 'مسودة' : 'تم الإرسال';

      // ceo_id is null — this row represents the leadership team as a unit.
      const evaluationData = {
        evaluator_id: currentUserId,
        ceo_id: null,
        period_id: activePeriod.id,
        status,
        percentage: results.percentage,
        final_score_5: results.finalScore5,
        final_score_500: results.finalScore500,
        general_rating: results.generalRating,
        evaluator_note: evaluatorNote,
        submitted_at: isDraft ? null : new Date().toISOString(),
      };

      let evaluationId: string;

      if (existingEvaluationId) {
        await supabase
          .from('ceo_evaluations')
          .update(evaluationData)
          .eq('id', existingEvaluationId);
        evaluationId = existingEvaluationId;
      } else {
        const { data: newEval, error } = await supabase
          .from('ceo_evaluations')
          .insert(evaluationData)
          .select()
          .single();
        if (error || !newEval) {
          toast.error('حدث خطأ أثناء حفظ التقييم: ' + (error?.message || ''));
          setLoading(false);
          return;
        }
        evaluationId = newEval.id;
        setExistingEvaluationId(evaluationId);
      }

      const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
      const scoreData = criteria
        .filter((c) => scores[c.id] && scores[c.id] > 0)
        .map((criterion) => ({
          criterion_id: criterion.id,
          score_1_to_5: scores[criterion.id],
          weighted_result: totalWeight > 0
            ? (scores[criterion.id] / 5) * criterion.weight * (500 / totalWeight)
            : 0,
        }));

      if (scoreData.length > 0) {
        const { error: scoresError } = await supabase.rpc('save_ceo_evaluation_scores', {
          p_evaluation_id: evaluationId,
          p_scores: scoreData,
        });
        if (scoresError) {
          console.error('Error saving CEO evaluation scores:', scoresError);
          toast.error('خطأ في حفظ درجات المعايير: ' + scoresError.message);
          setLoading(false);
          return;
        }
      }

      setEvaluationStatus(status);
      toast.success(isDraft ? 'تم حفظ التقييم كمسودة بنجاح' : 'تم إرسال التقييم بنجاح');
    } catch (error) {
      console.error('Error saving CEO evaluation:', error);
      toast.error('حدث خطأ أثناء حفظ التقييم');
    } finally {
      setLoading(false);
    }
  };

  const results = calculateResults();
  const scoredCount = criteria.filter((c) => scores[c.id] && scores[c.id] > 0).length;
  const isReadOnly = evaluationStatus === 'تم الإرسال';

  if (dataLoading) {
    return (
      <div className="page-loading-placeholder" aria-hidden="true" />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div
        className="rounded-ds-xl p-8"
        style={{
          background: 'var(--sc-amber-grad)',
          border: '1px solid var(--sc-amber-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-amber-val)' }}>تقييم الإدارة العليا</h1>
        <p className="mt-2" style={{ color: 'var(--sc-amber-label)' }}>
          تقييم أداء الإدارة العليا كفريق واحد — يتم بشكل ربعي وبسرية تامة
        </p>
      </div>

      {/* No active period */}
      {!activePeriod && (
        <Card>
          <CardBody>
            <div className="flex items-center gap-3 justify-center py-8">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              <p className="text-lg text-ds-muted font-medium">لا توجد فترة تقييم نشطة حالياً</p>
            </div>
          </CardBody>
        </Card>
      )}

      {activePeriod && (
        <>
          {/* Period banner */}
          <div className="bg-ds-info-bg border border-ds-info-border rounded-lg px-4 py-2.5 flex items-center justify-between">
            <span className="text-sm text-ds-info-text">
              الفترة النشطة: {quarterLabels[activePeriod.quarter] || `الربع ${activePeriod.quarter}`} - {activePeriod.year}
            </span>
            {isReadOnly && (
              <span className="flex items-center gap-2 text-ds-warning-text text-sm font-medium">
                <Lock className="h-4 w-4" />
                تم إرسال التقييم — للعرض فقط
              </span>
            )}
          </div>

          {/* Intro screen: show details first, then a button to start the evaluation */}
          {!started && (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-ds-warning-bg text-ds-warning rounded-full flex items-center justify-center">
                      <Crown className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-ds-text">الإدارة العليا</h2>
                      <p className="text-sm text-ds-faint">قيّم أداء فريق القيادة كوحدة واحدة — تقييم واحد لكل فترة</p>
                    </div>
                  </div>
                </CardHeader>
                <CardBody className="space-y-5">
                  <div className="bg-ds-info-bg border border-blue-100 rounded-lg p-4 text-sm text-ds-info-text leading-relaxed">
                    سيتم تقييم الإدارة العليا كفريق واحد بناءً على {criteria.length} معيار. تقييمك سرّي ولا يتم
                    عرض اسمك على أعضاء الإدارة العليا. يمكنك حفظ التقييم كمسودة والعودة إليه قبل الإرسال النهائي.
                  </div>

                  {/* Leadership team chips */}
                  <div>
                    <p className="text-xs font-semibold text-ds-muted mb-2">أعضاء الإدارة العليا</p>
                    {leadershipTeam.length === 0 ? (
                      <p className="text-sm text-ds-faint">لا يوجد أعضاء حاليًا</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {leadershipTeam.map(member => (
                          <div key={member.id} className="flex items-center gap-2 bg-ds-bg border border-ds-border rounded-full px-3 py-1.5">
                            <UserAvatar name={member.full_name} avatarUrl={(member as any).avatar_url} size="sm" />
                            <div className="text-right">
                              <p className="text-sm font-medium text-ds-text leading-tight">{member.full_name}</p>
                              {member.job_title && (
                                <p className="text-[10px] text-ds-faint leading-tight">{member.job_title}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Criteria preview */}
                  <div>
                    <p className="text-xs font-semibold text-ds-muted mb-2">معايير التقييم ({criteria.length})</p>
                    <div className="space-y-2">
                      {criteria.map((c, idx) => (
                        <div key={c.id} className="flex items-start justify-between gap-3 bg-ds-bg border border-ds-border-subtle rounded-lg px-3 py-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="bg-ds-info-bg text-ds-info-text border border-ds-info-border text-xs font-bold px-2 py-0.5 rounded mt-0.5">{idx + 1}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ds-text">{c.title}</p>
                              {c.description && (
                                <p className="text-xs text-ds-faint mt-0.5 line-clamp-2">{c.description}</p>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-ds-faint whitespace-nowrap mt-1">الوزن: {c.weight}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status / start button */}
                  <div className="flex items-center justify-between pt-2 border-t border-ds-border-subtle">
                    <p className="text-xs text-ds-faint">
                      {isReadOnly
                        ? 'تم إرسال التقييم لهذه الفترة'
                        : evaluationStatus === 'مسودة'
                          ? 'لديك مسودة محفوظة — يمكنك متابعتها'
                          : 'لم تبدأ التقييم بعد'}
                    </p>
                    <Button onClick={() => setStarted(true)} disabled={criteria.length === 0}>
                      <span className="flex items-center gap-2">
                        {isReadOnly ? (
                          <><Eye className="h-4 w-4" /> عرض التقييم</>
                        ) : evaluationStatus === 'مسودة' ? (
                          <><ArrowRight className="h-4 w-4" /> متابعة التقييم</>
                        ) : (
                          <><Play className="h-4 w-4" /> بدء التقييم</>
                        )}
                      </span>
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </>
          )}

          {started && (<>
          {/* Header card explaining collective scope */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-ds-warning-bg text-ds-warning rounded-full flex items-center justify-center">
                  <Crown className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-ds-text">الإدارة العليا</h2>
                  <p className="text-sm text-ds-faint">قيّم أداء فريق القيادة كوحدة واحدة — تقييم واحد لكل فترة</p>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Score summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardBody>
                <p className="text-sm text-ds-muted mb-1">المعايير المقيّمة</p>
                <p className="text-2xl font-bold text-ds-text">
                  {scoredCount} / {criteria.length}
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm text-ds-muted mb-1">النسبة المئوية</p>
                <p className="text-2xl font-bold text-blue-600">
                  {results.percentage.toFixed(1)}%
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm text-ds-muted mb-1">التقدير العام</p>
                <p className="text-2xl font-bold text-ds-text">
                  {scoredCount > 0 ? results.generalRating : '-'}
                </p>
              </CardBody>
            </Card>
          </div>

          {/* Criteria */}
          {criteria.map((criterion, index) => (
            <Card key={criterion.id}>
              <CardBody>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-ds-info-bg text-ds-info-text border border-ds-info-border text-xs font-bold px-2 py-0.5 rounded">
                          {index + 1}
                        </span>
                        <h3 className="font-bold text-ds-text">{criterion.title}</h3>
                      </div>
                      {criterion.description && (
                        <p className="text-sm text-ds-faint mr-8">{criterion.description}</p>
                      )}
                    </div>
                    <div className="text-sm text-ds-faint whitespace-nowrap">
                      الوزن: {criterion.weight}%
                    </div>
                  </div>
                  <FractionalScoreSelector
                    value={scores[criterion.id] || 0}
                    onChange={(score) =>
                      setScores((prev) => ({ ...prev, [criterion.id]: score }))
                    }
                    color="blue"
                    disabled={isReadOnly}
                  />
                </div>
              </CardBody>
            </Card>
          ))}

          {/* Evaluator note */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-ds-muted" />
                <h3 className="font-bold text-ds-text">ملاحظات المقيّم</h3>
              </div>
            </CardHeader>
            <CardBody>
              <TextArea
                value={evaluatorNote}
                onChange={(e) => setEvaluatorNote(e.target.value)}
                placeholder="أضف ملاحظاتك هنا (اختياري)..."
                rows={4}
                disabled={isReadOnly}
              />
            </CardBody>
          </Card>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => setStarted(false)}>
              العودة إلى التفاصيل
            </Button>
            {!isReadOnly && (
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={() => handleSubmit(true)}
                  disabled={loading}
                >
                  <Save className="h-4 w-4 ml-2" />
                  حفظ كمسودة
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleSubmit(false)}
                  disabled={loading}
                >
                  <Send className="h-4 w-4 ml-2" />
                  إرسال التقييم
                </Button>
              </div>
            )}
          </div>
          </>)}
        </>
      )}
    </div>
  );
};
