import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { computeFinalScores } from '../../lib/scoring';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { TextArea } from '../../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Save, Send, User, Star, AlertTriangle, Lock, MessageSquare, ArrowRight, ClipboardEdit, Eye, Search, Users, FileCheck, FileClock, Calendar } from 'lucide-react';
import { FractionalScoreSelector } from '../../components/ui/FractionalScoreSelector';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { ModernSelect } from '../../components/ui/ModernSelect';
import { StartEvaluationConfirmModal } from '../../components/ui/StartEvaluationConfirmModal';
import { useEmployeeLeaveStatus, formatLeaveChip } from '../../hooks/useEmployeeLeaveStatus';
import { DirectorCriteriaSection } from './DirectorCriteriaSection';

interface Director {
  id: string;
  full_name: string;
  job_title: string;
  email: string;
  employee_number?: string;
  avatar_url?: string | null;
  department?: { name: string } | null;
  eval_status?: string | null;
  eval_rating?: string | null;
  eval_percentage?: number | null;
  partner_eval_status?: string | null;
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

const getEvalStatusLabel = (status: string | null | undefined, who?: 'me' | 'partner'): string => {
  if (!status || status === 'مسودة') return 'بانتظار التقييم';
  if (status === 'تم الإرسال') return who === 'me' ? 'تم التقييم' : 'تم التقييم';
  if (status === 'بانتظار الموافقة') return 'بانتظار الموافقة على التقييم';
  if (status === 'موافقة' || status === 'اطلع الموظف' || status === 'مغلق') return 'التقييم معتمد';
  if (status === 'مرفوض') return 'التقييم مرفوض';
  return status;
};

const getEvalStatusVariant = (status: string | null | undefined): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
  if (!status || status === 'مسودة') return 'default';
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
    'تم الإرسال': 'success',
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
  const toast = useToast();
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
  const [partnerStatus, setPartnerStatus] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string>('');
  // Confirmation modal: director the CEO is about to start evaluating.
  // Null = no confirmation in flight.
  const [confirmEvalFor, setConfirmEvalFor] = useState<Director | null>(null);
  const [directorsLoading, setDirectorsLoading] = useState(true);
  const [hasSpecificCriteria, setHasSpecificCriteria] = useState(true);
  const [activeTab, setActiveTab] = useState<'evaluation' | 'criteria'>('evaluation');

  // Check if CEO has specific criteria (skip if general weight is 100%)
  useEffect(() => {
    const checkCriteria = async () => {
      if (!user) return;
      const [{ count }, { data: weightSettings }] = await Promise.all([
        supabase
          .from('department_criteria')
          .select('id', { count: 'exact', head: true })
          .is('department_id', null)
          .is('directorate_id', null)
          .is('group_id', null)
          .eq('created_by', user.id)
          .eq('is_active', true),
        supabase
          .from('evaluation_settings')
          .select('specific_weight')
          .limit(1)
          .single(),
      ]);
      const noSpecificNeeded = weightSettings?.specific_weight === 0;
      setHasSpecificCriteria(noSpecificNeeded || (count ?? 0) > 0);
    };
    checkCriteria();
  }, [user]);

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
      supabase.from('evaluation_criteria').select('*').is('group_id', null).eq('is_active', true).order('order'),
      supabase.from('department_criteria').select('*').is('department_id', null).is('directorate_id', null).is('group_id', null).eq('created_by', user.id).eq('is_active', true).order('order'),
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

  // Per-scope weights: CEO → director evaluations use the single
  // high-management pair stored in high_management_weight_settings. Helper
  // falls back to the active period and finally 50/50.
  const fetchSettings = useCallback(async () => {
    const { getHighManagementWeights } = await import('../../lib/weights');
    const w = await getHighManagementWeights();
    setGeneralWeight(w.general);
    setSpecificWeight(w.specific);
  }, []);

  const loadExistingEvaluation = useCallback(async () => {
    if (!directorId || !user || !activePeriod) return;

    // Fetch own evaluation
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

    // Fetch partner CEO's evaluation for the same director+period
    const { data: partnerEval } = await supabase
      .from('director_evaluations')
      .select('status, evaluator:users!director_evaluations_evaluator_id_fkey(full_name)')
      .eq('director_id', directorId)
      .eq('period_id', activePeriod.id)
      .eq('evaluation_type', 'ceo_director')
      .neq('evaluator_id', user.id)
      .maybeSingle();

    if (partnerEval) {
      setPartnerStatus(partnerEval.status);
      setPartnerName((partnerEval.evaluator as any)?.full_name || '');
    } else {
      setPartnerStatus(null);
      setPartnerName('');
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
      if (!tablePeriodId) {
        setAllDirectors([]);
        setDirectorsLoading(false);
        return;
      }
      const { data } = await supabase
        .from('users')
        .select('id, full_name, job_title, email, avatar_url')
        .eq('role', 'director')
        .order('full_name');

      // Fetch eval statuses for selected period (own + partner)
      let evalMap = new Map<string, { status: string; rating: string | null; percentage: number | null }>();
      let partnerEvalMap = new Map<string, string>();
      if (user) {
        const { data: allEvals } = await supabase
          .from('director_evaluations')
          .select('director_id, evaluator_id, status, general_rating, percentage')
          .eq('period_id', tablePeriodId)
          .eq('evaluation_type', 'ceo_director');

        if (allEvals) {
          allEvals.forEach(ev => {
            if (ev.evaluator_id === user.id) {
              evalMap.set(ev.director_id, {
                status: ev.status,
                rating: ev.general_rating,
                percentage: ev.percentage,
              });
            } else {
              partnerEvalMap.set(ev.director_id, ev.status);
            }
          });
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
        partner_eval_status: partnerEvalMap.get(d.id) || null,
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
        toast.warning('يرجى تقييم جميع المعايير قبل الإرسال');
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
        status: isDraft ? 'مسودة' : 'تم الإرسال',
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

      if (!isDraft) {
        // Check if partner CEO has also submitted
        const { data: partnerEval } = await supabase
          .from('director_evaluations')
          .select('id, status')
          .eq('director_id', directorId)
          .eq('period_id', activePeriod.id)
          .eq('evaluation_type', 'ceo_director')
          .neq('evaluator_id', user.id)
          .maybeSingle();

        if (partnerEval && (partnerEval.status === 'تم الإرسال' || partnerEval.status === 'بانتظار الموافقة')) {
          // Both CEOs have submitted — upgrade both to بانتظار الموافقة
          await supabase
            .from('director_evaluations')
            .update({ status: 'بانتظار الموافقة' })
            .eq('director_id', directorId)
            .eq('period_id', activePeriod.id)
            .eq('evaluation_type', 'ceo_director')
            .in('status', ['تم الإرسال']);

          setEvaluationStatus('بانتظار الموافقة');
          setPartnerStatus('بانتظار الموافقة');
          toast.success('تم إرسال التقييم بنجاح — كلا التقييمين الآن بانتظار الاعتماد');
        } else if (!partnerEval) {
          // No partner evaluation exists — check if another CEO user exists
          const { count: otherCeoCount } = await supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'ceo')
            .neq('id', user.id);

          if (!otherCeoCount || otherCeoCount === 0) {
            // Single CEO — go directly to بانتظار الموافقة
            await supabase
              .from('director_evaluations')
              .update({ status: 'بانتظار الموافقة' })
              .eq('id', evaluationId);
            setEvaluationStatus('بانتظار الموافقة');
            toast.success('تم إرسال التقييم بنجاح — التقييم الآن بانتظار الاعتماد');
          } else {
            // Partner CEO exists but hasn't evaluated yet
            setEvaluationStatus('تم الإرسال');
            setPartnerStatus(null);
            toast.success('تم إرسال تقييمك بنجاح — بانتظار إرسال تقييم الشريك');
          }
        } else {
          // Partner exists but is still a draft
          setEvaluationStatus('تم الإرسال');
          setPartnerStatus(partnerEval.status);
          toast.success('تم إرسال تقييمك بنجاح — بانتظار إرسال تقييم الشريك');
        }
      } else {
        setEvaluationStatus('مسودة');
        toast.success('تم حفظ التقييم كمسودة بنجاح');
      }
    } catch (error) {
      console.error('Error saving director evaluation:', error);
      toast.error('حدث خطأ أثناء حفظ التقييم');
    } finally {
      setLoading(false);
    }
  };

  const results = calculateResults();
  const scoredCount = criteria.filter(c => scores[c.id] && scores[c.id] > 0).length;
  const isReadOnly = evaluationStatus !== '' && evaluationStatus !== 'مسودة' && evaluationStatus !== 'مرفوض';
  const isWaitingForPartner = evaluationStatus === 'تم الإرسال';

  const evaluatedCount = allDirectors.filter(d => d.eval_status && d.eval_status !== 'مسودة').length;
  const pendingCount = allDirectors.filter(d => !d.eval_status || d.eval_status === 'مسودة').length;
  const filteredDirectors = allDirectors.filter(d =>
    d.full_name.includes(searchQuery) ||
    d.email.includes(searchQuery) ||
    d.job_title.includes(searchQuery)
  );

  // Hooks must run on every render — keep this above the
  // `if (directorsLoading)` early return so React doesn't crash with
  // "Rendered more hooks than during the previous render" the moment
  // loading flips false.
  const selectedTablePeriod = tablePeriods.find(p => p.id === tablePeriodId);
  const tablePeriodIso = selectedTablePeriod
    ? `${selectedTablePeriod.year}-${String(selectedTablePeriod.month).padStart(2, '0')}-01`
    : null;
  const { isUserOnLeave } = useEmployeeLeaveStatus(tablePeriodIso);
  const tablePeriodLabel = selectedTablePeriod
    ? `${monthLabels[selectedTablePeriod.month]} ${selectedTablePeriod.year}`
    : '';

  if (directorsLoading) {
    return (
      <div className="page-loading-placeholder" aria-hidden="true" />
    );
  }

  // Table view when no director selected
  if (!directorId) {
    return (
      <div className="space-y-6">
        <div
          className="rounded-ds-xl p-8 flex items-center justify-between flex-wrap gap-4"
          style={{
            background: 'var(--sc-green-grad)',
            border: '1px solid var(--sc-green-border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-green-val)' }}>تقييم مدراء الإدارات</h1>
            <p className="mt-2" style={{ color: 'var(--sc-green-label)' }}>اختر مدير الإدارة لبدء أو عرض التقييم</p>
          </div>
          <ModernSelect
            value={tablePeriodId}
            onChange={setTablePeriodId}
            icon={<Calendar className="h-4 w-4" />}
            ariaLabel="فترة التقييم"
            className="min-w-[220px]"
            options={tablePeriods.map(p => ({
              value: p.id,
              label: `${monthLabels[p.month]} ${p.year}`,
              hint: p.status === 'نشطة' ? 'نشطة' : undefined,
            }))}
          />
        </div>

        <div className="flex gap-1 border-b border-ds-border">
          <button
            onClick={() => setActiveTab('evaluation')}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'evaluation'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-ds-faint hover:text-ds-muted'
            }`}
          >
            التقييم
          </button>
          <button
            onClick={() => setActiveTab('criteria')}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'criteria'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-ds-faint hover:text-ds-muted'
            }`}
          >
            إدارة المعايير
          </button>
        </div>

        {activeTab === 'evaluation' && (<>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ds-muted mb-1">إجمالي المدراء</p>
                  <p className="text-2xl font-bold text-ds-text">{allDirectors.length}</p>
                </div>
                <div className="bg-ds-info-bg text-ds-info p-3 rounded-xl">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ds-muted mb-1">تم تقييمهم</p>
                  <p className="text-2xl font-bold text-green-600">{evaluatedCount}</p>
                </div>
                <div className="bg-ds-success-bg text-ds-success p-3 rounded-xl">
                  <FileCheck className="h-6 w-6" />
                </div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ds-muted mb-1">بانتظار التقييم</p>
                  <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                </div>
                <div className="bg-ds-warning-bg text-ds-warning p-3 rounded-xl">
                  <FileClock className="h-6 w-6" />
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {!hasSpecificCriteria && (
          <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-ds-warning-text">يجب إضافة المعايير الخاصة أولاً قبل البدء بتقييم المدراء. اذهب إلى تبويب "إدارة المعايير" لإضافتها.</p>
          </div>
        )}

        <Card>
          <CardBody>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ds-faint" />
                <input
                  type="text"
                  placeholder="بحث بالاسم أو البريد أو المسمى..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 border border-ds-border bg-ds-input text-ds-text placeholder:text-ds-faint rounded-lg focus:ring-2 focus:ring-ds-accent focus:border-ds-accent outline-none transition-colors text-sm"
                />
              </div>
            </div>

            {filteredDirectors.length === 0 ? (
              <EmptyState
                message={searchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد مدراء إدارات حاليًا'}
                icon={<Users className="h-12 w-12 text-ds-faint" />}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المدير</TableHead>
                    <TableHead>الرقم الوظيفي</TableHead>
                    <TableHead>البريد الإلكتروني</TableHead>
                    <TableHead>المسمى الوظيفي</TableHead>
                    <TableHead>حالة التقييم</TableHead>
                    <TableHead>الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDirectors.map((dir) => {
                    const leave = isUserOnLeave(dir.id);
                    return (
                    <TableRow key={dir.id} className={leave ? 'opacity-60 bg-ds-bg' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar name={dir.full_name} avatarUrl={dir.avatar_url} size="md" />
                          <span className="font-medium text-ds-text">{dir.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-ds-faint text-sm font-mono">{dir.employee_number || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-ds-faint text-sm">{dir.email}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-ds-muted text-sm">{dir.job_title}</span>
                      </TableCell>
                      <TableCell>
                        {leave ? (
                          <Badge variant="warning" size="sm">في إجازة — {leave.type_name}</Badge>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-ds-faint">أنت:</span>
                              <Badge variant={getEvalStatusVariant(dir.eval_status)} size="sm">
                                {getEvalStatusLabel(dir.eval_status, 'me')}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-ds-faint">الشريك:</span>
                              <Badge variant={getEvalStatusVariant(dir.partner_eval_status)} size="sm">
                                {getEvalStatusLabel(dir.partner_eval_status, 'partner')}
                              </Badge>
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {leave ? (
                          <span className="text-xs text-ds-warning-text" title={formatLeaveChip(leave)}>
                            لا يمكن التقييم — {leave.type_name}
                          </span>
                        ) : (() => {
                          const isPeriodOpen = selectedTablePeriod?.status === 'نشطة';
                          const hasExisting = !!dir.eval_status && dir.eval_status !== 'مسودة';

                          // No active period AND no existing record → nothing to do
                          if (!isPeriodOpen && !hasExisting) {
                            return (
                              <span className="text-xs text-ds-faint">لا توجد فترة نشطة</span>
                            );
                          }

                          // Active period but criteria missing → show disabled state
                          if (isPeriodOpen && (!dir.eval_status || dir.eval_status === 'مسودة') && !hasSpecificCriteria) {
                            return (
                              <div className="text-center">
                                <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-ds-track text-ds-faint cursor-not-allowed">
                                  <ClipboardEdit className="h-4 w-4" />
                                  <span>بدء التقييم</span>
                                </button>
                                <p className="text-[10px] text-red-500 mt-1">أضف المعايير الخاصة أولاً</p>
                              </div>
                            );
                          }

                          const canEvaluate = isPeriodOpen && (!dir.eval_status || dir.eval_status === 'مسودة' || dir.eval_status === 'مرفوض');

                          return (
                            <button
                              onClick={() => canEvaluate ? setConfirmEvalFor(dir) : setSelectedDirectorId(dir.id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                canEvaluate
                                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                                  : 'bg-ds-overlay text-ds-muted hover:bg-ds-overlay'
                              }`}
                            >
                              {canEvaluate ? (
                                <>
                                  <ClipboardEdit className="h-4 w-4" />
                                  <span>{dir.eval_status === 'مسودة' ? 'متابعة التقييم' : dir.eval_status === 'مرفوض' ? 'إعادة التقييم' : 'بدء التقييم'}</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="h-4 w-4" />
                                  <span>عرض التقييم</span>
                                </>
                              )}
                            </button>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
        </>)}

        {activeTab === 'criteria' && (
          <DirectorCriteriaSection embedded />
        )}

        <StartEvaluationConfirmModal
          isOpen={!!confirmEvalFor}
          subjectName={confirmEvalFor?.full_name}
          title={
            confirmEvalFor?.eval_status === 'مسودة' ? 'متابعة التقييم'
            : confirmEvalFor?.eval_status === 'مرفوض' ? 'إعادة التقييم'
            : 'بدء التقييم'
          }
          confirmLabel={
            confirmEvalFor?.eval_status === 'مسودة' ? 'متابعة'
            : confirmEvalFor?.eval_status === 'مرفوض' ? 'إعادة التقييم'
            : 'بدء التقييم'
          }
          onCancel={() => setConfirmEvalFor(null)}
          onConfirm={() => {
            if (confirmEvalFor) setSelectedDirectorId(confirmEvalFor.id);
            setConfirmEvalFor(null);
          }}
        />
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
          className="flex items-center gap-1 text-blue-600 hover:text-ds-info-text transition-colors"
        >
          <ArrowRight className="h-5 w-5" />
          <span className="text-sm font-medium">العودة للقائمة</span>
        </button>
      </div>
      <div>
        <h1 className="text-3xl font-bold text-ds-text">تقييم مدير الإدارة</h1>
        <p className="text-ds-muted mt-2">تقييم أداء مدير الإدارة للفترة الحالية</p>
      </div>

      {/* Period Selector */}
      <Card>
        <CardBody>
          <div>
            <label className="block text-sm font-medium text-ds-muted mb-2">فترة التقييم</label>
            <div className="max-w-md">
              <ModernSelect
                value={activePeriod?.id || ''}
                onChange={(v) => {
                  const p = allPeriods.find(pr => pr.id === v);
                  if (p) {
                    setActivePeriod(p);
                    setGeneralWeight(p.general_weight ?? 50);
                    setSpecificWeight(p.specific_weight ?? 50);
                  }
                }}
                ariaLabel="فترة التقييم"
                options={allPeriods.map(p => ({
                  value: p.id,
                  label: `${monthLabels[p.month]} ${p.year}`,
                  hint: p.status === 'نشطة' ? 'نشطة' : p.status,
                }))}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {dataLoading && (
        <div className="page-loading-placeholder" aria-hidden="true" />
      )}

      {!dataLoading && !activePeriod && (
        <Card>
          <CardBody className="text-center py-16">
            <AlertTriangle className="h-16 w-16 text-amber-400 mx-auto mb-4" />
            <p className="text-ds-faint text-lg">لا توجد فترة تقييم نشطة حالياً</p>
            <p className="text-ds-faint text-sm mt-2">يرجى التواصل مع مسؤول النظام لتفعيل فترة التقييم</p>
          </CardBody>
        </Card>
      )}

      {!dataLoading && activePeriod && <>
      {/* Rejection Comment */}
      {evaluationStatus === 'مرفوض' && ceoComment && (
        <div className="bg-ds-danger-bg border border-ds-danger-border rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-ds-danger-text mb-1">تم رفض التقييم</p>
            <p className="text-sm text-ds-danger-text">{ceoComment}</p>
            <p className="text-xs text-red-500 mt-2">يمكنك تعديل التقييم وإعادة إرساله</p>
          </div>
        </div>
      )}

      {/* Waiting for partner notice */}
      {isWaitingForPartner && (
        <div className="bg-ds-info-bg border border-ds-info-border rounded-lg p-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-ds-info-text">تم إرسال تقييمك بنجاح</p>
            <p className="text-xs text-blue-600 mt-1">
              بانتظار إرسال تقييم {partnerName || 'الشريك'} — سيتم إرسال التقييم المجمّع للاعتماد بعد إرسال كلا التقييمين
            </p>
          </div>
        </div>
      )}

      {/* Pending Approval Notice */}
      {evaluationStatus === 'بانتظار الموافقة' && (
        <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-ds-warning-text">التقييم بانتظار الاعتماد</p>
            <p className="text-xs text-amber-600 mt-1">تم إرسال كلا التقييمين — بانتظار المراجعة والاعتماد</p>
          </div>
        </div>
      )}

      {/* Approved Notice */}
      {evaluationStatus === 'موافقة' && (
        <div className="bg-ds-success-bg border border-ds-success-border rounded-lg p-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-ds-success-text">تم اعتماد التقييم</p>
          </div>
        </div>
      )}

      {/* Director Info */}
      {director && (
        <Card>
          <CardBody className="bg-ds-info-bg">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-200 rounded-full flex items-center justify-center">
                <User className="h-7 w-7 text-ds-info-text" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                <div>
                  <p className="text-sm text-blue-600">اسم مدير الإدارة</p>
                  <p className="font-semibold text-ds-info-text">{director.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-600">المسمى الوظيفي</p>
                  <p className="font-semibold text-ds-info-text">{director.job_title}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-600">فترة التقييم</p>
                  <p className="font-semibold text-ds-info-text">
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
            <h3 className="text-lg font-bold text-ds-info-text">معايير التقييم العامة</h3>
            <span className="text-sm text-ds-faint">
              ({scoredCount}/{criteria.length} تم تقييمها)
            </span>
          </div>
          <div className="space-y-4">
            {criteria.map(criterion => (
              <Card key={criterion.id} className="border-ds-info-border">
                <CardHeader className="bg-ds-info-bg/50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-ds-text">{criterion.title}</h3>
                      <p className="text-sm text-ds-muted mt-1">{criterion.description}</p>
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
                    <div className="mt-3 text-sm text-ds-muted">
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
            <p className="text-ds-faint">لا توجد معايير تقييم مفعّلة حالياً</p>
          </CardBody>
        </Card>
      )}

      {/* Specific Criteria Section */}
      {specificCriteria.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <h3 className="text-lg font-bold text-ds-success-text">معايير التقييم الخاصة</h3>
            <span className="text-sm text-ds-faint">
              ({specificCriteria.filter(c => specificScores[c.id] && specificScores[c.id] > 0).length}/{specificCriteria.length} تم تقييمها)
            </span>
          </div>
          <div className="space-y-4">
            {specificCriteria.map(criterion => (
              <Card key={criterion.id} className="border-ds-success-border">
                <CardHeader className="bg-ds-success-bg/50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-ds-text">{criterion.title}</h3>
                      <p className="text-sm text-ds-muted mt-1">{criterion.description}</p>
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
                    <div className="mt-3 text-sm text-ds-muted">
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
            <h2 className="text-lg font-semibold text-ds-text">النتيجة النهائية</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-sm text-ds-muted mb-1">الدرجة من 500</p>
                <p className="text-3xl font-bold text-blue-600">{results.finalScore500.toFixed(0)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-ds-muted mb-1">التقييم من 5</p>
                <p className="text-3xl font-bold text-blue-600">{results.finalScore5.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-ds-muted mb-1">النسبة المئوية</p>
                <p className="text-3xl font-bold text-blue-600">{results.percentage.toFixed(1)}%</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-ds-muted mb-1">التقدير العام</p>
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
          <h2 className="text-lg font-semibold text-ds-text">ملاحظات المقيّم</h2>
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
          <CardBody className="bg-ds-info-bg border-teal-100">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-teal-600" />
              <h2 className="text-sm font-bold text-ds-info-text">رد مدير الإدارة على التقييم</h2>
            </div>
            <p className="text-ds-text leading-relaxed">{directorReply}</p>
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
