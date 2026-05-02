import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, TextArea } from '../../components/ui/Input';
import { Modal, ModalFooter } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import {
  Plus,
  CreditCard as Edit,
  Trash2,
  ClipboardList,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Scale,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Toggle } from '../../components/ui/Toggle';
import { useAuth } from '../../contexts/AuthContext';

interface DeptCriterion {
  id: string;
  department_id: string | null;
  directorate_id: string | null;
  group_id: string | null;
  title: string;
  description: string;
  weight: number;
  order: number;
  is_active: boolean;
  created_by: string | null;
}

interface FormData {
  title: string;
  description: string;
  weight: string;
  is_active: boolean;
}

const defaultFormData: FormData = {
  title: '',
  description: '',
  weight: '',
  is_active: true,
};

interface Props {
  // When true, the section renders its body without a collapse toggle —
  // suitable for use inside a tab panel where the surrounding tab is the
  // toggle. Default false keeps the original collapsible card behavior.
  embedded?: boolean;
}

export const DirectorCriteriaSection: React.FC<Props> = ({ embedded = false }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(embedded);
  const [criteria, setCriteria] = useState<DeptCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<DeptCriterion | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [specificWeightLimit, setSpecificWeightLimit] = useState(50);

  const [deleteTarget, setDeleteTarget] = useState<DeptCriterion | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    const { data: period } = await supabase
      .from('evaluation_periods')
      .select('specific_weight')
      .eq('status', 'نشطة')
      .maybeSingle();
    if (period && period.specific_weight != null) {
      setSpecificWeightLimit(period.specific_weight);
      return;
    }
    const { data } = await supabase
      .from('evaluation_settings')
      .select('specific_weight')
      .limit(1)
      .maybeSingle();
    if (data) setSpecificWeightLimit(data.specific_weight);
  }, []);

  const fetchCriteria = useCallback(async () => {
    if (!user) return;
    try {
      // Scope: ONLY this CEO's private criteria for evaluating directors.
      // (department_id, directorate_id, group_id) all null isolates this row
      // from directorate-employee criteria; created_by isolates Saad/Ahmed.
      const { data, error } = await supabase
        .from('department_criteria')
        .select('*')
        .is('department_id', null)
        .is('directorate_id', null)
        .is('group_id', null)
        .eq('created_by', user.id)
        .order('order', { ascending: true });

      if (!error && data) setCriteria(data);
    } catch (error) {
      console.error('Error fetching criteria:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
    fetchCriteria();
  }, [fetchSettings, fetchCriteria]);

  const totalWeight = criteria
    .filter(c => c.is_active)
    .reduce((sum, c) => sum + c.weight, 0);

  const openAddModal = () => {
    setEditingCriterion(null);
    setFormData(defaultFormData);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (criterion: DeptCriterion) => {
    setEditingCriterion(criterion);
    setFormData({
      title: criterion.title,
      description: criterion.description,
      weight: criterion.weight.toString(),
      is_active: criterion.is_active,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);

    const weight = parseFloat(formData.weight);

    if (!formData.title.trim()) {
      setFormError('يرجى إدخال عنوان المعيار');
      setSaving(false);
      return;
    }
    if (!formData.description.trim()) {
      setFormError('يرجى إدخال وصف المعيار');
      setSaving(false);
      return;
    }
    if (!weight || weight < 1 || weight > 100) {
      setFormError('يرجى إدخال وزن صحيح (1-100)');
      setSaving(false);
      return;
    }

    try {
      if (editingCriterion) {
        const { error } = await supabase
          .from('department_criteria')
          .update({
            title: formData.title.trim(),
            description: formData.description.trim(),
            weight,
            is_active: formData.is_active,
          })
          .eq('id', editingCriterion.id);

        if (error) {
          setFormError(error.message);
          setSaving(false);
          return;
        }

        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'تحديث معيار خاص بتقييم المدراء',
            entity_type: 'department_criteria',
            entity_id: editingCriterion.id,
            details: { title: formData.title, weight },
          });
        }
      } else {
        const maxOrder = criteria.length > 0 ? Math.max(...criteria.map(c => c.order)) : 0;

        const { data, error } = await supabase
          .from('department_criteria')
          .insert({
            department_id: null,
            directorate_id: null,
            group_id: null,
            title: formData.title.trim(),
            description: formData.description.trim(),
            weight,
            order: maxOrder + 1,
            is_active: formData.is_active,
            created_by: user?.id || null,
          })
          .select()
          .single();

        if (error) {
          setFormError(error.message);
          setSaving(false);
          return;
        }

        if (user && data) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'إضافة معيار خاص بتقييم المدراء',
            entity_type: 'department_criteria',
            entity_id: data.id,
            details: { title: formData.title, weight },
          });
        }
      }

      setIsModalOpen(false);
      setEditingCriterion(null);
      fetchCriteria();
    } catch (error) {
      console.error('Error saving criterion:', error);
      setFormError('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (criterion: DeptCriterion) => {
    setDeleteTarget(criterion);
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const { error } = await supabase
        .from('department_criteria')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) {
        setDeleteError('فشل حذف المعيار.');
        setDeleting(false);
        return;
      }

      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'حذف معيار خاص بتقييم المدراء',
          entity_type: 'department_criteria',
          entity_id: deleteTarget.id,
          details: { title: deleteTarget.title },
        });
      }

      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      fetchCriteria();
    } catch (error) {
      console.error('Error deleting criterion:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (criterion: DeptCriterion) => {
    const newActive = !criterion.is_active;
    const { error } = await supabase
      .from('department_criteria')
      .update({ is_active: newActive })
      .eq('id', criterion.id);

    if (!error) {
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: newActive ? 'تفعيل معيار خاص' : 'تعطيل معيار خاص',
          entity_type: 'department_criteria',
          entity_id: criterion.id,
          details: { title: criterion.title, is_active: newActive },
        });
      }
      fetchCriteria();
    }
  };

  const handleReorder = async (criterion: DeptCriterion, direction: 'up' | 'down') => {
    const currentIndex = criteria.findIndex(c => c.id === criterion.id);
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= criteria.length) return;
    const swapCriterion = criteria[swapIndex];
    await Promise.all([
      supabase.from('department_criteria').update({ order: swapCriterion.order }).eq('id', criterion.id),
      supabase.from('department_criteria').update({ order: criterion.order }).eq('id', swapCriterion.id),
    ]);
    fetchCriteria();
  };

  const activeCount = criteria.filter(c => c.is_active).length;
  const inactiveCount = criteria.filter(c => !c.is_active).length;

  return (
    <Card>
      <CardBody className="p-0">
        {embedded ? (
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-ds-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ds-text">معاييري الخاصة لتقييم المدراء</h2>
                <p className="text-xs text-ds-muted mt-0.5">
                  هذه المعايير تظهر فقط أثناء تقييم مديري الإدارات (لا تُستخدم لتقييم الموظفين)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={totalWeight === specificWeightLimit ? 'success' : 'warning'} size="sm">
                {totalWeight}% / {specificWeightLimit}%
              </Badge>
              <Badge variant="info" size="sm">{activeCount} نشط</Badge>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="w-full flex items-center justify-between gap-4 px-6 py-4 text-right hover:bg-ds-overlay/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ds-text">معاييري الخاصة لتقييم المدراء</h2>
                <p className="text-xs text-ds-muted mt-0.5">
                  هذه المعايير تظهر فقط أثناء تقييم مديري الإدارات (لا تُستخدم لتقييم الموظفين)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={totalWeight === specificWeightLimit ? 'success' : 'warning'} size="sm">
                {totalWeight}% / {specificWeightLimit}%
              </Badge>
              <Badge variant="info" size="sm">{activeCount} نشط</Badge>
              {open ? <ChevronUp className="h-5 w-5 text-ds-faint" /> : <ChevronDown className="h-5 w-5 text-ds-faint" />}
            </div>
          </button>
        )}

        {open && (
          <div className="border-t border-ds-border-subtle p-6 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-ds-muted">جاري التحميل...</div>
            ) : (
              <>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2 text-sm text-ds-muted">
                    <Scale className="h-4 w-4" />
                    <span>النسبة المخصصة من إجمالي التقييم: <strong className="text-ds-text">{specificWeightLimit}%</strong></span>
                    <span className="mx-2 text-ds-faint">·</span>
                    <span>{activeCount} نشط · {inactiveCount} معطل</span>
                  </div>
                  <Button onClick={openAddModal} size="sm" className="flex items-center gap-2">
                    <span>إضافة معيار</span>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {totalWeight !== specificWeightLimit && criteria.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <p className="text-amber-800 text-sm">
                      مجموع أوزان المعايير الخاصة النشطة يجب أن يساوي {specificWeightLimit}%. المجموع الحالي: <span className="font-bold">{totalWeight}%</span>
                    </p>
                  </div>
                )}

                {criteria.length === 0 ? (
                  <EmptyState
                    message="لا توجد معايير خاصة مضافة لتقييم المدراء حاليًا"
                    icon={<ClipboardList className="h-10 w-10 text-ds-faint" />}
                  />
                ) : (
                  <div className="border border-ds-border-subtle rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"> </TableHead>
                          <TableHead>المعيار</TableHead>
                          <TableHead>الوصف</TableHead>
                          <TableHead>الحالة</TableHead>
                          <TableHead>الترتيب</TableHead>
                          <TableHead>الوزن</TableHead>
                          <TableHead>الإجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {criteria.map((criterion, index) => {
                          const isExpanded = expandedId === criterion.id;
                          const stop = (e: React.MouseEvent) => e.stopPropagation();
                          return (
                            <React.Fragment key={criterion.id}>
                              <TableRow
                                className={`${!criterion.is_active ? 'opacity-60 bg-ds-bg' : ''} ${isExpanded ? 'bg-purple-50/40' : ''}`}
                                onClick={() => setExpandedId(isExpanded ? null : criterion.id)}
                              >
                                <TableCell className="text-ds-faint">
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                      <GripVertical className="h-4 w-4" />
                                    </div>
                                    <span className="font-bold text-ds-text">{criterion.title}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <p className="text-ds-faint text-sm max-w-xs truncate">{criterion.description}</p>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={criterion.is_active ? 'success' : 'default'}>
                                    {criterion.is_active ? 'نشط' : 'معطل'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1" onClick={stop}>
                                    <button
                                      onClick={() => handleReorder(criterion, 'up')}
                                      disabled={index === 0}
                                      className="p-1 rounded hover:bg-ds-overlay disabled:opacity-30 disabled:cursor-not-allowed text-ds-faint"
                                    >
                                      <ArrowUp className="h-4 w-4" />
                                    </button>
                                    <span className="text-ds-faint text-sm font-mono w-6 text-center">{criterion.order}</span>
                                    <button
                                      onClick={() => handleReorder(criterion, 'down')}
                                      disabled={index === criteria.length - 1}
                                      className="p-1 rounded hover:bg-ds-overlay disabled:opacity-30 disabled:cursor-not-allowed text-ds-faint"
                                    >
                                      <ArrowDown className="h-4 w-4" />
                                    </button>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 bg-gray-200 rounded-full h-2">
                                      <div
                                        className="bg-purple-600 h-2 rounded-full transition-all"
                                        style={{ width: `${(criterion.weight / specificWeightLimit) * 100}%` }}
                                      />
                                    </div>
                                    <span className="font-bold text-purple-600">{criterion.weight}%</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2" onClick={stop}>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openEditModal(criterion)}
                                      className="flex items-center gap-1"
                                    >
                                      <Edit className="h-4 w-4" />
                                      <span>تعديل</span>
                                    </Button>
                                    <Toggle
                                      checked={criterion.is_active}
                                      onChange={() => handleToggleActive(criterion)}
                                      size="sm"
                                    />
                                    <Button
                                      size="sm"
                                      variant="danger"
                                      onClick={() => confirmDelete(criterion)}
                                      className="flex items-center gap-1"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {isExpanded && (
                                <TableRow className="bg-purple-50/40">
                                  <TableCell colSpan={7} className="!whitespace-normal">
                                    <div className="px-2 py-1">
                                      <p className="text-xs font-semibold text-purple-700 mb-1">الوصف الكامل</p>
                                      <p className="text-sm text-ds-muted leading-relaxed whitespace-pre-wrap">{criterion.description}</p>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardBody>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCriterion ? 'تعديل معيار خاص' : 'إضافة معيار خاص جديد'}
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {formError}
              </div>
            )}
            <Input
              label="عنوان المعيار"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="مثال: القيادة الاستراتيجية"
              required
            />
            <TextArea
              label="وصف المعيار"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="وصف مختصر لما يقيسه هذا المعيار"
              rows={3}
              required
            />
            <Input
              label="الوزن (%)"
              type="number"
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
              placeholder="مثال: 10"
              min={1}
              max={specificWeightLimit}
              step={0.5}
              required
              helperText={`مجموع أوزان المعايير الخاصة النشطة الحالي: ${totalWeight}% من ${specificWeightLimit}%`}
            />
            {editingCriterion && (
              <div className="flex items-center justify-between p-3 bg-ds-bg rounded-lg">
                <Toggle
                  checked={formData.is_active}
                  onChange={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  size="sm"
                />
                <span className="text-sm font-medium text-ds-muted">
                  {formData.is_active ? 'المعيار نشط' : 'المعيار معطل'}
                </span>
              </div>
            )}
          </div>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" loading={saving}>
              {editingCriterion ? 'تحديث' : 'إضافة'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="تأكيد الحذف"
      >
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-ds-text text-lg font-medium mb-2">هل أنت متأكد من حذف هذا المعيار؟</p>
          <p className="text-ds-faint text-sm">
            سيتم حذف معيار <span className="font-bold text-ds-muted">{deleteTarget?.title}</span> نهائيًا.
          </p>
          {deleteError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm w-full">
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
              <span>حذف المعيار</span>
            </span>
          </Button>
        </ModalFooter>
      </Modal>
    </Card>
  );
};
