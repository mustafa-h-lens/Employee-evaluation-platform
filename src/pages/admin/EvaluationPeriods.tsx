import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal, ModalFooter } from '../../components/ui/Modal';
import { Badge, getStatusBadgeVariant } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Plus, CreditCard as Edit, Trash2, Calendar, AlertTriangle, Play, Lock, ArrowDown, ArrowUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ModernSelect } from '../../components/ui/ModernSelect';
import { CeoEvaluationPeriods } from './CeoEvaluationPeriods';

interface EvaluationPeriod {
  id: string;
  year: number;
  month: number;
  start_date: string;
  end_date: string;
  status: 'نشطة' | 'مغلقة' | 'قادمة';
  evaluation_count?: number;
}

interface FormData {
  year: string;
  month: string;
  start_date: string;
  end_date: string;
  status: 'نشطة' | 'مغلقة' | 'قادمة';
}

const defaultFormData: FormData = {
  year: new Date().getFullYear().toString(),
  month: '1',
  start_date: '',
  end_date: '',
  status: 'قادمة',
};

const monthLabels: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
};

const getMonthDates = (year: number, month: number) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start_date: start.toISOString().split('T')[0],
    end_date: end.toISOString().split('T')[0],
  };
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const EvaluationPeriods: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'top-down' | 'bottom-up'>('top-down');
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<EvaluationPeriod | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<EvaluationPeriod | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [statusChangeTarget, setStatusChangeTarget] = useState<{ period: EvaluationPeriod; newStatus: string } | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    fetchPeriods();
  }, []);

  const fetchPeriods = async () => {
    try {
      const { data, error } = await supabase
        .from('evaluation_periods')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (!error && data) {
        const periodsWithCount = await Promise.all(
          data.map(async (period) => {
            const { count } = await supabase
              .from('evaluations')
              .select('*', { count: 'exact', head: true })
              .eq('period_id', period.id);
            return { ...period, evaluation_count: count || 0 };
          })
        );
        setPeriods(periodsWithCount);
      }
    } catch (error) {
      console.error('Error fetching periods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (month: string) => {
    const m = parseInt(month);
    const y = parseInt(formData.year);
    const { start_date, end_date } = getMonthDates(y, m);
    setFormData({ ...formData, month, start_date, end_date });
  };

  const handleYearChange = (year: string) => {
    const y = parseInt(year);
    const m = parseInt(formData.month);
    if (!isNaN(y) && y > 2000 && y < 2100) {
      const { start_date, end_date } = getMonthDates(y, m);
      setFormData({ ...formData, year, start_date, end_date });
    } else {
      setFormData({ ...formData, year });
    }
  };

  const openAddModal = () => {
    setEditingPeriod(null);
    const currentYear = new Date().getFullYear();
    const { start_date, end_date } = getMonthDates(currentYear, 1);
    setFormData({ ...defaultFormData, year: currentYear.toString(), start_date, end_date });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (period: EvaluationPeriod) => {
    setEditingPeriod(period);
    setFormData({
      year: period.year.toString(),
      month: period.month.toString(),
      start_date: period.start_date,
      end_date: period.end_date,
      status: period.status,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);

    const year = parseInt(formData.year);
    const month = parseInt(formData.month);

    if (!year || year < 2000 || year > 2100) {
      setFormError('يرجى إدخال سنة صحيحة');
      setSaving(false);
      return;
    }

    if (!formData.start_date || !formData.end_date) {
      setFormError('يرجى تحديد تواريخ البداية والنهاية');
      setSaving(false);
      return;
    }

    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      setFormError('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
      setSaving(false);
      return;
    }

    try {
      if (editingPeriod) {
        const { error } = await supabase
          .from('evaluation_periods')
          .update({
            year,
            month,
            start_date: formData.start_date,
            end_date: formData.end_date,
            status: formData.status,
          })
          .eq('id', editingPeriod.id);

        if (error) {
          if (error.message.includes('unique') || error.message.includes('duplicate')) {
            setFormError(`الفترة ${monthLabels[month]} ${year} موجودة بالفعل`);
          } else {
            setFormError(error.message);
          }
          setSaving(false);
          return;
        }

        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'تحديث فترة تقييم',
            entity_type: 'evaluation_periods',
            entity_id: editingPeriod.id,
            details: { year, month: monthLabels[month], status: formData.status },
          });
        }
      } else {
        // Get current global weight settings for defaults
        const { data: settings } = await supabase
          .from('evaluation_settings')
          .select('general_weight, specific_weight')
          .limit(1)
          .single();

        const { data, error } = await supabase
          .from('evaluation_periods')
          .insert({
            year,
            month,
            start_date: formData.start_date,
            end_date: formData.end_date,
            status: formData.status,
            general_weight: settings?.general_weight ?? 50,
            specific_weight: settings?.specific_weight ?? 50,
          })
          .select()
          .single();

        if (error) {
          if (error.message.includes('unique') || error.message.includes('duplicate')) {
            setFormError(`الفترة ${monthLabels[month]} ${year} موجودة بالفعل`);
          } else {
            setFormError(error.message);
          }
          setSaving(false);
          return;
        }

        if (user && data) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'إضافة فترة تقييم',
            entity_type: 'evaluation_periods',
            entity_id: data.id,
            details: { year, month: monthLabels[month], status: formData.status },
          });
        }
      }

      setIsModalOpen(false);
      setEditingPeriod(null);
      fetchPeriods();
    } catch (error) {
      console.error('Error saving period:', error);
      setFormError('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (period: EvaluationPeriod) => {
    setDeleteTarget(period);
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const { error } = await supabase
        .from('evaluation_periods')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) {
        setDeleteError('فشل حذف الفترة. تأكد من عدم وجود تقييمات مرتبطة بها.');
        setDeleting(false);
        return;
      }

      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'حذف فترة تقييم',
          entity_type: 'evaluation_periods',
          entity_id: deleteTarget.id,
          details: { year: deleteTarget.year, month: monthLabels[deleteTarget.month] },
        });
      }

      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      fetchPeriods();
    } catch (error) {
      console.error('Error deleting period:', error);
    } finally {
      setDeleting(false);
    }
  };

  const confirmStatusChange = (period: EvaluationPeriod, newStatus: string) => {
    setStatusChangeTarget({ period, newStatus });
    setIsStatusModalOpen(true);
  };

  const handleStatusChange = async () => {
    if (!statusChangeTarget) return;
    setChangingStatus(true);

    const { period, newStatus } = statusChangeTarget;

    try {
      const { error } = await supabase
        .from('evaluation_periods')
        .update({ status: newStatus })
        .eq('id', period.id);

      if (error) {
        console.error('Error changing status:', error);
        setChangingStatus(false);
        return;
      }

      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'تغيير حالة فترة تقييم',
          entity_type: 'evaluation_periods',
          entity_id: period.id,
          details: {
            year: period.year,
            month: monthLabels[period.month],
            from: period.status,
            to: newStatus,
          },
        });
      }

      setIsStatusModalOpen(false);
      setStatusChangeTarget(null);
      fetchPeriods();
    } catch (error) {
      console.error('Error changing status:', error);
    } finally {
      setChangingStatus(false);
    }
  };

  const getStatusActionButtons = (period: EvaluationPeriod) => {
    const buttons: React.ReactNode[] = [];

    if (period.status === 'قادمة') {
      buttons.push(
        <Button
          key="activate"
          size="sm"
          variant="success"
          onClick={() => confirmStatusChange(period, 'نشطة')}
          className="flex items-center gap-1"
        >
          <Play className="h-3.5 w-3.5" />
          <span>تفعيل</span>
        </Button>
      );
    }

    if (period.status === 'نشطة') {
      buttons.push(
        <Button
          key="close"
          size="sm"
          variant="danger"
          onClick={() => confirmStatusChange(period, 'مغلقة')}
          className="flex items-center gap-1"
        >
          <Lock className="h-3.5 w-3.5" />
          <span>إغلاق</span>
        </Button>
      );
    }

    return buttons;
  };

  const statusChangeLabel = () => {
    if (!statusChangeTarget) return '';
    const { newStatus } = statusChangeTarget;
    if (newStatus === 'نشطة') return 'تفعيل';
    if (newStatus === 'مغلقة') return 'إغلاق';
    return 'تغيير حالة';
  };

  if (loading) {
    return <div className="page-loading-placeholder" aria-hidden="true" />;
  }

  const activePeriod = periods.find(p => p.status === 'نشطة');
  const upcomingPeriods = periods.filter(p => p.status === 'قادمة');
  const closedPeriods = periods.filter(p => p.status === 'مغلقة');

  return (
    <div className="space-y-6">
      <div
        className="rounded-ds-xl p-8"
        style={{
          background: 'var(--sc-purple-grad)',
          border: '1px solid var(--sc-purple-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-purple-val)' }}>فترات التقييم</h1>
        <p className="mt-2" style={{ color: 'var(--sc-purple-label)' }}>إدارة فترات التقييم الشهرية والربعية</p>
      </div>

      <div className="flex gap-1 border-b border-ds-border">
        <button
          onClick={() => setActiveTab('top-down')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'top-down'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-ds-faint hover:text-ds-muted'
          }`}
        >
          <ArrowDown className="h-4 w-4" />
          <span>تقييم من أعلى لأسفل</span>
        </button>
        <button
          onClick={() => setActiveTab('bottom-up')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'bottom-up'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-ds-faint hover:text-ds-muted'
          }`}
        >
          <ArrowUp className="h-4 w-4" />
          <span>تقييم من أسفل لأعلى</span>
        </button>
      </div>

      {activeTab === 'bottom-up' && <CeoEvaluationPeriods embedded />}

      {activeTab === 'top-down' && (<>
      <div className="flex items-center justify-end">
        <Button onClick={openAddModal} className="flex items-center gap-2">
          <span>إضافة فترة</span>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ds-muted mb-1">الفترة النشطة</p>
                <p className="text-xl font-bold text-ds-text">
                  {activePeriod
                    ? `${monthLabels[activePeriod.month]} - ${activePeriod.year}`
                    : 'لا يوجد'}
                </p>
              </div>
              <div className="bg-ds-success-bg text-ds-success p-3 rounded-xl">
                <Play className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ds-muted mb-1">فترات قادمة</p>
                <p className="text-xl font-bold text-ds-text">{upcomingPeriods.length}</p>
              </div>
              <div className="bg-ds-info-bg text-ds-info p-3 rounded-xl">
                <Calendar className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ds-muted mb-1">فترات مغلقة</p>
                <p className="text-xl font-bold text-ds-text">{closedPeriods.length}</p>
              </div>
              <div className="bg-ds-overlay text-ds-muted p-3 rounded-xl">
                <Lock className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="p-0">
          {periods.length === 0 ? (
            <EmptyState
              message="لا توجد فترات تقييم مضافة حاليًا"
              icon={<Calendar className="h-12 w-12 text-ds-faint" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الفترة</TableHead>
                  <TableHead>تاريخ البداية</TableHead>
                  <TableHead>تاريخ النهاية</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>عدد التقييمات</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell>
                      <div>
                        <span className="font-bold text-ds-text">
                          {monthLabels[period.month]}
                        </span>
                        <span className="text-ds-faint mr-2">{period.year}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(period.start_date)}</TableCell>
                    <TableCell>{formatDate(period.end_date)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(period.status)}>
                        {period.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{period.evaluation_count}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusActionButtons(period)}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(period)}
                          className="flex items-center gap-1"
                        >
                          <Edit className="h-4 w-4" />
                          <span>تعديل</span>
                        </Button>
                        {period.evaluation_count === 0 && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => confirmDelete(period)}
                            className="flex items-center gap-1"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>حذف</span>
                          </Button>
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
      </>)}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPeriod ? 'تعديل فترة التقييم' : 'إضافة فترة تقييم جديدة'}
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {formError && (
              <div className="bg-ds-danger-bg border border-ds-danger-border rounded-lg p-3 text-ds-danger-text text-sm">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="السنة"
                type="number"
                value={formData.year}
                onChange={(e) => handleYearChange(e.target.value)}
                required
                min={2020}
                max={2099}
              />
              <div>
                <label className="block text-sm font-medium text-ds-muted mb-1">
                  الشهر
                </label>
                <ModernSelect
                  value={String(formData.month)}
                  onChange={handleMonthChange}
                  ariaLabel="الشهر"
                  options={Object.entries(monthLabels).map(([value, label]) => ({ value, label }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="تاريخ البداية"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
              <Input
                label="تاريخ النهاية"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
              />
            </div>

            {editingPeriod && (
              <div>
                <label className="block text-sm font-medium text-ds-muted mb-1">
                  الحالة
                </label>
                <ModernSelect
                  value={formData.status}
                  onChange={(v) => setFormData({ ...formData, status: v as FormData['status'] })}
                  ariaLabel="الحالة"
                  options={[
                    { value: 'قادمة', label: 'قادمة' },
                    { value: 'نشطة', label: 'نشطة' },
                    { value: 'مغلقة', label: 'مغلقة' },
                  ]}
                />
              </div>
            )}
          </div>

          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" loading={saving}>
              {editingPeriod ? 'تحديث' : 'إضافة'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="تأكيد الحذف"
      >
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 bg-ds-danger-bg rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-ds-text text-lg font-medium mb-2">
            هل أنت متأكد من حذف هذه الفترة؟
          </p>
          <p className="text-ds-faint text-sm">
            سيتم حذف فترة{' '}
            <span className="font-bold text-ds-muted">
              {deleteTarget && `${monthLabels[deleteTarget.month]} - ${deleteTarget.year}`}
            </span>{' '}
            نهائيًا.
          </p>
          {deleteError && (
            <div className="mt-4 bg-ds-danger-bg border border-ds-danger-border rounded-lg p-3 text-ds-danger-text text-sm">
              {deleteError}
            </div>
          )}
        </div>
        <ModalFooter className="justify-center">
          <Button type="button" variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
            إلغاء
          </Button>
          <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
            <span className="flex items-center gap-1">
              <Trash2 className="h-4 w-4" />
              <span>حذف الفترة</span>
            </span>
          </Button>
        </ModalFooter>
      </Modal>

      {/* Status Change Confirmation Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title="تأكيد تغيير الحالة"
      >
        <div className="flex flex-col items-center text-center py-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
            statusChangeTarget?.newStatus === 'نشطة' ? 'bg-ds-success-bg' : 'bg-ds-danger-bg'
          }`}>
            {statusChangeTarget?.newStatus === 'نشطة' ? (
              <Play className="h-7 w-7 text-green-600" />
            ) : (
              <Lock className="h-7 w-7 text-red-600" />
            )}
          </div>
          <p className="text-ds-text text-lg font-medium mb-2">
            هل أنت متأكد من {statusChangeLabel()} هذه الفترة؟
          </p>
          <p className="text-ds-faint text-sm">
            {statusChangeTarget?.newStatus === 'نشطة'
              ? 'سيتم تفعيل الفترة وستتمكن الإدارات من إنشاء تقييمات خلالها.'
              : 'سيتم إغلاق الفترة ولن يتمكن أحد من إنشاء تقييمات جديدة خلالها.'}
          </p>
          {statusChangeTarget && (
            <div className="mt-3 flex items-center gap-2">
              <Badge variant={getStatusBadgeVariant(statusChangeTarget.period.status)}>
                {statusChangeTarget.period.status}
              </Badge>
              <span className="text-ds-faint">←</span>
              <Badge variant={getStatusBadgeVariant(statusChangeTarget.newStatus)}>
                {statusChangeTarget.newStatus}
              </Badge>
            </div>
          )}
        </div>
        <ModalFooter className="justify-center">
          <Button type="button" variant="secondary" onClick={() => setIsStatusModalOpen(false)}>
            إلغاء
          </Button>
          <Button
            type="button"
            variant={statusChangeTarget?.newStatus === 'نشطة' ? 'success' : 'danger'}
            onClick={handleStatusChange}
            loading={changingStatus}
          >
            {statusChangeLabel()}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};
