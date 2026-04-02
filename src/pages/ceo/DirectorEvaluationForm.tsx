import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { computeFinalScores } from '../../lib/scoring';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { TextArea } from '../../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Save, Send, User, Star, AlertTriangle, Lock, MessageSquare, ArrowRight, ClipboardEdit, Eye, Search, Users, FileCheck, FileClock, Calendar } from 'lucide-react';
import { FractionalScoreSelector } from '../../components/ui/FractionalScoreSelector';

interface Director {
  id: string;
  full_name: string;
  job_title: string;
  email: string;
  employee_number?: string;
  department?: { name: string } | null;
  eval_status?: string | null;
  eval_rating?: string | null;
  eval_percentage?: number | null;
}

interface Criterion {
  id: string;
  title: string;
  description: string;
  weight: number;
  order: number;
}

interface EvaluationPeriod {
  id: string;
  year: number;
  month: number;
  status: string;
}

const monthLabels: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
};

const getEvalStatusLabel = (status: string | null | undefined): string => {
  if (!status || status === 'مسودة') return 'بانتظار التقييم';
  if (status === 'بانتظار الموافقة') return 'بانتظار اعتماد التقييم';
  if (status === 'موافقة' || status === 'اطلع الموظف' || status === 'مغلق') return 'تم اعتماد التقييم';
  if (status === 'مرفوض') return 'مرفوض';
  return status;
};

const getEvalStatusVariant = (status: string | null | undefined): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
  if (!status || status === 'مسودة') return 'default';
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
    'بانتظار الموافقة': 'warning',
    'موافقة': 'success',
    'اطلع الموظف': 'success',
    'مغلق': 'success',
    'مرفوض': 'danger',
  };
  return map[status] || 'default';
};

const getRatingBadgeVariant = (rating: string | null | undefined): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
  if (!rating) return 'default';
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
    'ممتاز': 'success',
    'جيد جدًا': 'info',
    'جيد': 'warning',
    'يحتاج تحسين': 'danger',
  };
  return map[rating] || 'default';
};

export const DirectorEvaluationForm: React.FC<{ directorId?: string }> = ({ directorId: propDirectorId }) => {
  const { user } = useAuth();
  const [allDirectors, setAllDirectors] = useState<Director[]>([]);
  const [selectedDirectorId, setSelectedDirectorId] = useState<string | undefined>(propDirectorId);
  const directorId = selectedDirectorId;
  const [searchQuery, setSearchQuery] = useState('');
  const [tablePeriods, setTablePeriods] = useState<EvaluationPeriod[]>([]);
  const [tablePeriodId, setTablePeriodId] = useState<string>('');
  const [director, setDirector] = useState<Director | null>(null);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [specificCriteria, setSpecificCriteria] = useState<Criterion[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [specificScores, setSpecificScores] = useState<Record<string, number>>({});
  const [activePeriod, setActivePeriod] = useState<EvaluationPeriod | null>(null);
  const [allPeriods, setAllPeriods] = useState<EvaluationPeriod[]>([]);
  const [evaluatorNotes, setEvaluatorNotes] = useState('');
  const [evaluationStatus, setEvaluationStatus] = useState('');
  const [existingEvaluationId, setExistingEvaluationId] = useState<string | null>(null);
  const [ceoComment, setCeoComment] = useState('');
  const [directorReply, setDirectorReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [generalWeight, setGeneralWeight] = useState(50);
  const [specificWeight, setSpecificWeight] = useState(50);
  const [directorsLoading, setDirectorsLoading] = useState(true);

  const fetchDirector = useCallback(async () => {
    if (!directorId) return;
    const { data } = await supabase
      .from('users')
      .select('id, full_name, job_title, email, department:departments(name)')
      .eq('id', directorId)
      .single();
    setDirector(data);
  }, [directorId]);

  const fetchActivePeriod = useCallback(async () => {
    const { data: periods } = await supabase
      .from('evaluation_periods')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    setAllPeriods(periods || []);
    const active = (periods || []).find((p: any) => p.status === 'نشطة') || null;
    setActivePeriod(active);
  }, []);

  const fetchCriteria = useCallback(async () => {
    if (!user) return;
    const [{ data: general }, { data: specific }] = await Promise.all([
      supabase.from('evaluation_criteria').select('*').eq('is_active', true).order('order'),
      supabase.from('department_criteria').select('*').is('department_id', null).eq('created_by', user.id).eq('is_active', true).order('order'),
    ]);
    setCriteria(general || []);
    setSpecificCriteria((specific || []).map((s: any) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      weight: s.weight,
      order: s.order,
    })));
  }, [user]);

  const fetchSettings = useCallback(async () => {
    // Load weights from active period, fallback to global settings
    const { data: period } = await supabase
      .from('evaluation_periods')
      .select('general_weight, specific_weight')
      .eq('status', 'نشطة')
      .maybeSingle();
    if (period) {
      setGeneralWeight(period.general_weight);
      setSpecificWeight(period.specific_weight);
    } else {
      const { data: settings } = await supabase
        .from('evaluation_settings')
        .select('*')
        .limit(1)
        .single();
      if (settings) {
        setGeneralWeight(settings.general_weight);
        setSpecificWeight(settings.specific_weight);
      }
    }
  }, []);

  const loadExistingEvaluation = useCallback(async () => {
    if (!directorId || !user || !activePeriod) return;

    const { data: evaluation } = await supabase
      .from('director_evaluations')
      .select('*')
      .eq('director_id', directorId)
      .eq('evaluator_id', user.id)
      .eq('period_id', activePeriod.id)
      .eq('evaluation_type', 'ceo_director')
      .maybeSingle();

    if (evaluation) {
      setExistingEvaluationId(evaluation.id);
      setEvaluatorNotes(evaluation.evaluator_note || '');
      setEvaluationStatus(evaluation.status || '');
      setCeoComment(evaluation.ceo_comment || '');
      setDirectorReply(evaluation.director_note || '');

      const { data: evalScores } = await supabase
        .from('director_evaluation_scores')
        .select('*')
        .eq('evaluation_id', evaluation.id);

      const scoresMap: Record<string, number> = {};
      const specScoresMap: Record<string, number> = {};
      evalScores?.forEach((score: any) => {
        if (score.criterion_type === 'specific' && score.department_criterion_id) {
          specScoresMap[score.department_criterion_id] = score.score_1_to_5;
        } else if (score.criterion_id) {
          scoresMap[score.criterion_id] = score.score_1_to_5;
        }
      });
      setScores(scoresMap);
      setSpecificScores(specScoresMap);
    }
  }, [directorId, user, activePeriod]);

  // Fetch periods for table view
  useEffect(() => {
    const fetchPeriods = async () => {
      const { data: periods } = await supabase
        .from('evaluation_periods')
        .select('id, year, month, status')
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      setTablePeriods(periods || []);
      const active = (periods || []).find(p => p.status === 'نشطة');
      if (active) setTablePeriodId(active.id);
      else if (periods && periods.length > 0) setTablePeriodId(periods[0].id);
    };
    fetchPeriods();
  }, []);

  // Fetch all directors for the selector
  useEffect(() => {
    const fetchAllDirectors = async () => {
      if (!tablePeriodId) return;
      const { data } = await supabase
        .from('users')
        .select('id, full_name, job_title, email')
        .eq('role', 'director')
        .order('full_name');

      // Fetch eval statuses for selected period
      let evalMap = new Map<string, { status: string; rating: string | null; percentage: number | null }>();
      if (user) {
        const { data: evals } = await supabase
          .from('director_evaluations')
          .select('director_id, status, general_rating, percentage')
          .eq('evaluator_id', user.id)
          .eq('period_id', tablePeriodId)
          .eq('evaluation_type', 'ceo_director');

        if (evals) {
          evalMap = new Map(evals.map(ev => [ev.director_id, {
            status: ev.status,
            rating: ev.general_rating,
            percentage: ev.percentage,
          }]));
        }
      }

      // Fetch employee_number from employees table via user_id
      const directorIds = (data || []).map((d: any) => d.id);
      const { data: empRecords } = directorIds.length > 0
        ? await supabase.from('employees').select('user_id, employee_number').in('user_id', directorIds)
        : { data: [] };
      const empNumMap = new Map((empRecords || []).map(e => [e.user_id, e.employee_number]));

      setAllDirectors((data || []).map((d: any) => ({
        ...d,
        employee_number: empNumMap.get(d.id) || '',
        eval_status: evalMap.get(d.id)?.status || null,
        eval_rating: evalMap.get(d.id)?.rating || null,
        eval_percentage: evalMap.get(d.id)?.percentage || null,
      })));
      setDirectorsLoading(false);
    };
    fetchAllDirectors();
  }, [user, tablePeriodId]);

  // Sync prop changes
  useEffect(() => {
    if (propDirectorId) setSelectedDirectorId(propDirectorId);
  }, [propDirectorId]);

  useEffect(() => {
    if (user && directorId) {
      setDataLoading(true);
      // Reset state when switching directors
      setScores({});
      setSpecificScores({});
      setEvaluatorNotes('');
      setEvaluationStatus('');
      setExistingEvaluationId(null);
      setDirector(null);
      Promise.all([
        fetchDirector(),
        fetchActivePeriod(),
        fetchCriteria(),
        fetchSettings(),
      ]).finally(() => setDataLoading(false));
    }
  }, [user, directorId]);

  useEffect(() => {
    if (directorId && activePeriod && user) {
      loadExistingEvaluation();
    }
  }, [directorId, activePeriod, user, loadExistingEvaluation]);

  const calculateResults = useCallback(() => {
    // General criteria
    let generalRawTotal = 0;
    let generalMaxPossible = 0;
    criteria.forEach(criterion => {
      const score = scores[criterion.id] || 0;
      generalRawTotal += score * criterion.weight;
      generalMaxPossible += 5 * criterion.weight;
    });

    // Specific criteria
    let specificRawTotal = 0;
    let specificMaxPossible = 0;
    specificCriteria.forEach(criterion => {
      const score = specificScores[criterion.id] || 0;
      specificRawTotal += score * criterion.weight;
      specificMaxPossible += 5 * criterion.weight;
    });

    const generalNorm = generalMaxPossible > 0 ? generalRawTotal / generalMaxPossible : 0;
    const specificNorm = specificMaxPossible > 0 ? specificRawTotal / specificMaxPossible : 0;

    // If no specific criteria exist, use 100% general
    const effectiveGeneralWeight = specificCriteria.length > 0 ? generalWeight : 100;
    const effectiveSpecificWeight = specificCriteria.length > 0 ? specificWeight : 0;

    const percentage = (generalNorm * effectiveGeneralWeight + specificNorm * effectiveSpecificWeight) / 100 * 100;

    const { finalScore5, finalScore500, generalRating } = computeFinalScores(percentage);

    return { finalScore500, finalScore5, percentage, generalRating };
  }, [criteria, specificCriteria, scores, specificScores, generalWeight, specificWeight]);

  const handleSubmit = async (isDraft: boolean) => {
    if (!directorId || !user || !activePeriod) return;

    if (!isDraft) {
      const allGeneralScored = criteria.every(c => scores[c.id] && scores[c.id] > 0);
      const allSpecificScored = specificCriteria.every(c => specificScores[c.id] && specificScores[c.id] > 0);
      if (!allGeneralScored || !allSpecificScored) {
        alert('يرجى تقييم جميع المعايير قبل الإرسال');
        return;
      }
    }

    setLoading(true);

    try {
      const results = calculateResults();

      const evaluationData = {
        director_id: directorId,
        evaluator_id: user.id,
        period_id: activePeriod.id,
        evaluation_type: 'ceo_director',
        status: isDraft ? 'مسودة' : 'بانتظار الموافقة',
        final_score_500: results.finalScore500,
        final_score_5: results.finalScore5,
        percentage: results.percentage,
        general_rating: results.generalRating,
        evaluator_note: evaluatorNotes,
        submitted_at: isDraft ? null : new Date().toISOString(),
      };

      let evaluationId: string;

      if (existingEvaluationId) {
        await supabase
          .from('director_evaluations')
          .update(evaluationData)
          .eq('id', existingEvaluationId);
        evaluationId = existingEvaluationId;
      } else {
        const { data: newEval } = await supabase
          .from('director_evaluations')
          .insert(evaluationData)
          .select()
          .single();
        evaluationId = newEval!.id;
        setExistingEvaluationId(evaluationId);
      }

      // Delete old scores and insert new ones
      await supabase
        .from('director_evaluation_scores')
        .delete()
        .eq('evaluation_id', evaluationId);

      // General criteria score inserts (only include scored criteria)
      const generalTotalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
      const generalScoreInserts = criteria
        .filter(c => scores[c.id] && scores[c.id] > 0)
        .map(criterion => ({
          evaluation_id: evaluationId,
          criterion_id: criterion.id,
          department_criterion_id: null,
          criterion_type: 'general',
          score_1_to_5: scores[criterion.id],
          weighted_result: generalTotalWeight > 0
            ? (scores[criterion.id] / 5) * criterion.weight * (500 / generalTotalWeight)
            : 0,
        }));

      // Specific criteria score inserts (only include scored criteria)
      const specificTotalWeight = specificCriteria.reduce((sum, c) => sum + c.weight, 0);
      const specificScoreInserts = specificCriteria
        .filter(c => specificScores[c.id] && specificScores[c.id] > 0)
        .map(criterion => ({
          evaluation_id: evaluationId,
          criterion_id: null,
          department_criterion_id: criterion.id,
          criterion_type: 'specific',
          score_1_to_5: specificScores[criterion.id],
          weighted_result: specificTotalWeight > 0
            ? (specificScores[criterion.id] / 5) * criterion.weight * (500 / specificTotalWeight)
            : 0,
        }));

      const allScoreInserts = [...generalScoreInserts, ...specificScoreInserts];
      if (allScoreInserts.length > 0) {
        await supabase.from('director_evaluation_scores').insert(allScoreInserts);
      }

      setEvaluationStatus(isDraft ? 'مسودة' : 'بانتظار الموافقة');
      alert(isDraft ? 'تم حفظ التقييم كمسودة بنجاح' : 'تم إرسال التقييم بنجاح');
    } catch (error) {
      console.error('Error saving director evaluation:', error);
      alert('حدث خطأ أثناء حفظ التقييم');
    } finally {
      setLoading(false);
    }
  };

  const results = calculateResults();
  const scoredCount = criteria.filter(c => scores[c.id] && scores[c.id] > 0).length;
  const isReadOnly = evaluationStatus !== '' && evaluationStatus !== 'مسودة' && evaluationStatus !== 'مرفوض';

  const evaluatedCount = allDirectors.filter(d => d.eval_status && d.eval_status !== 'مسودة').length;
  const pendingCount = allDirectors.filter(d => !d.eval_status || d.eval_status === 'مسودة').length;
  const filteredDirectors = allDirectors.filter(d =>
    d.full_name.includes(searchQuery) ||
    d.email.includes(searchQuery) ||
    d.job_title.includes(searchQuery)
  );

  if (directorsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const selectedTablePeriod = tablePeriods.find(p => p.id === tablePeriodId);
  const tablePeriodLabel = selectedTablePeriod
    ? `${monthLabels[selectedTablePeriod.month]} ${selectedTablePeriod.year}`
    : '';

  // Table view when no director selected
  if (!directorId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">تقييم مدراء الإدارات</h1>
            <p className="text-gray-600 mt-2">اختر مدير الإدارة لبدء أو عرض التقييم</p>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
            <Calendar className="h-5 w-5 text-blue-600" />
            <select
              value={tablePeriodId}
              onChange={(e) => setTablePeriodId(e.target.value)}
              className="bg-transparent text-blue-800 font-semibold text-sm border-none focus:ring-0 cursor-pointer"
            >
              {tablePeriods.map(p => (
                <option key={p.id} value={p.id}>
                  {monthLabels[p.month]} {p.year} {p.status === 'نشطة' ? '(نشطة)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">إجمالي المدراء</p>
                  <p className="text-2xl font-bold text-gray-900">{allDirectors.length}</p>
                </div>
                <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">تم تقييمهم</p>
                  <p className="text-2xl font-bold text-green-600">{evaluatedCount}</p>
                </div>
                <div className="bg-green-50 text-green-600 p-3 rounded-xl">
                  <FileCheck className="h-6 w-6" />
                </div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">بانتظار التقييم</p>
                  <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                </div>
                <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
                  <FileClock className="h-6 w-6" />
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="بحث بالاسم أو البريد أو المسمى..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                />
              </div>
            </div>

            {filteredDirectors.length === 0 ? (
              <EmptyState
                message={searchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد مدراء إدارات حاليًا'}
                icon={<Users className="h-12 w-12 text-gray-400" />}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المدير</TableHead>
                    <TableHead>الرقم الوظيفي</TableHead>
                    <TableHead>البريد الإلكتروني</TableHead>
                    <TableHead>المسمى الوظيفي</TableHead>
                    <TableHead>التقييم الحالي</TableHead>
                    <TableHead>الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDirectors.map((dir) => (
                    <TableRow key={dir.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                            {dir.full_name.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900">{dir.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-500 text-sm font-mono">{dir.employee_number || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-500 text-sm">{dir.email}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 text-sm">{dir.job_title}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {dir.eval_status && dir.eval_status !== 'مسودة' && dir.eval_rating ? (
                            <Badge variant={getRatingBadgeVariant(dir.eval_rating)} size="sm">
                              {dir.eval_rating}
                            </Badge>
                          ) : (
                            <Badge variant={getEvalStatusVariant(dir.eval_status)} size="sm">
                              {getEvalStatusLabel(dir.eval_status)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => setSelectedDirectorId(dir.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            !dir.eval_status || dir.eval_status === 'مسودة' || dir.eval_status === 'مرفوض'
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {!dir.eval_status || dir.eval_status === 'مسودة' || dir.eval_status === 'مرفوض' ? (
                            <>
                              <ClipboardEdit className="h-4 w-4" />
                              <span>{dir.eval_status === 'مسودة' ? 'متابعة التقييم' : dir.eval_status === 'مرفوض' ? 'إعادة التقييم' : 'تقييم'}</span>
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4" />
                              <span>عرض التقييم</span>
                            </>
                          )}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => {
            setSelectedDirectorId(undefined);
            setScores({});
            setSpecificScores({});
            setEvaluatorNotes('');
            setEvaluationStatus('');
            setExistingEvaluationId(null);
            setDirector(null);
          }}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ArrowRight className="h-5 w-5" />
          <span className="text-sm font-medium">العودة للقائمة</span>
        </button>
      </div>
      <div>
        <h1 className="text-3xl font-bold text-gray-900">تقييم مدير الإدارة</h1>
        <p className="text-gray-600 mt-2">تقييم أداء مدير الإدارة للفترة الحالية</p>
      </div>

      {/* Period Selector */}
      <Card>
        <CardBody>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">فترة التقييم</label>
            <select
              value={activePeriod?.id || ''}
              onChange={(e) => {
                const p = allPeriods.find(pr => pr.id === e.target.value);
                if (p) {
                  setActivePeriod(p);
                  setGeneralWeight(p.general_weight ?? 50);
                  setSpecificWeight(p.specific_weight ?? 50);
                }
              }}
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {allPeriods.map(p => (
                <option key={p.id} value={p.id}>
                  {monthLabels[p.month]} {p.year} {p.status === 'نشطة' ? '(نشطة)' : `— ${p.status}`}
                </option>
              ))}
            </select>
          </div>
        </CardBody>
      </Card>

      {dataLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {!dataLoading && !activePeriod && (
        <Card>
          <CardBody className="text-center py-16">
            <AlertTriangle className="h-16 w-16 text-amber-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">لا توجد فترة تقييم نشطة حالياً</p>
            <p className="text-gray-400 text-sm mt-2">يرجى التواصل مع مسؤول النظام لتفعيل فترة التقييم</p>
          </CardBody>
        </Card>
      )}

      {!dataLoading && activePeriod && <>
      {/* Rejection Comment */}
      {evaluationStatus === 'مرفوض' && ceoComment && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-800 mb-1">تم رفض التقييم</p>
            <p className="text-sm text-red-700">{ceoComment}</p>
            <p className="text-xs text-red-500 mt-2">يمكنك تعديل التقييم وإعادة إرساله</p>
          </div>
        </div>
      )}

      {/* Pending Approval Notice */}
      {evaluationStatus === 'بانتظار الموافقة' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">التقييم بانتظار الاعتماد</p>
            <p className="text-xs text-amber-600 mt-1">لا يمكن تعديل التقييم حتى تتم المراجعة من صفحة اعتمادية التقييمات</p>
          </div>
        </div>
      )}

      {/* Approved Notice */}
      {evaluationStatus === 'موافقة' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-green-800">تم اعتماد التقييم</p>
          </div>
        </div>
      )}

      {/* Director Info */}
      {director && (
        <Card>
          <CardBody className="bg-blue-50">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-200 rounded-full flex items-center justify-center">
                <User className="h-7 w-7 text-blue-700" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                <div>
                  <p className="text-sm text-blue-600">اسم مدير الإدارة</p>
                  <p className="font-semibold text-blue-900">{director.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-600">المسمى الوظيفي</p>
                  <p className="font-semibold text-blue-900">{director.job_title}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-600">فترة التقييم</p>
                  <p className="font-semibold text-blue-900">
                    {monthLabels[activePeriod.month]} - {activePeriod.year}
                  </p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* General Criteria Section */}
      {criteria.length > 0 ? (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <h3 className="text-lg font-bold text-blue-900">معايير التقييم العامة</h3>
            <span className="text-sm text-gray-500">
              ({scoredCount}/{criteria.length} تم تقييمها)
            </span>
          </div>
          <div className="space-y-4">
            {criteria.map(criterion => (
              <Card key={criterion.id} className="border-blue-200">
                <CardHeader className="bg-blue-50/50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{criterion.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{criterion.description}</p>
                    </div>
                    <Badge variant="primary" size="sm">
                      الوزن: {criterion.weight}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardBody>
                  <FractionalScoreSelector
                    value={scores[criterion.id] || 0}
                    onChange={(val) => setScores({ ...scores, [criterion.id]: val })}
                    color="blue"
                    disabled={isReadOnly}
                  />
                  {scores[criterion.id] && (
                    <div className="mt-3 text-sm text-gray-600">
                      <p>
                        الدرجة: <span className="font-semibold text-blue-600">{scores[criterion.id]}</span> / 5
                        {' — '}
                        المرجحة: <span className="font-semibold text-blue-600">
                          {((scores[criterion.id] / 5) * criterion.weight).toFixed(1)}
                        </span> من {criterion.weight.toFixed(1)}
                      </p>
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardBody className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-3" />
            <p className="text-gray-500">لا توجد معايير تقييم مفعّلة حالياً</p>
          </CardBody>
        </Card>
      )}

      {/* Specific Criteria Section */}
      {specificCriteria.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <h3 className="text-lg font-bold text-emerald-900">معايير التقييم الخاصة</h3>
            <span className="text-sm text-gray-500">
              ({specificCriteria.filter(c => specificScores[c.id] && specificScores[c.id] > 0).length}/{specificCriteria.length} تم تقييمها)
            </span>
          </div>
          <div className="space-y-4">
            {specificCriteria.map(criterion => (
              <Card key={criterion.id} className="border-emerald-200">
                <CardHeader className="bg-emerald-50/50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{criterion.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{criterion.description}</p>
                    </div>
                    <Badge variant="success" size="sm">
                      الوزن: {criterion.weight}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardBody>
                  <FractionalScoreSelector
                    value={specificScores[criterion.id] || 0}
                    onChange={(val) => setSpecificScores({ ...specificScores, [criterion.id]: val })}
                    color="emerald"
                    disabled={isReadOnly}
                  />
                  {specificScores[criterion.id] && (
                    <div className="mt-3 text-sm text-gray-600">
                      <p>
                        الدرجة: <span className="font-semibold text-emerald-600">{specificScores[criterion.id]}</span> / 5
                        {' — '}
                        المرجحة: <span className="font-semibold text-emerald-600">
                          {((specificScores[criterion.id] / 5) * criterion.weight).toFixed(1)}
                        </span> من {criterion.weight.toFixed(1)}
                      </p>
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Final Score Card */}
      {(criteria.length > 0 || specificCriteria.length > 0) && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">النتيجة النهائية</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">الدرجة من 500</p>
                <p className="text-3xl font-bold text-blue-600">{results.finalScore500.toFixed(0)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">التقييم من 5</p>
                <p className="text-3xl font-bold text-blue-600">{results.finalScore5.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">النسبة المئوية</p>
                <p className="text-3xl font-bold text-blue-600">{results.percentage.toFixed(1)}%</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">التقدير العام</p>
                <Badge
                  variant={results.percentage >= 90 ? 'success' : results.percentage >= 75 ? 'info' : 'warning'}
                  size="lg"
                >
                  {results.generalRating}
                </Badge>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Evaluator Notes */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">ملاحظات المقيّم</h2>
        </CardHeader>
        <CardBody>
          <TextArea
            value={evaluatorNotes}
            onChange={(e) => setEvaluatorNotes(e.target.value)}
            rows={4}
            placeholder="اكتب ملاحظاتك حول أداء مدير الإدارة..."
            disabled={isReadOnly}
          />
        </CardBody>
      </Card>

      {/* Director Reply */}
      {directorReply && (
        <Card>
          <CardBody className="bg-teal-50 border-teal-100">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-teal-600" />
              <h2 className="text-sm font-bold text-teal-800">رد مدير الإدارة على التقييم</h2>
            </div>
            <p className="text-gray-800 leading-relaxed">{directorReply}</p>
          </CardBody>
        </Card>
      )}

      {/* Action Buttons */}
      {!isReadOnly && (
        <div className="flex gap-3">
          <Button
            onClick={() => handleSubmit(true)}
            variant="secondary"
            loading={loading}
            className="flex items-center gap-2"
          >
            <span>حفظ كمسودة</span>
            <Save className="h-5 w-5" />
          </Button>
          <Button
            onClick={() => handleSubmit(false)}
            loading={loading}
            className="flex items-center gap-2"
          >
            <span>{evaluationStatus === 'مرفوض' ? 'إعادة إرسال التقييم' : 'إرسال التقييم'}</span>
            <Send className="h-5 w-5" />
          </Button>
        </div>
      )}
      </>}
    </div>
  );
};
