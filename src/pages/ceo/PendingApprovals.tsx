import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TextArea } from '../../components/ui/Input';
import { Modal, ModalFooter } from '../../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { CheckCircle, XCircle, Eye, Clock, FileText, Star, Filter, Users, Crown, UserCog, Landmark } from 'lucide-react';

const monthLabels: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
};

const getRatingVariant = (rating: string | null): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
  switch (rating) {
    case 'ممتاز': return 'success';
    case 'جيد جدًا': return 'info';
    case 'جيد': return 'warning';
    case 'يحتاج تحسين': return 'danger';
    default: return 'default';
  }
};

const getStatusVariant = (status: string): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
  switch (status) {
    case 'بانتظار الموافقة': return 'warning';
    case 'موافقة': return 'success';
    case 'مرفوض': return 'danger';
    default: return 'default';
  }
};

interface EvalItem {
  id: string;
  employee: { full_name: string; job_title: string; employee_number: string } | null;
  manager: { full_name: string } | null;
  department: { name: string } | null;
  period: { year: number; month: number } | null;
  status: string;
  final_score_500: number;
  final_score_5: number;
  percentage: number;
  general_rating: string | null;
  manager_note: string | null;
  employee_note: string | null;
  ceo_comment: string | null;
  submitted_at: string | null;
}

interface DirectorEvalItem {
  id: string;
  director: { full_name: string; job_title: string } | null;
  evaluator: { full_name: string } | null;
  period: { year: number; month: number } | null;
  status: string;
  final_score_500: number;
  final_score_5: number;
  percentage: number;
  general_rating: string | null;
  evaluator_note: string | null;
  director_note: string | null;
  ceo_comment: string | null;
  submitted_at: string | null;
}

interface ScoreDetail {
  criterion_title: string;
  criterion_description: string;
  criterion_weight: number;
  score: number;
  weighted_result: number;
  type: 'general' | 'specific';
}

type MainTab = 'managers' | 'directors' | 'ceo';
type StatusFilter = 'pending' | 'rejected' | 'approved' | 'all';

export const PendingApprovals: React.FC = () => {
  const { user } = useAuth();
  const [mainTab, setMainTab] = useState<MainTab>('managers');
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('pending');

  // Employee evaluations
  const [evaluations, setEvaluations] = useState<EvalItem[]>([]);
  const [empLoading, setEmpLoading] = useState(true);

  // CEO → Director evaluations
  const [directorEvals, setDirectorEvals] = useState<DirectorEvalItem[]>([]);
  const [dirLoading, setDirLoading] = useState(true);

  // Director → Manager evaluations
  const [dirMgrEvals, setDirMgrEvals] = useState<DirectorEvalItem[]>([]);
  const [dirMgrLoading, setDirMgrLoading] = useState(true);

  // Detail modal
  const [detailModal, setDetailModal] = useState(false);
  const [detailEval, setDetailEval] = useState<EvalItem | null>(null);
  const [detailDirEval, setDetailDirEval] = useState<DirectorEvalItem | null>(null);
  const [detailScores, setDetailScores] = useState<ScoreDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Reject modal
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; type: 'employee' | 'director' } | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Reset filter when switching tabs
  useEffect(() => {
    setActiveFilter('pending');
  }, [mainTab]);

  const fetchEmployeeEvaluations = useCallback(async () => {
    setEmpLoading(true);

    let query = supabase
      .from('evaluations')
      .select(`
        id, status, final_score_500, final_score_5, percentage, general_rating,
        manager_note, employee_note, ceo_comment, submitted_at,
        employee:employees(full_name, job_title, employee_number),
        manager:users!evaluations_manager_id_fkey(full_name),
        department:departments(name),
        period:evaluation_periods(year, month)
      `)
      .order('submitted_at', { ascending: false });

    if (activeFilter === 'pending') {
      query = query.eq('status', 'بانتظار الموافقة');
    } else if (activeFilter === 'rejected') {
      query = query.eq('status', 'مرفوض');
    } else if (activeFilter === 'approved') {
      query = query.eq('status', 'موافقة');
    } else {
      query = query.in('status', ['بانتظار الموافقة', 'موافقة', 'مرفوض']);
    }

    const { data } = await query;
    setEvaluations((data as unknown as EvalItem[]) || []);
    setEmpLoading(false);
  }, [activeFilter]);

  const fetchDirectorEvaluations = useCallback(async () => {
    setDirLoading(true);

    let query = supabase
      .from('director_evaluations')
      .select(`
        id, status, final_score_500, final_score_5, percentage, general_rating,
        evaluator_note, director_note, ceo_comment, submitted_at,
        director:users!director_evaluations_director_id_fkey(full_name, job_title),
        evaluator:users!director_evaluations_evaluator_id_fkey(full_name),
        period:evaluation_periods(year, month)
      `)
      .eq('evaluation_type', 'ceo_director')
      .order('submitted_at', { ascending: false });

    if (activeFilter === 'pending') {
      query = query.eq('status', 'بانتظار الموافقة');
    } else if (activeFilter === 'rejected') {
      query = query.eq('status', 'مرفوض');
    } else if (activeFilter === 'approved') {
      query = query.eq('status', 'موافقة');
    } else {
      query = query.in('status', ['بانتظار الموافقة', 'موافقة', 'مرفوض']);
    }

    const { data } = await query;
    setDirectorEvals((data as unknown as DirectorEvalItem[]) || []);
    setDirLoading(false);
  }, [activeFilter]);

  const fetchDirMgrEvaluations = useCallback(async () => {
    setDirMgrLoading(true);

    let query = supabase
      .from('director_evaluations')
      .select(`
        id, status, final_score_500, final_score_5, percentage, general_rating,
        evaluator_note, director_note, ceo_comment, submitted_at,
        director:users!director_evaluations_director_id_fkey(full_name, job_title),
        evaluator:users!director_evaluations_evaluator_id_fkey(full_name),
        period:evaluation_periods(year, month)
      `)
      .eq('evaluation_type', 'director_manager')
      .order('submitted_at', { ascending: false });

    if (activeFilter === 'pending') {
      query = query.eq('status', 'بانتظار الموافقة');
    } else if (activeFilter === 'rejected') {
      query = query.eq('status', 'مرفوض');
    } else if (activeFilter === 'approved') {
      query = query.eq('status', 'موافقة');
    } else {
      query = query.in('status', ['بانتظار الموافقة', 'موافقة', 'مرفوض']);
    }

    const { data } = await query;
    setDirMgrEvals((data as unknown as DirectorEvalItem[]) || []);
    setDirMgrLoading(false);
  }, [activeFilter]);

  useEffect(() => {
    if (mainTab === 'managers') {
      fetchEmployeeEvaluations();
    } else if (mainTab === 'directors') {
      fetchDirMgrEvaluations();
    } else if (mainTab === 'ceo') {
      fetchDirectorEvaluations();
    }
  }, [mainTab, activeFilter, fetchEmployeeEvaluations, fetchDirectorEvaluations, fetchDirMgrEvaluations]);

  // View employee evaluation detail
  const viewEmpDetail = async (ev: EvalItem) => {
    setDetailLoading(true);
    setDetailModal(true);
    setDetailEval(ev);
    setDetailDirEval(null);

    const { data: scores } = await supabase
      .from('evaluation_scores')
      .select(`
        score_1_to_5, weighted_result, criterion_type,
        criterion:evaluation_criteria(title, description, weight),
        dept_criterion:department_criteria(title, description, weight)
      `)
      .eq('evaluation_id', ev.id);

    const scoreDetails: ScoreDetail[] = (scores || []).map((s: any) => ({
      criterion_title: s.criterion_type === 'specific' ? (s.dept_criterion?.title || '') : (s.criterion?.title || ''),
      criterion_description: s.criterion_type === 'specific' ? (s.dept_criterion?.description || '') : (s.criterion?.description || ''),
      criterion_weight: s.criterion_type === 'specific' ? (s.dept_criterion?.weight || 0) : (s.criterion?.weight || 0),
      score: s.score_1_to_5,
      weighted_result: s.weighted_result,
      type: s.criterion_type || 'general',
    }));

    setDetailScores(scoreDetails);
    setDetailLoading(false);
  };

  // View director evaluation detail
  const viewDirDetail = async (ev: DirectorEvalItem) => {
    setDetailLoading(true);
    setDetailModal(true);
    setDetailDirEval(ev);
    setDetailEval(null);

    const { data: scores } = await supabase
      .from('director_evaluation_scores')
      .select(`
        score_1_to_5, weighted_result, criterion_type,
        criterion:evaluation_criteria(title, description, weight),
        dept_criterion:department_criteria(title, description, weight)
      `)
      .eq('evaluation_id', ev.id);

    const scoreDetails: ScoreDetail[] = (scores || []).map((s: any) => ({
      criterion_title: s.criterion_type === 'specific' ? (s.dept_criterion?.title || '') : (s.criterion?.title || ''),
      criterion_description: s.criterion_type === 'specific' ? (s.dept_criterion?.description || '') : (s.criterion?.description || ''),
      criterion_weight: s.criterion_type === 'specific' ? (s.dept_criterion?.weight || 0) : (s.criterion?.weight || 0),
      score: s.score_1_to_5,
      weighted_result: s.weighted_result,
      type: s.criterion_type || 'general',
    }));

    setDetailScores(scoreDetails);
    setDetailLoading(false);
  };

  const handleApprove = async (id: string, type: 'employee' | 'director') => {
    if (!user) return;
    setActionLoading(true);

    const table = type === 'employee' ? 'evaluations' : 'director_evaluations';

    await supabase
      .from(table)
      .update({
        status: 'موافقة',
        ceo_comment: null,
        ceo_reviewed_at: new Date().toISOString(),
        ceo_reviewer_id: user.id,
      })
      .eq('id', id);

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: type === 'employee' ? 'موافقة على تقييم موظف' : 'موافقة على تقييم مدير',
      entity_type: table,
      entity_id: id,
    });

    setActionLoading(false);
    setDetailModal(false);
    setDetailEval(null);
    setDetailDirEval(null);
    if (type === 'employee') fetchEmployeeEvaluations();
    else if (mainTab === 'directors') fetchDirMgrEvaluations();
    else fetchDirectorEvaluations();
  };

  const openRejectModal = (id: string, type: 'employee' | 'director') => {
    setRejectTarget({ id, type });
    setRejectComment('');
    setRejectModal(true);
  };

  const handleReject = async () => {
    if (!user || !rejectTarget || !rejectComment.trim()) return;
    setActionLoading(true);

    const table = rejectTarget.type === 'employee' ? 'evaluations' : 'director_evaluations';

    await supabase
      .from(table)
      .update({
        status: 'مرفوض',
        ceo_comment: rejectComment,
        ceo_reviewed_at: new Date().toISOString(),
        ceo_reviewer_id: user.id,
      })
      .eq('id', rejectTarget.id);

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: rejectTarget.type === 'employee' ? 'رفض تقييم موظف' : 'رفض تقييم مدير',
      entity_type: table,
      entity_id: rejectTarget.id,
      details: { comment: rejectComment },
    });

    setActionLoading(false);
    setRejectModal(false);
    setRejectTarget(null);
    setDetailModal(false);
    setDetailEval(null);
    setDetailDirEval(null);
    if (rejectTarget.type === 'employee') fetchEmployeeEvaluations();
    else if (mainTab === 'directors') fetchDirMgrEvaluations();
    else fetchDirectorEvaluations();
  };

  const generalScores = detailScores.filter(s => s.type === 'general');
  const specificScores = detailScores.filter(s => s.type === 'specific');

  const filterTabs = [
    { key: 'pending' as const, label: 'قيد المراجعة', icon: <Clock className="h-4 w-4" /> },
    { key: 'rejected' as const, label: 'مرفوض', icon: <XCircle className="h-4 w-4" /> },
    { key: 'approved' as const, label: 'موافقة', icon: <CheckCircle className="h-4 w-4" /> },
    { key: 'all' as const, label: 'الكل', icon: <Filter className="h-4 w-4" /> },
  ];

  // Current detail subject
  const currentDetailStatus = detailEval?.status || detailDirEval?.status || '';
  const currentDetailId = detailEval?.id || detailDirEval?.id || '';
  const currentDetailType: 'employee' | 'director' = detailEval ? 'employee' : 'director';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">اعتمادية التقييمات</h1>
        <p className="text-gray-600 mt-2">مراجعة واعتماد جميع التقييمات</p>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setMainTab('managers')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            mainTab === 'managers'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <UserCog className="h-4 w-4" />
          <span>تقييمات مدراء الأقسام</span>
        </button>
        <button
          onClick={() => setMainTab('directors')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            mainTab === 'directors'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Landmark className="h-4 w-4" />
          <span>تقييمات مدراء الإدارات</span>
        </button>
        <button
          onClick={() => setMainTab('ceo')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            mainTab === 'ceo'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Crown className="h-4 w-4" />
          <span>تقييمات الإدارة العليا</span>
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeFilter === tab.key
                ? 'border-blue-600 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Manager Evaluations Table (managers evaluating employees) */}
      {mainTab === 'managers' && (
        empLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-gray-500">جاري التحميل...</div>
          </div>
        ) : (
          <Card>
            <CardBody className="p-0">
              {evaluations.length === 0 ? (
                <EmptyState
                  message={activeFilter === 'pending' ? 'لا توجد تقييمات بانتظار المراجعة' : 'لا توجد تقييمات'}
                  icon={<FileText className="h-12 w-12 text-gray-400" />}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الموظف</TableHead>
                      <TableHead>القسم</TableHead>
                      <TableHead>المدير المقيّم</TableHead>
                      <TableHead>فترة التقييم</TableHead>
                      <TableHead>النتيجة</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evaluations.map(ev => (
                      <TableRow key={ev.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                              {ev.employee?.full_name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <span className="font-medium text-gray-900">{ev.employee?.full_name}</span>
                              <p className="text-xs text-gray-500">{ev.employee?.job_title}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-700">{ev.department?.name || '-'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-700">{ev.manager?.full_name || '-'}</span>
                        </TableCell>
                        <TableCell>
                          {ev.period && (
                            <span className="text-sm text-gray-700">{monthLabels[ev.period.month]} {ev.period.year}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{ev.percentage?.toFixed(0)}%</span>
                            {ev.general_rating && (
                              <Badge variant={getRatingVariant(ev.general_rating)} size="sm">
                                {ev.general_rating}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(ev.status)} size="sm">{ev.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => viewEmpDetail(ev)} className="flex items-center gap-1">
                              <Eye className="h-4 w-4" />
                              <span>عرض</span>
                            </Button>
                            {ev.status === 'بانتظار الموافقة' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(ev.id, 'employee')}
                                  loading={actionLoading}
                                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  <span>موافقة</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => openRejectModal(ev.id, 'employee')}
                                  className="flex items-center gap-1"
                                >
                                  <XCircle className="h-4 w-4" />
                                  <span>رفض</span>
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardBody>
          </Card>
        )
      )}

      {/* Director → Manager evaluations */}
      {mainTab === 'directors' && (
        dirMgrLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-gray-500">جاري التحميل...</div>
          </div>
        ) : (
          <Card>
            <CardBody className="p-0">
              {dirMgrEvals.length === 0 ? (
                <EmptyState
                  message={activeFilter === 'pending' ? 'لا توجد تقييمات بانتظار المراجعة' : 'لا توجد تقييمات'}
                  icon={<Landmark className="h-12 w-12 text-gray-400" />}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>مدير القسم</TableHead>
                      <TableHead>مدير الإدارة المقيّم</TableHead>
                      <TableHead>فترة التقييم</TableHead>
                      <TableHead>النتيجة</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dirMgrEvals.map(ev => (
                      <TableRow key={ev.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                              {ev.director?.full_name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <span className="font-medium text-gray-900">{ev.director?.full_name}</span>
                              <p className="text-xs text-gray-500">{ev.director?.job_title}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-700">{ev.evaluator?.full_name || '-'}</span>
                        </TableCell>
                        <TableCell>
                          {ev.period && (
                            <span className="text-sm text-gray-700">{monthLabels[ev.period.month]} {ev.period.year}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{ev.percentage?.toFixed(0)}%</span>
                            {ev.general_rating && (
                              <Badge variant={getRatingVariant(ev.general_rating)} size="sm">
                                {ev.general_rating}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(ev.status)} size="sm">{ev.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => viewDirDetail(ev)} className="flex items-center gap-1">
                              <Eye className="h-4 w-4" />
                              <span>عرض</span>
                            </Button>
                            {ev.status === 'بانتظار الموافقة' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(ev.id, 'director')}
                                  loading={actionLoading}
                                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  <span>موافقة</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => openRejectModal(ev.id, 'director')}
                                  className="flex items-center gap-1"
                                >
                                  <XCircle className="h-4 w-4" />
                                  <span>رفض</span>
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardBody>
          </Card>
        )
      )}

      {/* CEO Evaluations of Directors */}
      {mainTab === 'ceo' && (
        dirLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-gray-500">جاري التحميل...</div>
          </div>
        ) : (
          <Card>
            <CardBody className="p-0">
              {directorEvals.length === 0 ? (
                <EmptyState
                  message={activeFilter === 'pending' ? 'لا توجد تقييمات بانتظار الاعتماد' : 'لا توجد تقييمات'}
                  icon={<Crown className="h-12 w-12 text-gray-400" />}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>مدير الإدارة</TableHead>
                      <TableHead>المقيّم</TableHead>
                      <TableHead>فترة التقييم</TableHead>
                      <TableHead>النتيجة</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {directorEvals.map(ev => (
                      <TableRow key={ev.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                              {ev.director?.full_name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <span className="font-medium text-gray-900">{ev.director?.full_name}</span>
                              <p className="text-xs text-gray-500">{ev.director?.job_title}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-700">{ev.evaluator?.full_name || '-'}</span>
                        </TableCell>
                        <TableCell>
                          {ev.period && (
                            <span className="text-sm text-gray-700">{monthLabels[ev.period.month]} {ev.period.year}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{ev.percentage?.toFixed(0)}%</span>
                            {ev.general_rating && (
                              <Badge variant={getRatingVariant(ev.general_rating)} size="sm">
                                {ev.general_rating}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(ev.status)} size="sm">{ev.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => viewDirDetail(ev)} className="flex items-center gap-1">
                              <Eye className="h-4 w-4" />
                              <span>عرض</span>
                            </Button>
                            {ev.status === 'بانتظار الموافقة' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(ev.id, 'director')}
                                  loading={actionLoading}
                                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  <span>موافقة</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => openRejectModal(ev.id, 'director')}
                                  className="flex items-center gap-1"
                                >
                                  <XCircle className="h-4 w-4" />
                                  <span>رفض</span>
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardBody>
          </Card>
        )
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={detailModal}
        onClose={() => { setDetailModal(false); setDetailEval(null); setDetailDirEval(null); }}
        title={
          detailEval
            ? `تفاصيل تقييم: ${detailEval.employee?.full_name}`
            : detailDirEval
              ? `تفاصيل تقييم: ${detailDirEval.director?.full_name}`
              : 'تفاصيل التقييم'
        }
        size="lg"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">جاري التحميل...</div>
          </div>
        ) : (detailEval || detailDirEval) ? (
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900 text-lg">
                    {detailEval?.employee?.full_name || detailDirEval?.director?.full_name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {detailEval?.employee?.job_title || detailDirEval?.director?.job_title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    المقيّم: {detailEval?.manager?.full_name || detailDirEval?.evaluator?.full_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">فترة التقييم</p>
                  <p className="font-medium text-gray-900">
                    {(() => {
                      const period = detailEval?.period || detailDirEval?.period;
                      return period ? `${monthLabels[period.month]} ${period.year}` : '';
                    })()}
                  </p>
                  <Badge variant={getStatusVariant(currentDetailStatus)} size="sm" className="mt-1">
                    {currentDetailStatus}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Final Results */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 mb-1">النتيجة / 500</p>
                <p className="text-xl font-bold text-blue-700">
                  {(detailEval?.final_score_500 ?? detailDirEval?.final_score_500)?.toFixed(1)}
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <p className="text-xs text-purple-600 mb-1">النتيجة / 5</p>
                <p className="text-xl font-bold text-purple-700">
                  {(detailEval?.final_score_5 ?? detailDirEval?.final_score_5)?.toFixed(2)}
                </p>
              </div>
              <div className="bg-teal-50 rounded-lg p-3 text-center">
                <p className="text-xs text-teal-600 mb-1">النسبة المئوية</p>
                <p className="text-xl font-bold text-teal-700">
                  {(detailEval?.percentage ?? detailDirEval?.percentage)?.toFixed(0)}%
                </p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-xs text-amber-600 mb-1">التقدير العام</p>
                {(() => {
                  const rating = detailEval?.general_rating || detailDirEval?.general_rating;
                  return rating ? (
                    <Badge variant={getRatingVariant(rating)}>{rating}</Badge>
                  ) : (
                    <span className="text-gray-400 text-sm">-</span>
                  );
                })()}
              </div>
            </div>

            {/* General Criteria */}
            {generalScores.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-blue-700 mb-2 flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  المعايير العامة
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-blue-50">
                      <tr>
                        <th className="px-4 py-2 text-right text-xs font-medium text-blue-700">المعيار</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-blue-700">الوزن</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-blue-700">الدرجة</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-blue-700">النتيجة الموزونة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {generalScores.map((s, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2">
                            <p className="font-medium text-gray-900">{s.criterion_title}</p>
                            <p className="text-xs text-gray-500">{s.criterion_description}</p>
                          </td>
                          <td className="px-4 py-2 text-gray-700">{s.criterion_weight}%</td>
                          <td className="px-4 py-2 font-bold text-gray-900">{s.score}/5</td>
                          <td className="px-4 py-2 font-bold text-blue-600">{s.weighted_result?.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Specific Criteria */}
            {specificScores.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-emerald-700 mb-2 flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  المعايير الخاصة
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-emerald-50">
                      <tr>
                        <th className="px-4 py-2 text-right text-xs font-medium text-emerald-700">المعيار</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-emerald-700">الوزن</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-emerald-700">الدرجة</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-emerald-700">النتيجة الموزونة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {specificScores.map((s, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2">
                            <p className="font-medium text-gray-900">{s.criterion_title}</p>
                            <p className="text-xs text-gray-500">{s.criterion_description}</p>
                          </td>
                          <td className="px-4 py-2 text-gray-700">{s.criterion_weight}%</td>
                          <td className="px-4 py-2 font-bold text-gray-900">{s.score}/5</td>
                          <td className="px-4 py-2 font-bold text-emerald-600">{s.weighted_result?.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes */}
            {(detailEval?.manager_note || detailDirEval?.evaluator_note) && (
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs font-medium text-blue-700 mb-1">ملاحظات المقيّم</p>
                <p className="text-sm text-gray-800">{detailEval?.manager_note || detailDirEval?.evaluator_note}</p>
              </div>
            )}

            {/* Reply from evaluated person */}
            {(detailEval?.employee_note || detailDirEval?.director_note) && (
              <div className="bg-teal-50 rounded-lg p-4">
                <p className="text-xs font-medium text-teal-700 mb-1">
                  {detailEval ? 'رد الموظف على التقييم' : 'رد المقيَّم على التقييم'}
                </p>
                <p className="text-sm text-gray-800">{detailEval?.employee_note || detailDirEval?.director_note}</p>
              </div>
            )}

            {/* Previous CEO Comment */}
            {(detailEval?.ceo_comment || detailDirEval?.ceo_comment) && (
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-xs font-medium text-red-700 mb-1">سبب الرفض السابق</p>
                <p className="text-sm text-gray-800">{detailEval?.ceo_comment || detailDirEval?.ceo_comment}</p>
              </div>
            )}

            {/* Action buttons inside modal */}
            {currentDetailStatus === 'بانتظار الموافقة' && (
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <Button
                  onClick={() => handleApprove(currentDetailId, currentDetailType)}
                  loading={actionLoading}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-5 w-5" />
                  <span>الموافقة على التقييم</span>
                </Button>
                <Button
                  variant="danger"
                  onClick={() => { setDetailModal(false); openRejectModal(currentDetailId, currentDetailType); }}
                  className="flex items-center gap-2"
                >
                  <XCircle className="h-5 w-5" />
                  <span>رفض التقييم</span>
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModal}
        onClose={() => setRejectModal(false)}
        title="رفض التقييم"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            يرجى كتابة سبب الرفض ليتمكن المقيّم من تعديل التقييم وإعادة إرساله.
          </p>
          <TextArea
            label="سبب الرفض"
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            rows={4}
            placeholder="اكتب سبب رفض التقييم..."
            required
          />
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setRejectModal(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleReject}
              loading={actionLoading}
              disabled={!rejectComment.trim()}
              className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
            >
              <XCircle className="h-4 w-4" />
              <span>تأكيد الرفض</span>
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
};
