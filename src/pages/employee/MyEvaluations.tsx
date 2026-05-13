import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { percentageToRating, percentageToScore5 } from '../../lib/scoring';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TextArea } from '../../components/ui/Input';
import { ModernSelect } from '../../components/ui/ModernSelect';
import {
  FileX, ChevronDown, ChevronUp, Calendar, MessageSquare, Send, CheckCircle2,
  User, Award, TrendingUp, BarChart3, Star,
} from 'lucide-react';

const monthLabels: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
};

const statusLabel = (status: string, hasReply?: boolean): string => {
  if (status === 'تم الإرسال' || status === 'بانتظار الموافقة') return hasReply ? 'بانتظار اعتماد الإدارة' : 'تقييم جديد — بانتظار ردك';
  if (status === 'موافقة' || status === 'اطلع الموظف' || status === 'مغلق') return 'تم اعتماد التقييم';
  if (status === 'مرفوض') return 'التقييم مرفوض';
  return status;
};

const statusVariant = (status: string): 'success' | 'warning' | 'danger' | 'default' => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
    'موافقة': 'success',
    'بانتظار الموافقة': 'warning',
    'مرفوض': 'danger',
    'تم الإرسال': 'info',
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

// Per-evaluator slice surfaced inside a combined director card so the
// evaluatee can drill into who scored what without losing the averaged
// summary. Populated for every director-source row (length 1 for solo
// rows, ≥2 when co-directors / multi-directorate average into one card).
interface UnderlyingDirEval {
  id: string;
  manager_id: string;
  manager_full_name: string;
  directorate_id: string | null;
  directorate_name: string | null;
  percentage: number;
  final_score_5: number | null;
  general_rating: string;
  manager_note: string | null;
  status: string;
}

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
  source: 'director' | 'supervisor';
  // Set when two co-directors evaluated the same (employee, period)
  is_combined?: boolean;
  underlying_ids?: string[];
  manager_notes_breakdown?: { name: string; note: string }[];
  underlying_evals?: UnderlyingDirEval[];
}

const COMBINED_STATUS_PRIORITY = [
  'موافقة', 'اطلع الموظف', 'مغلق', 'بانتظار الموافقة', 'تم الإرسال', 'مرفوض',
];

const pickCombinedStatus = (statuses: string[]): string => {
  for (const s of COMBINED_STATUS_PRIORITY) if (statuses.includes(s)) return s;
  return statuses[0];
};

interface ScoreDetail {
  id: string;
  score_1_to_5: number;
  weighted_result: number;
  criterion_type: string;
  criterion: { title: string; weight: number } | null;
  dept_criterion: { title: string; weight: number; group?: { name: string } | null } | null;
}

// Tab label for a per-evaluator drill-down. Co-directors of the same
// directorate render as just the manager's name; siblings spanning multiple
// directorates get a "<directorate> — <manager>" prefix so the source is
// unambiguous.
const tabLabelFor = (u: UnderlyingDirEval, siblings: UnderlyingDirEval[]): string => {
  const distinctDirs = new Set(siblings.map(s => s.directorate_id ?? ''));
  return distinctDirs.size > 1 && u.directorate_name
    ? `${u.directorate_name} — ${u.manager_full_name}`
    : u.manager_full_name;
};

export const MyEvaluations: React.FC = () => {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [leaves, setLeaves] = useState<Array<{ start_month: string; end_month: string; type_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // `scores` keys by combined card id and stores the averaged criterion list
  // shown on the Summary tab. `scoresPerEval` keys by underlying eval id and
  // stores each evaluator's own (un-averaged) criterion list, used by the
  // per-evaluator tabs.
  const [scores, setScores] = useState<Record<string, ScoreDetail[]>>({});
  const [scoresPerEval, setScoresPerEval] = useState<Record<string, ScoreDetail[]>>({});
  const [selectedTabByCard, setSelectedTabByCard] = useState<Record<string, string>>({});
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

    // Fetch the user's leaves so we can show a friendly "في إجازة" chip in
    // months that are paused. Cheap query; rarely more than a handful of rows.
    const { data: leaveRows } = await supabase
      .from('employee_leaves')
      .select('start_month, end_month, leave_type:employee_leave_types(name)')
      .eq('employee_id', employee.id)
      .order('start_month');
    setLeaves(((leaveRows || []) as any[]).map((r: any) => ({
      start_month: r.start_month,
      end_month: r.end_month,
      type_name: r.leave_type?.name || 'إجازة',
    })));

    // Fetch director/manager evaluations (now includes directorate_id +
    // directorate name so multi-directorate employees can have their per-
    // directorate breakdown surfaced in the combined card).
    const { data: dirData } = await supabase
      .from('evaluations')
      .select(`
        id, status, percentage, final_score_5, general_rating,
        manager_id, manager_note, employee_note, created_at, period_id, directorate_id,
        period:evaluation_periods(year, month),
        manager:users!evaluations_manager_id_fkey(full_name),
        directorate:directorates(id, name)
      `)
      .eq('employee_id', employee.id)
      .in('status', ['بانتظار الموافقة', 'موافقة', 'تم الإرسال', 'اطلع الموظف', 'مغلق'])
      .order('created_at', { ascending: false });

    const rawDirEvals: any[] = ((dirData as any[]) || []);

    // Co-director gating: pull every directorate that has a secondary
    // director and hide any solo pending row tied to one of those. The
    // employee should only see the directorate's evaluation once both
    // co-directors have submitted and the average is computed — otherwise
    // a single director's submission would surface before the partner
    // had a chance to weigh in.
    const { data: coDirs } = await supabase
      .from('directorates')
      .select('id')
      .not('secondary_director_id', 'is', null);
    const coDirIds = new Set((coDirs || []).map((d: any) => d.id));

    // Group director evaluations by period_id only. Two co-directors of
    // the same directorate, OR two different directorates evaluating the
    // same person, both collapse to ONE card per period whose value is the
    // arithmetic mean. The card's breakdown lists each source row with
    // its directorate + manager so the employee can see where each
    // contribution came from.
    const periodGroups = new Map<string, any[]>();
    rawDirEvals.forEach(ev => {
      const pid = ev.period_id || `${ev.period?.year}-${ev.period?.month}`;
      if (!periodGroups.has(pid)) periodGroups.set(pid, []);
      periodGroups.get(pid)!.push(ev);
    });

    const toUnderlying = (r: any): UnderlyingDirEval => ({
      id: r.id,
      manager_id: r.manager_id,
      manager_full_name: r.manager?.full_name || '—',
      directorate_id: r.directorate_id ?? null,
      directorate_name: r.directorate?.name ?? null,
      percentage: Number(r.percentage) || 0,
      final_score_5: r.final_score_5 != null ? Number(r.final_score_5) : null,
      general_rating: r.general_rating || percentageToRating(Number(r.percentage) || 0),
      manager_note: r.manager_note || null,
      status: r.status,
    });

    const dirEvals: Evaluation[] = [];
    periodGroups.forEach(group => {
      if (group.length === 1) {
        const r = group[0];
        const isPending = r.status === 'تم الإرسال' || r.status === 'بانتظار الموافقة';
        if (isPending && r.directorate_id && coDirIds.has(r.directorate_id)) {
          return;
        }
        dirEvals.push({ ...r, source: 'director' as const, underlying_evals: [toUnderlying(r)] });
        return;
      }
      const avg = (k: string) => group.reduce((s, r) => s + (r[k] || 0), 0) / group.length;
      const percentage = avg('percentage');
      const final_score_5 = group.every(r => r.final_score_5 != null)
        ? percentageToScore5(percentage)
        : null;
      const status = pickCombinedStatus(group.map(r => r.status));
      const employee_note = group.find(r => r.employee_note)?.employee_note || null;
      const newest = group.reduce((a, b) =>
        new Date(a.created_at).getTime() > new Date(b.created_at).getTime() ? a : b
      );
      // If all source rows share one directorate, label it as
      // co-directors of that directorate. Otherwise it's a multi-
      // directorate average — use a neutral "متوسط التقييمات" label.
      const distinctDirIds = new Set(group.map(r => r.directorate_id || ''));
      const headerLabel = distinctDirIds.size > 1
        ? `متوسط ${distinctDirIds.size} إدارات`
        : 'الإدارة العليا';
      dirEvals.push({
        id: `combined-${newest.period?.year}-${newest.period?.month}`,
        status,
        percentage,
        final_score_5,
        general_rating: percentageToRating(percentage),
        manager_note: null,
        employee_note,
        created_at: newest.created_at,
        period: newest.period,
        manager: { full_name: headerLabel },
        source: 'director',
        is_combined: true,
        underlying_ids: group.map(r => r.id),
        manager_notes_breakdown: group
          .map(r => ({
            // Include the directorate name so the breakdown line reads
            // "إدارة المشاريع — أحمد البركاني: ..." instead of just the
            // manager's name when sources are different directorates.
            name: r.directorate?.name
              ? `${r.directorate.name} — ${r.manager?.full_name || ''}`
              : (r.manager?.full_name || ''),
            note: r.manager_note || '',
          }))
          .filter(m => m.note),
        underlying_evals: group.map(toUnderlying),
      });
    });

    // Fetch supervisor evaluations
    const { data: supData } = await supabase
      .from('supervisor_evaluations')
      .select(`
        id, status, percentage, final_score_5, general_rating,
        supervisor_note, employee_note, created_at,
        period:evaluation_periods(year, month),
        supervisor:users!supervisor_evaluations_supervisor_id_fkey(full_name)
      `)
      .eq('employee_id', employee.id)
      .in('status', ['تم الإرسال', 'اطلع الموظف', 'مغلق', 'مرفوض'])
      .order('created_at', { ascending: false });

    const supEvals: Evaluation[] = ((supData as any[]) || []).map(ev => ({
      ...ev,
      manager_note: ev.supervisor_note,
      manager: ev.supervisor,
      source: 'supervisor' as const,
    }));

    // Merge and sort by created_at descending
    const evalList = [...dirEvals, ...supEvals].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setEvaluations(evalList);

    const replies: Record<string, string> = {};
    evalList.forEach(ev => { replies[ev.id] = ev.employee_note || ''; });
    setReplyText(replies);

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
      const ev = evaluations.find(e => e.id === evalId);
      try {
        if (ev?.source === 'supervisor') {
          const { data, error } = await supabase
            .from('supervisor_evaluation_scores')
            .select(`
              id, score_1_to_5, weighted_result, criterion_type,
              criterion:evaluation_criteria!supervisor_evaluation_scores_criterion_id_fkey(title, weight),
              sup_criterion:supervisor_criteria!supervisor_evaluation_scores_supervisor_criterion_id_fkey(title, weight)
            `)
            .eq('evaluation_id', evalId);

          if (error) console.error('Sup scores error:', error);
          const mapped: ScoreDetail[] = ((data as any[]) || []).map(s => ({
            id: s.id,
            score_1_to_5: s.score_1_to_5,
            weighted_result: s.weighted_result,
            criterion_type: s.criterion_type,
            criterion: s.criterion,
            dept_criterion: s.sup_criterion,
          }));
          setScores(prev => ({ ...prev, [evalId]: mapped }));
        } else {
          const idsToFetch = ev?.is_combined ? ev.underlying_ids! : [evalId];
          const { data } = await supabase
            .from('evaluation_scores')
            .select(`
              id, score_1_to_5, weighted_result, criterion_type,
              criterion_id, department_criterion_id, evaluation_id,
              criterion:evaluation_criteria(title, weight),
              dept_criterion:department_criteria(title, weight, group:department_criteria_groups(name))
            `)
            .in('evaluation_id', idsToFetch);

          // Bucket A — keep raw rows grouped by underlying eval id so the
          // per-evaluator tabs can show each evaluator's untouched scores.
          const perEval = new Map<string, ScoreDetail[]>();
          (data || []).forEach((s: any) => {
            const arr = perEval.get(s.evaluation_id) ?? [];
            arr.push({
              id: s.id,
              score_1_to_5: s.score_1_to_5,
              weighted_result: s.weighted_result,
              criterion_type: s.criterion_type,
              criterion: s.criterion,
              dept_criterion: s.dept_criterion,
            });
            perEval.set(s.evaluation_id, arr);
          });
          setScoresPerEval(prev => ({ ...prev, ...Object.fromEntries(perEval) }));

          // Bucket B — averaged for the Summary tab. Same math as before.
          let mapped: ScoreDetail[];
          if (ev?.is_combined && idsToFetch.length > 1) {
            const groups = new Map<string, any[]>();
            (data || []).forEach((s: any) => {
              const key = `${s.criterion_type}:${s.criterion_id || s.department_criterion_id}`;
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(s);
            });
            mapped = Array.from(groups.values()).map(rows => {
              const first = rows[0];
              const avg = (k: string) => rows.reduce((s, r) => s + (r[k] || 0), 0) / rows.length;
              return {
                id: first.id,
                score_1_to_5: avg('score_1_to_5'),
                weighted_result: avg('weighted_result'),
                criterion_type: first.criterion_type,
                criterion: first.criterion,
                dept_criterion: first.dept_criterion,
              };
            });
          } else {
            mapped = (data || []).map((s: any) => ({
              id: s.id,
              score_1_to_5: s.score_1_to_5,
              weighted_result: s.weighted_result,
              criterion_type: s.criterion_type,
              criterion: s.criterion,
              dept_criterion: s.dept_criterion,
            }));
          }
          setScores(prev => ({ ...prev, [evalId]: mapped }));
        }
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
    const ev = evaluations.find(e => e.id === evaluationId);
    const table = ev?.source === 'supervisor' ? 'supervisor_evaluations' : 'evaluations';
    const targetIds = ev?.is_combined ? ev.underlying_ids! : [evaluationId];
    try {
      await supabase
        .from(table)
        .update({ employee_note: text })
        .in('id', targetIds);

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
      <div className="page-loading-placeholder" aria-hidden="true" />
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

      <div
        className="rounded-ds-xl p-5 lg:p-8"
        style={{
          background: 'var(--sc-green-grad)',
          border: '1px solid var(--sc-green-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-green-val)' }}>تقييماتي</h1>
        <p className="mt-2" style={{ color: 'var(--sc-green-label)' }}>عرض جميع التقييمات الخاصة بك</p>
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
                ...[...new Set(evaluations.map(e => e.period?.year).filter(Boolean))]
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

      {(() => {
        const filtered = evaluations.filter(e => {
          if (filterYear && e.period?.year !== filterYear) return false;
          if (filterMonth && e.period?.month !== filterMonth) return false;
          return true;
        });
        return filtered.length === 0 ? (() => {
          // If the filtered window falls entirely inside a leave, surface that
          // instead of the bare "لا توجد تقييمات" — gives the employee context.
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
                    <FileX className="h-16 w-16 text-ds-faint mx-auto mb-4" />
                    <p className="text-ds-faint text-lg">{evaluations.length === 0 ? 'لا توجد تقييمات حتى الآن' : 'لا توجد تقييمات للفترة المحددة'}</p>
                  </>
                )}
              </CardBody>
            </Card>
          );
        })() : (
        <div className="space-y-5">
          {filtered.map(ev => {
            const isExpanded = expandedId === ev.id;
            const sourceLabel = ev.source === 'supervisor' ? 'تقييم المشرف' : 'تقييم مدير الإدارة';
            // Tabs surface only when more than one evaluator contributes — solo
            // co-directors and single-directorate cases keep the existing
            // single-view UX with no tab strip.
            const isMultiEvalCombined = !!ev.is_combined && (ev.underlying_evals?.length ?? 0) > 1;
            const activeTab = selectedTabByCard[ev.id] ?? 'summary';
            const activeUnderlying = isMultiEvalCombined && activeTab !== 'summary'
              ? (ev.underlying_evals!.find(u => u.id === activeTab) ?? null)
              : null;
            // Pick the ScoreDetail array for the active tab — averaged for
            // Summary, per-eval for an evaluator tab.
            const activeScores: ScoreDetail[] | undefined = activeUnderlying
              ? scoresPerEval[activeUnderlying.id]
              : scores[ev.id];
            const generalScores = activeScores?.filter(s => s.criterion_type === 'general') || [];
            const specificScores = activeScores?.filter(s => s.criterion_type === 'specific') || [];
            // Summary cards switch their displayed values when an evaluator
            // tab is active so the numbers visibly track the selected tab.
            const dispPercentage = activeUnderlying ? activeUnderlying.percentage : ev.percentage;
            const dispScore5 = activeUnderlying ? activeUnderlying.final_score_5 : ev.final_score_5;
            const dispRating = activeUnderlying ? activeUnderlying.general_rating : ev.general_rating;
            const dispEvaluator = activeUnderlying ? activeUnderlying.manager_full_name : (ev.manager?.full_name || '—');

            return (
            <Card key={ev.id} className="overflow-hidden border border-ds-border shadow-sm">
              {/* Header - clickable */}
              <button
                onClick={() => toggleExpand(ev.id)}
                className="w-full text-right"
              >
                <div className={`px-6 py-5 flex items-center justify-between transition-colors ${isExpanded ? 'bg-ds-overlay' : 'hover:bg-ds-bg'}`}>
                  <div className="flex items-center gap-3">
                    <Badge variant={statusVariant(ev.status)}>
                      {statusLabel(ev.status, !!ev.employee_note)}
                    </Badge>
                    {isExpanded
                      ? <ChevronUp className="h-5 w-5 text-ds-faint" />
                      : <ChevronDown className="h-5 w-5 text-ds-faint" />}
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-xs text-ds-faint bg-ds-overlay px-2 py-0.5 rounded">{sourceLabel}</span>
                    <span className="text-ds-faint">|</span>
                    <span className="font-bold text-lg text-ds-text">
                      {ev.percentage?.toFixed(1)}%
                    </span>
                    {ev.general_rating && (
                      <>
                        <span className="text-ds-faint">|</span>
                        <Badge variant={ratingVariant(ev.general_rating)} size="sm">
                          {ev.general_rating}
                        </Badge>
                      </>
                    )}
                    <span className="text-ds-faint">|</span>
                    <span className="text-ds-muted flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      {ev.manager?.full_name || '—'}
                    </span>
                    <span className="text-ds-faint">|</span>
                    <span className="text-ds-muted font-semibold flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-ds-faint" />
                      {ev.period
                        ? `${monthLabels[ev.period.month]} ${ev.period.year}`
                        : '—'}
                    </span>
                  </div>
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-ds-border">
                  {scoresLoading === ev.id ? (
                    <div className="page-loading-placeholder" aria-hidden="true" />
                  ) : (
                    <>
                      {/* Tab strip — only when more than one evaluator
                          contributed. "الملخص" is the default; remaining tabs
                          drill into each evaluator's individual breakdown. */}
                      {isMultiEvalCombined && (
                        <div className="px-6 pt-4">
                          <div className="tabs" role="tablist" aria-label="عرض حسب المقيّم">
                            <button
                              type="button"
                              role="tab"
                              aria-selected={activeTab === 'summary'}
                              className={`tab ${activeTab === 'summary' ? 'on' : ''}`}
                              onClick={() => setSelectedTabByCard(p => ({ ...p, [ev.id]: 'summary' }))}
                            >
                              الملخص
                            </button>
                            {ev.underlying_evals!.map(u => (
                              <button
                                key={u.id}
                                type="button"
                                role="tab"
                                aria-selected={activeTab === u.id}
                                className={`tab ${activeTab === u.id ? 'on' : ''}`}
                                onClick={() => setSelectedTabByCard(p => ({ ...p, [ev.id]: u.id }))}
                              >
                                {tabLabelFor(u, ev.underlying_evals!)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Per-evaluator status chip — visible only when a
                          specific evaluator's tab is open, so the evaluatee
                          can tell at a glance whether THIS contribution is
                          still pending while the aggregate badge above
                          reflects the card-level status. */}
                      {activeUnderlying && (
                        <div className="px-6 pt-4 flex items-center justify-end gap-2">
                          <Badge variant={statusVariant(activeUnderlying.status)} size="sm">
                            {statusLabel(activeUnderlying.status, !!activeUnderlying.manager_note)}
                          </Badge>
                        </div>
                      )}

                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-5 bg-ds-bg">
                        <div className="bg-ds-surface rounded-xl border border-ds-border p-4 text-center shadow-sm">
                          <div className="w-10 h-10 bg-ds-info-bg rounded-full flex items-center justify-center mx-auto mb-2">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                          </div>
                          <p className="text-2xl font-bold text-ds-text">{dispPercentage?.toFixed(1)}%</p>
                          <p className="text-xs text-ds-faint mt-1">النسبة المئوية</p>
                        </div>
                        <div className="bg-ds-surface rounded-xl border border-ds-border p-4 text-center shadow-sm">
                          <div className="w-10 h-10 bg-ds-info-bg rounded-full flex items-center justify-center mx-auto mb-2">
                            <BarChart3 className="h-5 w-5 text-indigo-600" />
                          </div>
                          <p className="text-2xl font-bold text-ds-text">{dispScore5 != null ? dispScore5.toFixed(2) : '—'}</p>
                          <p className="text-xs text-ds-faint mt-1">الدرجة من 5</p>
                        </div>
                        <div className="bg-ds-surface rounded-xl border border-ds-border p-4 text-center shadow-sm">
                          <div className="w-10 h-10 bg-ds-warning-bg rounded-full flex items-center justify-center mx-auto mb-2">
                            <Award className="h-5 w-5 text-amber-600" />
                          </div>
                          <p className="text-lg font-bold text-ds-text mt-1">{dispRating || '—'}</p>
                          <p className="text-xs text-ds-faint mt-1">التقدير العام</p>
                        </div>
                        <div className="bg-ds-surface rounded-xl border border-ds-border p-4 text-center shadow-sm">
                          <div className="w-10 h-10 bg-ds-success-bg rounded-full flex items-center justify-center mx-auto mb-2">
                            <User className="h-5 w-5 text-emerald-600" />
                          </div>
                          <p className="text-lg font-bold text-ds-text mt-1 truncate">{dispEvaluator}</p>
                          <p className="text-xs text-ds-faint mt-1">المقيّم</p>
                        </div>
                      </div>

                      {/* Criteria Scores */}
                      {(generalScores.length > 0 || specificScores.length > 0) && (
                        <div className="px-6 py-5 space-y-5">
                          {/* General Criteria */}
                          {generalScores.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                                <h4 className="text-sm font-bold text-ds-text">المعايير العامة</h4>
                                <span className="text-xs text-ds-faint">({generalScores.length} معيار)</span>
                              </div>
                              <div className="space-y-2">
                                {generalScores.map(score => {
                                  const pct = ((score.score_1_to_5 / 5) * 100);
                                  const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
                                  return (
                                    <div key={score.id} className="bg-ds-surface rounded-xl border border-ds-border p-4 hover:shadow-sm transition-shadow">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <Star className="h-4 w-4 text-blue-400" />
                                          <p className="font-medium text-ds-text text-sm">{score.criterion?.title || '—'}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <span className="text-xs text-ds-faint">الوزن: {score.criterion?.weight || 0}%</span>
                                          <span className="font-bold text-ds-info-text text-sm">{score.score_1_to_5} / 5</span>
                                        </div>
                                      </div>
                                      <div className="w-full bg-ds-overlay rounded-full h-2">
                                        <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }}></div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Specific Criteria */}
                          {specificScores.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-1 h-5 bg-emerald-500 rounded-full"></div>
                                <h4 className="text-sm font-bold text-ds-text">المعايير الخاصة</h4>
                                <span className="text-xs text-ds-faint">({specificScores.length} معيار)</span>
                              </div>
                              <div className="space-y-2">
                                {specificScores.map(score => {
                                  const pct = ((score.score_1_to_5 / 5) * 100);
                                  const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
                                  return (
                                    <div key={score.id} className="bg-ds-surface rounded-xl border border-ds-border p-4 hover:shadow-sm transition-shadow">
                                      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Star className="h-4 w-4 text-emerald-400" />
                                          <p className="font-medium text-ds-text text-sm">{score.dept_criterion?.title || '—'}</p>
                                          {score.dept_criterion?.group?.name && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-ds-success-bg text-ds-success-text border border-ds-success-border">
                                              {score.dept_criterion.group.name}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <span className="text-xs text-ds-faint">الوزن: {score.dept_criterion?.weight || 0}%</span>
                                          <span className="font-bold text-ds-success-text text-sm">{score.score_1_to_5} / 5</span>
                                        </div>
                                      </div>
                                      <div className="w-full bg-ds-overlay rounded-full h-2">
                                        <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }}></div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {(!activeScores || activeScores.length === 0) && (
                        <div className="text-center py-8 px-6">
                          <BarChart3 className="h-10 w-10 text-ds-faint mx-auto mb-2" />
                          <p className="text-ds-faint">لا توجد تفاصيل درجات لهذا التقييم</p>
                        </div>
                      )}

                      {/* Manager Note(s) — Summary tab shows the breakdown of
                          all evaluator notes; an evaluator tab shows only
                          THAT evaluator's note (hidden if empty). */}
                      {activeUnderlying ? (
                        activeUnderlying.manager_note && (
                          <div className="mx-6 mb-4 bg-ds-info-bg border border-ds-info-border rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageSquare className="h-4 w-4 text-blue-600" />
                              <p className="text-sm font-bold text-ds-info-text">ملاحظات المقيّم</p>
                            </div>
                            <p className="text-sm text-ds-info-text leading-relaxed bg-ds-surface/60 rounded-lg p-3">{activeUnderlying.manager_note}</p>
                          </div>
                        )
                      ) : ev.is_combined ? (
                        ev.manager_notes_breakdown && ev.manager_notes_breakdown.length > 0 && (
                          <div className="mx-6 mb-4 bg-ds-info-bg border border-ds-info-border rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <MessageSquare className="h-4 w-4 text-blue-600" />
                              <p className="text-sm font-bold text-ds-info-text">ملاحظات المقيّمين</p>
                            </div>
                            <div className="space-y-3">
                              {ev.manager_notes_breakdown.map((m, i) => (
                                <div key={i} className="bg-ds-surface/60 rounded-lg p-3 border border-ds-info-border">
                                  <p className="text-xs font-semibold text-ds-info-text mb-1">{m.name}</p>
                                  <p className="text-sm text-ds-info-text leading-relaxed">{m.note}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      ) : (
                        ev.manager_note && (
                          <div className="mx-6 mb-4 bg-ds-info-bg border border-ds-info-border rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageSquare className="h-4 w-4 text-blue-600" />
                              <p className="text-sm font-bold text-ds-info-text">ملاحظات المقيّم</p>
                            </div>
                            <p className="text-sm text-ds-info-text leading-relaxed bg-ds-surface/60 rounded-lg p-3">{ev.manager_note}</p>
                          </div>
                        )
                      )}

                      {/* Reply Section — only on Summary tab; reply applies
                          to the period as a whole (saves to every underlying
                          row), so duplicating it on each evaluator tab would
                          be misleading. */}
                      {!activeUnderlying && (ev.status === 'موافقة' || ev.status === 'اطلع الموظف' || ev.status === 'مغلق' || ev.status === 'تم الإرسال') && (
                        <div className="mx-6 mb-5 bg-ds-info-bg border border-ds-info-border rounded-xl p-4">
                          <h4 className="text-sm font-bold text-ds-info-text mb-2 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            ردك على التقييم
                          </h4>
                          {ev.employee_note ? (
                            <p className="text-sm text-ds-text leading-relaxed bg-ds-surface rounded-lg p-3 border border-ds-info-border">{ev.employee_note}</p>
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
            );
          })}
        </div>
        );
      })()}
    </div>
  );
};
