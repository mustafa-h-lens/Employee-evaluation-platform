import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, TextArea } from '../../components/ui/Input';
import { Modal, ModalFooter } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { ModernSelect } from '../../components/ui/ModernSelect';
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
  EyeOff,
  Building2,
  ChevronDown,
  ChevronUp,
  Copy,
} from 'lucide-react';
import { Toggle } from '../../components/ui/Toggle';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface DeptCriterion {
  id: string;
  department_id: string | null;
  directorate_id: string | null;
  title: string;
  description: string;
  weight: number;
  order: number;
  is_active: boolean;
  created_by: string | null;
}

interface DirectorateOption {
  id: string;
  name: string;
}

interface DepartmentOption {
  id: string;
  name: string;
  directorate_id: string;
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

export const DirectorSpecificCriteria: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
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

  // Clone criteria from another department in the same directorate.
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [cloneSourceDeptId, setCloneSourceDeptId] = useState<string>('');
  const [cloneMode, setCloneMode] = useState<'replace' | 'append'>('replace');
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState('');
  const [sourceCriteriaCount, setSourceCriteriaCount] = useState<Record<string, number>>({});

  // Director may manage multiple directorates (and co-manage with a peer).
  const [myDirectorates, setMyDirectorates] = useState<DirectorateOption[]>([]);
  const [selectedDirectorateId, setSelectedDirectorateId] = useState<string>('');
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isMultiDept = departments.length >= 2;
  const activeScope: 'directorate' | 'department' = isMultiDept ? 'department' : 'directorate';

  const fetchSettings = useCallback(async () => {
    // Prefer the active period's weight, since HR sets weights per period.
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

  const fetchDirectorates = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('directorates')
      .select('id, name')
      .or(`director_id.eq.${user.id},secondary_director_id.eq.${user.id}`)
      .order('name');
    const list = (data || []) as DirectorateOption[];
    setMyDirectorates(list);
    if (list.length > 0) setSelectedDirectorateId(prev => prev || list[0].id);
    if (list.length === 0) setLoading(false);
  }, [user]);

  const fetchDepartments = useCallback(async () => {
    if (!selectedDirectorateId) { setDepartments([]); return; }
    const { data } = await supabase
      .from('departments')
      .select('id, name, directorate_id')
      .eq('directorate_id', selectedDirectorateId)
      .eq('status', 'active')
      .order('name');
    const list = (data || []) as DepartmentOption[];
    setDepartments(list);
    // When directorate changes, default to first department (only matters in multi-dept mode)
    if (list.length >= 2) {
      setSelectedDepartmentId(prev => list.some(d => d.id === prev) ? prev : list[0].id);
    } else {
      setSelectedDepartmentId('');
    }
  }, [selectedDirectorateId]);

  const fetchCriteria = useCallback(async () => {
    if (!selectedDirectorateId) { setLoading(false); return; }
    if (activeScope === 'department' && !selectedDepartmentId) { setCriteria([]); setLoading(false); return; }
    try {
      // Multi-department directorates: criteria are scoped per department (each
      // department has its own list, summing to the specific-weight cap).
      // Single-department / no-department directorates: directorate-level list.
      const query = supabase
        .from('department_criteria')
        .select('*')
        .order('order', { ascending: true });

      const { data, error } = activeScope === 'department'
        ? await query.eq('department_id', selectedDepartmentId)
        : await query.is('department_id', null).eq('directorate_id', selectedDirectorateId);

      if (!error && data) setCriteria(data);
    } catch (error) {
      console.error('Error fetching criteria:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDirectorateId, selectedDepartmentId, activeScope]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (user) fetchDirectorates();
  }, [user, fetchDirectorates]);

  useEffect(() => {
    if (selectedDirectorateId) fetchDepartments();
  }, [selectedDirectorateId, fetchDepartments]);

  useEffect(() => {
    if (selectedDirectorateId) fetchCriteria();
  }, [selectedDirectorateId, selectedDepartmentId, activeScope, fetchCriteria]);

  const totalWeight = criteria
    .filter(c => c.is_active)
    .reduce((sum, c) => sum + c.weight, 0);

  const openCloneModal = async () => {
    setCloneSourceDeptId('');
    setCloneMode(criteria.length > 0 ? 'replace' : 'append');
    setCloneError('');
    setIsCloneModalOpen(true);

    // Fetch criteria counts for the other departments so the supervisor can
    // see at a glance which sources are worth cloning from.
    const otherDeptIds = departments.filter(d => d.id !== selectedDepartmentId).map(d => d.id);
    if (otherDeptIds.length === 0) return;
    const { data } = await supabase
      .from('department_criteria')
      .select('department_id')
      .in('department_id', otherDeptIds);
    const counts: Record<string, number> = {};
    (data || []).forEach((row: any) => {
      counts[row.department_id] = (counts[row.department_id] || 0) + 1;
    });
    setSourceCriteriaCount(counts);
  };

  const handleClone = async () => {
    setCloneError('');
    if (!cloneSourceDeptId) { setCloneError('يرجى اختيار القسم المصدر'); return; }
    if (!selectedDepartmentId) { setCloneError('لم يتم تحديد القسم الهدف'); return; }
    if (cloneSourceDeptId === selectedDepartmentId) { setCloneError('لا يمكن النسخ إلى نفس القسم'); return; }

    setCloning(true);
    try {
      const { data: sourceList, error: srcError } = await supabase
        .from('department_criteria')
        .select('title, description, weight, order, is_active')
        .eq('department_id', cloneSourceDeptId)
        .order('order');
      if (srcError) { setCloneError(srcError.message); setCloning(false); return; }
      if (!sourceList || sourceList.length === 0) {
        setCloneError('القسم المصدر لا يحتوي على أي معايير');
        setCloning(false);
        return;
      }

      // Replace mode: wipe existing target criteria first.
      if (cloneMode === 'replace' && criteria.length > 0) {
        const { error: delError } = await supabase
          .from('department_criteria')
          .delete()
          .eq('department_id', selectedDepartmentId);
        if (delError) { setCloneError(delError.message); setCloning(false); return; }
      }

      // Append mode: continue numbering from the existing max order.
      const baseOrder = cloneMode === 'append' && criteria.length > 0
        ? Math.max(...criteria.map(c => c.order))
        : 0;

      const rows = sourceList.map((c: any, idx: number) => ({
        department_id: selectedDepartmentId,
        directorate_id: selectedDirectorateId || null,
        title: c.title,
        description: c.description,
        weight: c.weight,
        order: baseOrder + idx + 1,
        is_active: c.is_active,
        created_by: user?.id || null,
      }));

      const { error: insError } = await supabase.from('department_criteria').insert(rows);
      if (insError) { setCloneError(insError.message); setCloning(false); return; }

      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: cloneMode === 'replace' ? 'استبدال معايير قسم بنسخ من قسم آخر' : 'نسخ معايير من قسم آخر',
          entity_type: 'department_criteria',
          entity_id: selectedDepartmentId,
          details: {
            source_department_id: cloneSourceDeptId,
            target_department_id: selectedDepartmentId,
            directorate_id: selectedDirectorateId,
            mode: cloneMode,
            count: rows.length,
          },
        });
      }

      toast.success(`تم نسخ ${rows.length} معيار إلى القسم الحالي`);
      setIsCloneModalOpen(false);
      fetchCriteria();
    } catch (e) {
      console.error(e);
      setCloneError('حدث خطأ أثناء النسخ');
    } finally {
      setCloning(false);
    }
  };

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

    if (formData.is_active) {
      const othersActive = criteria
        .filter(c => c.is_active && c.id !== editingCriterion?.id)
        .reduce((sum, c) => sum + c.weight, 0);
      const projected = othersActive + weight;
      if (projected > specificWeightLimit) {
        setFormError(`لا يمكن تجاوز الحد المسموح (${specificWeightLimit}%). المجموع بعد الإضافة سيصبح ${projected}% — قلّل الوزن أو عطّل أحد المعايير النشطة.`);
        setSaving(false);
        return;
      }
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
      } else {
        const maxOrder = criteria.length > 0
          ? Math.max(...criteria.map(c => c.order))
          : 0;

        const { error } = await supabase
          .from('department_criteria')
          .insert({
            department_id: activeScope === 'department' ? selectedDepartmentId : null,
            directorate_id: selectedDirectorateId || null,
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
    if (newActive) {
      const othersActive = criteria
        .filter(c => c.is_active && c.id !== criterion.id)
        .reduce((sum, c) => sum + c.weight, 0);
      const projected = othersActive + criterion.weight;
      if (projected > specificWeightLimit) {
        toast.error(`لا يمكن تفعيل هذا المعيار — المجموع سيصبح ${projected}% ويتجاوز الحد المسموح (${specificWeightLimit}%).`);
        return;
      }
    }
    const { error } = await supabase
      .from('department_criteria')
      .update({ is_active: newActive })
      .eq('id', criterion.id);

    if (!error) {
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

  if (myDirectorates.length === 0) {
    return (
      <Card>
        <CardBody className="text-center py-16">
          <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-ds-faint">لم يتم تعيينك كمدير لأي إدارة بعد.</p>
        </CardBody>
      </Card>
    );
  }

  const currentDirectorate = myDirectorates.find(d => d.id === selectedDirectorateId);

  return (
    <div className="space-y-6">
      <div
        className="rounded-ds-xl p-8 flex items-center justify-between flex-wrap gap-3"
        style={{
          background: 'var(--sc-blue-grad)',
          border: '1px solid var(--sc-blue-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-blue-val)' }}>المعايير الخاصة</h1>
          <p className="mt-2" style={{ color: 'var(--sc-blue-label)' }}>
            معايير التقييم الخاصة بتقييم الموظفين
            {' '}(النسبة المخصصة: {specificWeightLimit}% من إجمالي التقييم)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isMultiDept && (
            <Button
              variant="outline"
              onClick={openCloneModal}
              disabled={!selectedDepartmentId || departments.length < 2}
              className="flex items-center gap-2"
            >
              <span>نسخ من قسم آخر</span>
              <Copy className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={openAddModal} disabled={!selectedDirectorateId || (isMultiDept && !selectedDepartmentId)} className="flex items-center gap-2">
            <span>إضافة معيار</span>
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Directorate selector — only when the user manages more than one */}
      {myDirectorates.length > 1 ? (
        <Card>
          <CardBody className="flex items-center gap-3 flex-wrap py-3">
            <Building2 className="h-5 w-5 text-blue-600" />
            <label className="text-sm font-medium text-ds-muted">الإدارة:</label>
            <ModernSelect
              value={selectedDirectorateId}
              onChange={setSelectedDirectorateId}
              ariaLabel="الإدارة"
              className="min-w-[220px]"
              options={myDirectorates.map(d => ({ value: d.id, label: d.name }))}
            />
            <span className="text-xs text-ds-faint">— كل إدارة لها قائمة معاييرها الخاصة، ويتشاركها مدراؤها.</span>
          </CardBody>
        </Card>
      ) : (
        currentDirectorate && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-900 font-medium">{currentDirectorate.name}</span>
          </div>
        )
      )}

      {/* Department selector — only for directorates with 2+ departments */}
      {isMultiDept && (
        <Card>
          <CardBody className="flex items-center gap-3 flex-wrap py-3">
            <ClipboardList className="h-5 w-5 text-emerald-600" />
            <label className="text-sm font-medium text-ds-muted">القسم:</label>
            <ModernSelect
              value={selectedDepartmentId}
              onChange={setSelectedDepartmentId}
              ariaLabel="القسم"
              className="min-w-[220px]"
              options={departments.map(d => ({ value: d.id, label: d.name }))}
            />
            <span className="text-xs text-ds-faint">— هذه الإدارة تحتوي على عدة أقسام، ولكل قسم قائمة معاييره الخاصة.</span>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ds-muted mb-1">معايير نشطة</p>
                <p className="text-xl font-bold text-ds-text">{activeCount}</p>
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
                <p className="text-sm text-ds-muted mb-1">معايير معطلة</p>
                <p className="text-xl font-bold text-ds-text">{inactiveCount}</p>
              </div>
              <div className="bg-ds-overlay text-ds-faint p-3 rounded-xl">
                <EyeOff className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ds-muted mb-1">مجموع الأوزان (النشطة)</p>
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
              message="لا توجد معايير خاصة مضافة حاليًا"
              icon={<ClipboardList className="h-12 w-12 text-ds-faint" />}
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
                {criteria.map((criterion, index) => {
                  const isExpanded = expandedId === criterion.id;
                  const stop = (e: React.MouseEvent) => e.stopPropagation();
                  return (
                  <React.Fragment key={criterion.id}>
                  <TableRow
                    className={`${!criterion.is_active ? 'opacity-60 bg-ds-bg' : ''} ${isExpanded ? 'bg-emerald-50/40' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : criterion.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
                            className="bg-emerald-600 h-2 rounded-full transition-all"
                            style={{ width: `${(criterion.weight / specificWeightLimit) * 100}%` }}
                          />
                        </div>
                        <span className="font-bold text-emerald-600">{criterion.weight}%</span>
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
                    <tr className="bg-emerald-50/40 border-b border-emerald-100">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="bg-ds-surface rounded-lg border border-emerald-100 p-4 space-y-3">
                          <div>
                            <p className="text-xs font-semibold text-emerald-700 mb-1">العنوان</p>
                            <p className="text-sm font-bold text-ds-text">{criterion.title}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-emerald-700 mb-1">الوصف الكامل</p>
                            <p className="text-sm text-ds-muted leading-relaxed whitespace-pre-line">
                              {criterion.description || <span className="text-ds-faint italic">لا يوجد وصف</span>}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-ds-faint pt-2 border-t border-ds-border-subtle">
                            <span><span className="font-semibold">الوزن:</span> {criterion.weight}%</span>
                            <span><span className="font-semibold">الترتيب:</span> {criterion.order}</span>
                            <span><span className="font-semibold">الحالة:</span> {criterion.is_active ? 'نشط' : 'معطل'}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                  );
                })}
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
              placeholder="مثال: القيادة والإدارة"
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
          <p className="text-ds-text text-lg font-medium mb-2">
            هل أنت متأكد من حذف هذا المعيار؟
          </p>
          <p className="text-ds-faint text-sm">
            سيتم حذف معيار{' '}
            <span className="font-bold text-ds-muted">
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

      <Modal
        isOpen={isCloneModalOpen}
        onClose={() => setIsCloneModalOpen(false)}
        title="نسخ المعايير من قسم آخر"
      >
        <div className="space-y-4">
          {cloneError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {cloneError}
            </div>
          )}

          <p className="text-sm text-ds-muted">
            اختر قسماً مصدراً لنسخ معاييره إلى القسم الحالي:{' '}
            <span className="font-semibold text-ds-text">
              {departments.find(d => d.id === selectedDepartmentId)?.name}
            </span>
          </p>

          <div className="space-y-2">
            {departments.filter(d => d.id !== selectedDepartmentId).map(d => {
              const count = sourceCriteriaCount[d.id] || 0;
              const disabled = count === 0;
              return (
                <label
                  key={d.id}
                  className={`flex items-center justify-between gap-3 p-3 border rounded-lg ${
                    disabled
                      ? 'opacity-50 cursor-not-allowed border-ds-border bg-ds-bg'
                      : cloneSourceDeptId === d.id
                      ? 'border-blue-400 bg-blue-50 cursor-pointer'
                      : 'border-ds-border hover:bg-ds-bg cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="cloneSource"
                      checked={cloneSourceDeptId === d.id}
                      onChange={() => setCloneSourceDeptId(d.id)}
                      disabled={disabled}
                    />
                    <div>
                      <p className="text-sm font-medium text-ds-text">{d.name}</p>
                      <p className="text-xs text-ds-faint">
                        {count > 0 ? `${count} معيار متاح` : 'لا توجد معايير في هذا القسم'}
                      </p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {criteria.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-semibold text-amber-900">
                القسم الحالي يحتوي على {criteria.length} معيار. كيف تريد التعامل معها؟
              </p>
              <label className="flex items-center gap-2 text-sm text-amber-900 cursor-pointer">
                <input
                  type="radio"
                  name="cloneMode"
                  value="replace"
                  checked={cloneMode === 'replace'}
                  onChange={() => setCloneMode('replace')}
                />
                <span><span className="font-semibold">استبدال</span> — حذف جميع المعايير الحالية ثم نسخ معايير القسم المصدر</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-amber-900 cursor-pointer">
                <input
                  type="radio"
                  name="cloneMode"
                  value="append"
                  checked={cloneMode === 'append'}
                  onChange={() => setCloneMode('append')}
                />
                <span><span className="font-semibold">إضافة</span> — الإبقاء على المعايير الحالية وإضافة معايير القسم المصدر إليها (قد يتجاوز الحد المسموح)</span>
              </label>
            </div>
          )}
        </div>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => setIsCloneModalOpen(false)}>
            إلغاء
          </Button>
          <Button type="button" onClick={handleClone} loading={cloning} disabled={!cloneSourceDeptId}>
            <span className="flex items-center gap-1">
              <Copy className="h-4 w-4" />
              <span>نسخ المعايير</span>
            </span>
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};
