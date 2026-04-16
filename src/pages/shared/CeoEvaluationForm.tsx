import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { computeFinalScores } from '../../lib/scoring';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { TextArea } from '../../components/ui/Input';
import { Save, Send, User, CheckCircle, AlertTriangle, Lock, MessageSquare, ArrowRight } from 'lucide-react';
import { FractionalScoreSelector } from '../../components/ui/FractionalScoreSelector';

interface CeoUser {
  id: string;
  full_name: string;
  job_title: string;
}

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

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<CeoEvalPeriod | null>(null);
  const [ceos, setCeos] = useState<CeoUser[]>([]);
  const [selectedCeo, setSelectedCeo] = useState<CeoUser | null>(null);
  const [criteria, setCriteria] = useState<CeoCriterion[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [evaluatorNote, setEvaluatorNote] = useState('');
  const [evaluationStatus, setEvaluationStatus] = useState('');
  const [existingEvaluationId, setExistingEvaluationId] = useState<string | null>(null);
  const [ceoSubmitStatus, setCeoSubmitStatus] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);

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

  // Fetch CEO users
  useEffect(() => {
    const fetchCeos = async () => {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, job_title')
        .eq('role', 'ceo');
      setCeos(data || []);
    };
    fetchCeos();
  }, []);

  // Check submission status for each CEO
  useEffect(() => {
    const checkStatuses = async () => {
      if (!currentUserId || !activePeriod || ceos.length === 0) {
        setDataLoading(false);
        return;
      }

      const statusMap: Record<string, string> = {};
      for (const ceo of ceos) {
        const { data } = await supabase
          .from('ceo_evaluations')
          .select('status')
          .eq('evaluator_id', currentUserId)
          .eq('ceo_id', ceo.id)
          .eq('period_id', activePeriod.id)
          .maybeSingle();
        if (data) statusMap[ceo.id] = data.status;
      }
      setCeoSubmitStatus(statusMap);
      setDataLoading(false);
    };
    checkStatuses();
  }, [currentUserId, activePeriod, ceos]);

  // Fetch criteria
  const fetchCriteria = useCallback(async () => {
    const { data } = await supabase
      .from('ceo_evaluation_criteria')
      .select('*')
      .eq('is_active', true)
      .order('order');
    setCriteria(data || []);
  }, []);

  // Load existing evaluation for selected CEO
  const loadExistingEvaluation = useCallback(async () => {
    if (!selectedCeo || !currentUserId || !activePeriod) return;

    const { data: evaluation } = await supabase
      .from('ceo_evaluations')
      .select('*')
      .eq('evaluator_id', currentUserId)
      .eq('ceo_id', selectedCeo.id)
      .eq('period_id', activePeriod.id)
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
  }, [selectedCeo, currentUserId, activePeriod]);

  // When a CEO is selected, load form data
  useEffect(() => {
    if (selectedCeo && currentUserId && activePeriod) {
      setFormLoading(true);
      setScores({});
      setEvaluatorNote('');
      setEvaluationStatus('');
      setExistingEvaluationId(null);
      Promise.all([fetchCriteria(), loadExistingEvaluation()]).finally(() =>
        setFormLoading(false)
      );
    }
  }, [selectedCeo, currentUserId, activePeriod, fetchCriteria, loadExistingEvaluation]);

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
    if (!selectedCeo || !currentUserId || !activePeriod) return;

    if (!isDraft) {
      const allScored = criteria.every((c) => scores[c.id] && scores[c.id] > 0);
      if (!allScored) {
        alert('يرجى تقييم جميع المعايير قبل الإرسال');
        return;
      }
    }

    setLoading(true);

    try {
      const results = calculateResults();
      const status = isDraft ? 'مسودة' : 'تم الإرسال';

      const evaluationData = {
        evaluator_id: currentUserId,
        ceo_id: selectedCeo.id,
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
        const { data: newEval } = await supabase
          .from('ceo_evaluations')
          .insert(evaluationData)
          .select()
          .single();
        evaluationId = newEval!.id;
        setExistingEvaluationId(evaluationId);
      }

      // Save scores via RPC (bypasses RLS issues)
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
          alert('خطأ في حفظ درجات المعايير: ' + scoresError.message);
          setLoading(false);
          return;
        }
      }

      setEvaluationStatus(status);
      setCeoSubmitStatus((prev) => ({ ...prev, [selectedCeo.id]: status }));
      alert(isDraft ? 'تم حفظ التقييم كمسودة بنجاح' : 'تم إرسال التقييم بنجاح');
    } catch (error) {
      console.error('Error saving CEO evaluation:', error);
      alert('حدث خطأ أثناء حفظ التقييم');
    } finally {
      setLoading(false);
    }
  };

  const results = calculateResults();
  const scoredCount = criteria.filter((c) => scores[c.id] && scores[c.id] > 0).length;
  const isReadOnly = evaluationStatus === 'تم الإرسال';

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">تقييم الإدارة العليا</h1>
        <p className="text-gray-600 mt-2">
          تقييم أداء أعضاء الإدارة العليا — يتم بشكل ربعي وبسرية تامة
        </p>
      </div>

      {/* No active period */}
      {!activePeriod && (
        <Card>
          <CardBody>
            <div className="flex items-center gap-3 justify-center py-8">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              <p className="text-lg text-gray-600 font-medium">لا توجد فترة تقييم نشطة حالياً</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* CEO cards */}
      {activePeriod && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ceos.map((ceo) => {
              const status = ceoSubmitStatus[ceo.id];
              const isSubmitted = status === 'تم الإرسال';
              const isSelected = selectedCeo?.id === ceo.id;

              return (
                <Card key={ceo.id}>
                  <CardBody>
                    <button
                      type="button"
                      onClick={() => setSelectedCeo(ceo)}
                      className={`w-full text-right transition-all rounded-lg p-2 -m-2 ${
                        isSelected
                          ? 'ring-2 ring-blue-500 bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xl font-bold">
                            {ceo.full_name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">{ceo.full_name}</h3>
                            <p className="text-sm text-gray-500">{ceo.job_title}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isSubmitted ? (
                            <Badge variant="success" size="sm">
                              <span className="flex items-center gap-1">
                                <CheckCircle className="h-4 w-4" />
                                تم التقييم
                              </span>
                            </Badge>
                          ) : status === 'مسودة' ? (
                            <Badge variant="warning" size="sm">مسودة</Badge>
                          ) : (
                            <Badge variant="default" size="sm">بانتظار التقييم</Badge>
                          )}
                          <ArrowRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                    </button>
                  </CardBody>
                </Card>
              );
            })}
          </div>

          {/* Period info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-800">
            الفترة النشطة: {quarterLabels[activePeriod.quarter] || `الربع ${activePeriod.quarter}`} - {activePeriod.year}
          </div>
        </>
      )}

      {/* Evaluation form */}
      {selectedCeo && activePeriod && (
        <>
          {formLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Selected CEO header */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
                        {selectedCeo.full_name.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">تقييم: {selectedCeo.full_name}</h2>
                        <p className="text-sm text-gray-500">{selectedCeo.job_title}</p>
                      </div>
                    </div>
                    {isReadOnly && (
                      <div className="flex items-center gap-2 text-amber-600">
                        <Lock className="h-4 w-4" />
                        <span className="text-sm font-medium">تم إرسال التقييم - للعرض فقط</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
              </Card>

              {/* Score summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardBody>
                    <p className="text-sm text-gray-600 mb-1">المعايير المقيّمة</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {scoredCount} / {criteria.length}
                    </p>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody>
                    <p className="text-sm text-gray-600 mb-1">النسبة المئوية</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {results.percentage.toFixed(1)}%
                    </p>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody>
                    <p className="text-sm text-gray-600 mb-1">التقدير العام</p>
                    <p className="text-2xl font-bold text-gray-900">
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
                            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded">
                              {index + 1}
                            </span>
                            <h3 className="font-bold text-gray-900">{criterion.title}</h3>
                          </div>
                          {criterion.description && (
                            <p className="text-sm text-gray-500 mr-8">{criterion.description}</p>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 whitespace-nowrap">
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
                    <MessageSquare className="h-5 w-5 text-gray-600" />
                    <h3 className="font-bold text-gray-900">ملاحظات المقيّم</h3>
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
              {!isReadOnly && (
                <div className="flex items-center justify-end gap-3">
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
          )}
        </>
      )}
    </div>
  );
};
