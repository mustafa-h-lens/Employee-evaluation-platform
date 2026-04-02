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
  EyeOff
} from 'lucide-react';
import { Toggle } from '../../components/ui/Toggle';
import { useAuth } from '../../contexts/AuthContext';

interface DeptCriterion {
  id: string;
  department_id: string;
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

export const DepartmentCriteria: React.FC = () => {
  const { user } = useAuth();
  const [criteria, setCriteria] = useState<DeptCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<DeptCriterion | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [specificWeightLimit, setSpecificWeightLimit] = useState(50);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [departmentName, setDepartmentName] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<DeptCriterion | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchDepartment = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .eq('manager_id', user.id)
      .single();

    if (data) {
      setDepartmentId(data.id);
      setDepartmentName(data.name);
    }
  }, [user]);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from('evaluation_settings')
      .select('*')
      .limit(1)
      .single();
    if (data) {
      setSpecificWeightLimit(data.specific_weight);
    }
  }, []);

  const fetchCriteria = useCallback(async () => {
    if (!departmentId) return;
    try {
      const { data, error } = await supabase
        .from('department_criteria')
        .select('*')
        .eq('department_id', departmentId)
        .order('order', { ascending: true });

      if (!error && data) {
        setCriteria(data);
      }
    } catch (error) {
      console.error('Error fetching criteria:', error);
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    fetchDepartment();
    fetchSettings();
  }, [fetchDepartment, fetchSettings]);

  useEffect(() => {
    if (departmentId) {
      fetchCriteria();
    }
  }, [departmentId, fetchCriteria]);

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

    const weight = parseInt(formData.weight);

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

    if (!departmentId) {
      setFormError('لم يتم العثور على القسم');
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
            action: 'تحديث معيار خاص بالقسم',
            entity_type: 'department_criteria',
            entity_id: editingCriterion.id,
            details: { title: formData.title, weight, department_id: departmentId },
          });
        }
      } else {
        const maxOrder = criteria.length > 0
          ? Math.max(...criteria.map(c => c.order))
          : 0;

        const { data, error } = await supabase
          .from('department_criteria')
          .insert({
            department_id: departmentId,
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
            action: 'إضافة معيار خاص بالقسم',
            entity_type: 'department_criteria',
            entity_id: data.id,
            details: { title: formData.title, weight, department_id: departmentId },
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
          action: 'حذف معيار خاص بالقسم',
          entity_type: 'department_criteria',
          entity_id: deleteTarget.id,
          details: { title: deleteTarget.title, department_id: departmentId },
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

  if (loading) {
    return <div className="flex items-center justify-center h-64">جاري التحميل...</div>;
  }

  const activeCount = criteria.filter(c => c.is_active).length;
  const inactiveCount = criteria.filter(c => !c.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">المعايير الخاصة بالقسم</h1>
          <p className="text-gray-600 mt-2">
            معايير التقييم الخاصة بقسم <span className="font-semibold text-emerald-700">{departmentName}</span>
            {' '}(النسبة المخصصة: {specificWeightLimit}% من إجمالي التقييم)
          </p>
        </div>
        <Button onClick={openAddModal} className="flex items-center gap-2">
          <span>إضافة معيار</span>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">معايير نشطة</p>
                <p className="text-xl font-bold text-gray-900">{activeCount}</p>
              </div>
              <div className="bg-green-50 text-green-600 p-3 rounded-xl">
                <ClipboardList className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">معايير معطلة</p>
                <p className="text-xl font-bold text-gray-900">{inactiveCount}</p>
              </div>
              <div className="bg-gray-100 text-gray-500 p-3 rounded-xl">
                <EyeOff className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">مجموع الأوزان (النشطة)</p>
                <p className={`text-xl font-bold ${totalWeight === specificWeightLimit ? 'text-green-600' : 'text-red-600'}`}>
                  {totalWeight}% / {specificWeightLimit}%
                </p>
              </div>
              <div className={`p-3 rounded-xl ${totalWeight === specificWeightLimit ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                <Scale className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {totalWeight !== specificWeightLimit && criteria.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-amber-800 text-sm">
            مجموع أوزان المعايير الخاصة النشطة يجب أن يساوي {specificWeightLimit}% (النسبة المخصصة من الإعدادات). المجموع الحالي: <span className="font-bold">{totalWeight}%</span>
          </p>
        </div>
      )}

      <Card>
        <CardBody className="p-0">
          {criteria.length === 0 ? (
            <EmptyState
              message="لا توجد معايير خاصة مضافة لهذا القسم حاليًا"
              icon={<ClipboardList className="h-12 w-12 text-gray-400" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المعيار</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الترتيب</TableHead>
                  <TableHead>الوزن</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {criteria.map((criterion, index) => (
                  <TableRow key={criterion.id} className={!criterion.is_active ? 'opacity-60 bg-gray-50' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-gray-900">{criterion.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-gray-500 text-sm max-w-xs truncate">{criterion.description}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={criterion.is_active ? 'success' : 'default'}>
                        {criterion.is_active ? 'نشط' : 'معطل'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleReorder(criterion, 'up')}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <span className="text-gray-400 text-sm font-mono w-6 text-center">{criterion.order}</span>
                        <button
                          onClick={() => handleReorder(criterion, 'down')}
                          disabled={index === criteria.length - 1}
                          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-emerald-600 h-2 rounded-full transition-all"
                            style={{ width: `${(criterion.weight / specificWeightLimit) * 100}%` }}
                          />
                        </div>
                        <span className="font-bold text-emerald-600">{criterion.weight}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

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
              placeholder="مثال: العمل الجماعي"
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
              required
              helperText={`مجموع أوزان المعايير الخاصة النشطة الحالي: ${totalWeight}% من ${specificWeightLimit}%`}
            />

            {editingCriterion && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <Toggle
                  checked={formData.is_active}
                  onChange={() => setFormData({ ...formData, is_active: !formData.is_active })}
                />
                <span className="text-sm font-medium text-gray-700">
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
          <p className="text-gray-900 text-lg font-medium mb-2">
            هل أنت متأكد من حذف هذا المعيار؟
          </p>
          <p className="text-gray-500 text-sm">
            سيتم حذف معيار{' '}
            <span className="font-bold text-gray-700">
              {deleteTarget?.title}
            </span>{' '}
            نهائيًا.
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
    </div>
  );
};
