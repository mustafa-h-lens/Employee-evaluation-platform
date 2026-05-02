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
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  CalendarOff,
} from 'lucide-react';
import { Toggle } from '../../components/ui/Toggle';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface LeaveType {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  order: number;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  description: string;
  is_active: boolean;
}

const defaultFormData: FormData = {
  name: '',
  description: '',
  is_active: true,
};

interface LeaveTypesProps {
  hideHero?: boolean;
}

export const LeaveTypes: React.FC<LeaveTypesProps> = ({ hideHero = false }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const [form, setForm] = useState<FormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<LeaveType | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('employee_leave_types')
      .select('*')
      .order('order', { ascending: true });
    setTypes((data as unknown as LeaveType[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const openAdd = () => {
    setEditing(null);
    setForm(defaultFormData);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (t: LeaveType) => {
    setEditing(t);
    setForm({ name: t.name, description: t.description, is_active: t.is_active });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) { setFormError('يرجى إدخال اسم نوع الإجازة'); return; }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from('employee_leave_types')
          .update({
            name: form.name.trim(),
            description: form.description.trim(),
            is_active: form.is_active,
          })
          .eq('id', editing.id);
        if (error) { setFormError(error.message); setSaving(false); return; }
        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'تحديث نوع إجازة',
            entity_type: 'employee_leave_types',
            entity_id: editing.id,
            details: { name: form.name.trim() },
          });
        }
        toast.success('تم تحديث نوع الإجازة');
      } else {
        const maxOrder = types.length > 0 ? Math.max(...types.map(t => t.order)) : 0;
        const { data, error } = await supabase
          .from('employee_leave_types')
          .insert({
            name: form.name.trim(),
            description: form.description.trim(),
            is_active: form.is_active,
            order: maxOrder + 1,
          })
          .select().single();
        if (error) {
          setFormError(error.message.includes('duplicate') ? 'هذا الاسم موجود مسبقاً' : error.message);
          setSaving(false);
          return;
        }
        if (user && data) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'إضافة نوع إجازة',
            entity_type: 'employee_leave_types',
            entity_id: data.id,
            details: { name: form.name.trim() },
          });
        }
        toast.success('تم إضافة نوع الإجازة');
      }
      setIsModalOpen(false);
      setEditing(null);
      fetchTypes();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (t: LeaveType) => {
    const newActive = !t.is_active;
    const { error } = await supabase
      .from('employee_leave_types')
      .update({ is_active: newActive })
      .eq('id', t.id);
    if (!error) {
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: newActive ? 'تفعيل نوع إجازة' : 'تعطيل نوع إجازة',
          entity_type: 'employee_leave_types',
          entity_id: t.id,
          details: { name: t.name, is_active: newActive },
        });
      }
      fetchTypes();
    }
  };

  const handleReorder = async (t: LeaveType, direction: 'up' | 'down') => {
    const idx = types.findIndex(x => x.id === t.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= types.length) return;
    const swap = types[swapIdx];
    await Promise.all([
      supabase.from('employee_leave_types').update({ order: swap.order }).eq('id', t.id),
      supabase.from('employee_leave_types').update({ order: t.order }).eq('id', swap.id),
    ]);
    fetchTypes();
  };

  const confirmDelete = (t: LeaveType) => {
    setDeleteTarget(t);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // If any leave references this type, refuse the hard delete and disable instead.
      const { count } = await supabase
        .from('employee_leaves')
        .select('id', { count: 'exact', head: true })
        .eq('leave_type_id', deleteTarget.id);
      if ((count || 0) > 0) {
        const { error: upErr } = await supabase
          .from('employee_leave_types')
          .update({ is_active: false })
          .eq('id', deleteTarget.id);
        if (upErr) { toast.error(upErr.message); return; }
        toast.success(`تم تعطيل النوع — مستخدم في ${count} إجازة سابقة`);
      } else {
        const { error } = await supabase.from('employee_leave_types').delete().eq('id', deleteTarget.id);
        if (error) { toast.error(error.message); return; }
        toast.success('تم حذف نوع الإجازة');
      }
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'حذف/تعطيل نوع إجازة',
          entity_type: 'employee_leave_types',
          entity_id: deleteTarget.id,
          details: { name: deleteTarget.name, used_count: count || 0 },
        });
      }
      setIsDeleteOpen(false);
      setDeleteTarget(null);
      fetchTypes();
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="page-loading-placeholder" aria-hidden="true" />;

  return (
    <div className="space-y-6">
      {!hideHero ? (
        <div
          className="rounded-ds-xl p-8 flex items-center justify-between flex-wrap gap-3"
          style={{
            background: 'var(--sc-amber-grad)',
            border: '1px solid var(--sc-amber-border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-amber-val)' }}>أنواع الإجازات</h1>
            <p className="mt-2" style={{ color: 'var(--sc-amber-label)' }}>
              قائمة أنواع الإجازات المعتمدة في النظام — تُستخدم عند إضافة إجازة لموظف
            </p>
          </div>
          <Button onClick={openAdd} className="flex items-center gap-2">
            <span>إضافة نوع</span>
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button onClick={openAdd} className="flex items-center gap-2">
            <span>إضافة نوع</span>
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      )}

      <Card>
        <CardBody className="p-0">
          {types.length === 0 ? (
            <EmptyState
              message="لا توجد أنواع إجازات بعد"
              icon={<CalendarOff className="h-12 w-12 text-ds-faint" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الترتيب</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((t, index) => {
                  const stop = (e: React.MouseEvent) => e.stopPropagation();
                  return (
                    <TableRow key={t.id} className={!t.is_active ? 'opacity-60 bg-ds-bg' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-ds-warning-bg text-ds-warning rounded-lg flex items-center justify-center flex-shrink-0">
                            <CalendarOff className="h-4 w-4" />
                          </div>
                          <span className="font-bold text-ds-text">{t.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-ds-faint text-sm max-w-xs truncate">{t.description || '—'}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.is_active ? 'success' : 'default'}>
                          {t.is_active ? 'نشط' : 'معطل'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={stop}>
                          <button onClick={() => handleReorder(t, 'up')} disabled={index === 0}
                            className="p-1 rounded hover:bg-ds-overlay disabled:opacity-30 disabled:cursor-not-allowed text-ds-faint">
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <span className="text-ds-faint text-sm font-mono w-6 text-center">{t.order}</span>
                          <button onClick={() => handleReorder(t, 'down')} disabled={index === types.length - 1}
                            className="p-1 rounded hover:bg-ds-overlay disabled:opacity-30 disabled:cursor-not-allowed text-ds-faint">
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2" onClick={stop}>
                          <Button size="sm" variant="outline" onClick={() => openEdit(t)} className="flex items-center gap-1">
                            <Edit className="h-4 w-4" /><span>تعديل</span>
                          </Button>
                          <Toggle checked={t.is_active} onChange={() => handleToggle(t)} size="sm" />
                          <Button size="sm" variant="danger" onClick={() => confirmDelete(t)} className="flex items-center gap-1">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل نوع إجازة' : 'إضافة نوع إجازة'}>
        <form onSubmit={handleSave}>
          <div className="space-y-4">
            {formError && (
              <div className="bg-ds-danger-bg border border-ds-danger-border rounded-lg p-3 text-ds-danger-text text-sm">{formError}</div>
            )}
            <Input label="الاسم" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="مثال: إجازة سنوية" required />
            <TextArea label="الوصف" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="وصف مختصر لمتى يُستخدم هذا النوع" rows={3} />
            {editing && (
              <div className="flex items-center justify-between p-3 bg-ds-bg rounded-lg">
                <Toggle checked={form.is_active} onChange={() => setForm({ ...form, is_active: !form.is_active })} />
                <span className="text-sm font-medium text-ds-muted">{form.is_active ? 'نشط — يظهر في قائمة الاختيار' : 'معطل — مخفي من قائمة الاختيار'}</span>
              </div>
            )}
          </div>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>إلغاء</Button>
            <Button type="submit" loading={saving}>{editing ? 'تحديث' : 'إضافة'}</Button>
          </ModalFooter>
        </form>
      </Modal>

      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="حذف نوع الإجازة">
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 bg-ds-danger-bg rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-ds-text text-lg font-medium mb-2">حذف نوع الإجازة؟</p>
          <p className="text-ds-faint text-sm">
            <span className="font-bold text-ds-muted">{deleteTarget?.name}</span> — إذا كان مستخدماً في إجازات سابقة سيتم تعطيله بدلاً من حذفه للحفاظ على السجلات.
          </p>
        </div>
        <ModalFooter className="justify-center">
          <Button type="button" variant="secondary" onClick={() => setIsDeleteOpen(false)}>إلغاء</Button>
          <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
            <span className="flex items-center gap-1"><Trash2 className="h-4 w-4" /><span>متابعة</span></span>
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};
