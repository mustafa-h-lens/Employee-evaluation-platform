import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, TextArea } from '../../components/ui/Input';
import { Modal, ModalFooter } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { ModernSelect } from '../../components/ui/ModernSelect';
import { UserAvatar } from '../../components/ui/UserAvatar';
import {
  Plus,
  CreditCard as Edit,
  Trash2,
  AlertTriangle,
  Search,
  CalendarOff,
  CalendarClock,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface LeaveType {
  id: string;
  name: string;
  is_active: boolean;
}

interface EmployeeLite {
  id: string;
  full_name: string;
  job_title: string | null;
  avatar_url: string | null;
  department_name: string | null;
}

interface LeaveRow {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_month: string;
  end_month: string;
  notes: string;
  created_at: string;
  employee: EmployeeLite | null;
  leave_type: { name: string } | null;
}

interface FormData {
  employee_id: string;
  leave_type_id: string;
  start_month: string; // 'YYYY-MM'
  end_month: string;   // 'YYYY-MM'
  notes: string;
  ack_existing_scores: boolean;
}

const defaultFormData: FormData = {
  employee_id: '',
  leave_type_id: '',
  start_month: '',
  end_month: '',
  notes: '',
  ack_existing_scores: false,
};

const monthIso = (yyyymm: string): string => `${yyyymm}-01`;

const formatMonthArabic = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });
};

const monthsBetween = (fromIso: string, toIso: string): number => {
  if (!fromIso || !toIso) return 0;
  const a = new Date(fromIso);
  const b = new Date(toIso);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
};

const leaveStatus = (startIso: string, endIso: string): 'past' | 'current' | 'upcoming' => {
  const today = new Date();
  const todayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (todayMonth < start) return 'upcoming';
  if (todayMonth > end) return 'past';
  return 'current';
};

export const EmployeeLeaves: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveRow | null>(null);
  const [form, setForm] = useState<FormData>(defaultFormData);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [overlapScoreCount, setOverlapScoreCount] = useState<number | null>(null);
  const [overlapChecking, setOverlapChecking] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<LeaveRow | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [leavesRes, empsRes, typesRes] = await Promise.all([
      supabase
        .from('employee_leaves')
        .select(`
          id, employee_id, leave_type_id, start_month, end_month, notes, created_at,
          employee:employees(id, full_name, job_title, user:users(avatar_url), department:departments(name)),
          leave_type:employee_leave_types(name)
        `)
        .order('start_month', { ascending: false }),
      supabase
        .from('employees')
        .select('id, full_name, job_title, user:users(avatar_url), department:departments(name)')
        .order('full_name'),
      supabase
        .from('employee_leave_types')
        .select('id, name, is_active')
        .order('order'),
    ]);

    setLeaves(((leavesRes.data || []) as any[]).map(r => ({
      id: r.id,
      employee_id: r.employee_id,
      leave_type_id: r.leave_type_id,
      start_month: r.start_month,
      end_month: r.end_month,
      notes: r.notes || '',
      created_at: r.created_at,
      employee: r.employee ? {
        id: r.employee.id,
        full_name: r.employee.full_name,
        job_title: r.employee.job_title,
        avatar_url: r.employee.user?.avatar_url || null,
        department_name: r.employee.department?.name || null,
      } : null,
      leave_type: r.leave_type,
    })));

    setEmployees(((empsRes.data || []) as any[]).map(e => ({
      id: e.id,
      full_name: e.full_name,
      job_title: e.job_title,
      avatar_url: e.user?.avatar_url || null,
      department_name: e.department?.name || null,
    })));

    setLeaveTypes((typesRes.data as unknown as LeaveType[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredLeaves = useMemo(() => {
    return leaves.filter(l => {
      if (filterEmployee !== 'all' && l.employee_id !== filterEmployee) return false;
      if (filterType !== 'all' && l.leave_type_id !== filterType) return false;
      if (filterStatus !== 'all') {
        const s = leaveStatus(l.start_month, l.end_month);
        if (s !== filterStatus) return false;
      }
      return true;
    });
  }, [leaves, filterEmployee, filterType, filterStatus]);

  const employeesById = useMemo(() => {
    const m = new Map<string, EmployeeLite>();
    employees.forEach(e => m.set(e.id, e));
    return m;
  }, [employees]);

  const filteredEmployeesForPicker = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employees.slice(0, 50);
    return employees.filter(e =>
      e.full_name.toLowerCase().includes(q)
      || (e.department_name || '').toLowerCase().includes(q)
      || (e.job_title || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [employees, employeeSearch]);

  const openAdd = () => {
    setEditing(null);
    setForm(defaultFormData);
    setEmployeeSearch('');
    setFormError('');
    setOverlapScoreCount(null);
    setIsModalOpen(true);
  };

  const openEdit = (leave: LeaveRow) => {
    setEditing(leave);
    setForm({
      employee_id: leave.employee_id,
      leave_type_id: leave.leave_type_id,
      start_month: leave.start_month.slice(0, 7),
      end_month: leave.end_month.slice(0, 7),
      notes: leave.notes,
      ack_existing_scores: true, // editing an existing record — already acknowledged once
    });
    setEmployeeSearch('');
    setFormError('');
    setOverlapScoreCount(null);
    setIsModalOpen(true);
  };

  // When employee + range are set, count existing scores in that range so we can warn HR.
  useEffect(() => {
    const run = async () => {
      if (!form.employee_id || !form.start_month || !form.end_month) {
        setOverlapScoreCount(null);
        return;
      }
      setOverlapChecking(true);
      try {
        const fromIso = monthIso(form.start_month);
        const toIso = monthIso(form.end_month);
        const { data: emp } = await supabase.from('employees').select('user_id').eq('id', form.employee_id).maybeSingle();
        const userId = emp?.user_id || null;
        const { data: periods } = await supabase
          .from('evaluation_periods')
          .select('id')
          .gte('start_date', fromIso)
          .lte('start_date', toIso);
        const periodIds = (periods || []).map((p: any) => p.id);
        if (periodIds.length === 0) { setOverlapScoreCount(0); return; }
        const counts = await Promise.all([
          supabase.from('evaluations').select('id', { count: 'exact', head: true })
            .eq('employee_id', form.employee_id).in('period_id', periodIds),
          supabase.from('supervisor_evaluations').select('id', { count: 'exact', head: true })
            .eq('employee_id', form.employee_id).in('period_id', periodIds),
          userId
            ? supabase.from('director_evaluations').select('id', { count: 'exact', head: true })
                .eq('director_id', userId).in('period_id', periodIds)
            : Promise.resolve({ count: 0 }),
        ]);
        const total = (counts[0].count || 0) + (counts[1].count || 0) + (counts[2].count || 0);
        setOverlapScoreCount(total);
      } finally {
        setOverlapChecking(false);
      }
    };
    run();
  }, [form.employee_id, form.start_month, form.end_month]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.employee_id) { setFormError('يرجى اختيار الموظف'); return; }
    if (!form.leave_type_id) { setFormError('يرجى اختيار نوع الإجازة'); return; }
    if (!form.start_month || !form.end_month) { setFormError('يرجى تحديد الشهرين'); return; }
    if (form.end_month < form.start_month) { setFormError('شهر النهاية يجب أن يكون مساوياً أو بعد شهر البداية'); return; }
    if ((overlapScoreCount || 0) > 0 && !form.ack_existing_scores) {
      setFormError('يرجى تأكيد علمك بوجود تقييمات سابقة في هذه الفترة');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        employee_id: form.employee_id,
        leave_type_id: form.leave_type_id,
        start_month: monthIso(form.start_month),
        end_month: monthIso(form.end_month),
        notes: form.notes.trim(),
      };

      if (editing) {
        const { error } = await supabase.from('employee_leaves').update(payload).eq('id', editing.id);
        if (error) {
          setFormError(error.message.includes('employee_leaves_no_overlap')
            ? 'هذا الموظف لديه إجازة أخرى تتقاطع مع هذه الفترة' : error.message);
          setSaving(false); return;
        }
        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'تحديث إجازة موظف',
            entity_type: 'employee_leaves',
            entity_id: editing.id,
            details: payload,
          });
        }
        toast.success('تم تحديث الإجازة');
      } else {
        const { data, error } = await supabase
          .from('employee_leaves')
          .insert({ ...payload, created_by: user?.id || null })
          .select().single();
        if (error) {
          setFormError(error.message.includes('employee_leaves_no_overlap')
            ? 'هذا الموظف لديه إجازة أخرى تتقاطع مع هذه الفترة' : error.message);
          setSaving(false); return;
        }
        if (user && data) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'إنشاء إجازة موظف',
            entity_type: 'employee_leaves',
            entity_id: data.id,
            details: { ...payload, existing_scores_count: overlapScoreCount || 0 },
          });
        }
        toast.success(`تم إضافة الإجازة (${monthsBetween(payload.start_month, payload.end_month)} شهر)`);
      }
      setIsModalOpen(false);
      setEditing(null);
      fetchAll();
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (l: LeaveRow) => {
    setDeleteTarget(l);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('employee_leaves').delete().eq('id', deleteTarget.id);
      if (error) { toast.error(error.message); return; }
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'حذف إجازة موظف',
          entity_type: 'employee_leaves',
          entity_id: deleteTarget.id,
          details: {
            employee_id: deleteTarget.employee_id,
            leave_type_id: deleteTarget.leave_type_id,
            start_month: deleteTarget.start_month,
            end_month: deleteTarget.end_month,
          },
        });
      }
      toast.success('تم حذف الإجازة');
      setIsDeleteOpen(false);
      setDeleteTarget(null);
      fetchAll();
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div
        className="rounded-ds-xl p-8 flex items-center justify-between flex-wrap gap-3"
        style={{
          background: 'var(--sc-amber-grad)',
          border: '1px solid var(--sc-amber-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-amber-val)' }}>إجازات الموظفين</h1>
          <p className="mt-2" style={{ color: 'var(--sc-amber-label)' }}>
            تسجيل فترات إجازة الموظفين — لن يتم تقييم الموظف خلال أشهر إجازته، ويتم استبعاد هذه الأشهر من حساب المتوسطات في التقارير
          </p>
        </div>
        <Button onClick={openAdd} className="flex items-center gap-2">
          <span>إضافة إجازة</span>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-ds-faint" />
          <span className="text-sm font-medium text-ds-muted">تصفية:</span>
        </div>
        <ModernSelect
          value={filterStatus}
          onChange={setFilterStatus}
          ariaLabel="الحالة"
          className="min-w-[160px]"
          options={[
            { value: 'all', label: 'كل الحالات' },
            { value: 'current', label: 'حالية' },
            { value: 'upcoming', label: 'قادمة' },
            { value: 'past', label: 'منتهية' },
          ]}
        />
        <ModernSelect
          value={filterType}
          onChange={setFilterType}
          ariaLabel="نوع الإجازة"
          className="min-w-[200px]"
          options={[
            { value: 'all', label: 'كل الأنواع' },
            ...leaveTypes.filter(t => t.is_active).map(t => ({ value: t.id, label: t.name })),
          ]}
        />
        <ModernSelect
          value={filterEmployee}
          onChange={setFilterEmployee}
          ariaLabel="الموظف"
          className="min-w-[240px]"
          options={[
            { value: 'all', label: 'كل الموظفين' },
            ...employees.map(e => ({ value: e.id, label: e.full_name })),
          ]}
        />
      </div>

      <Card>
        <CardBody className="p-0">
          {filteredLeaves.length === 0 ? (
            <EmptyState
              message={leaves.length === 0 ? 'لا توجد إجازات مسجلة بعد' : 'لا توجد إجازات تطابق التصفية الحالية'}
              icon={<CalendarOff className="h-12 w-12 text-ds-faint" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الموظف</TableHead>
                  <TableHead>نوع الإجازة</TableHead>
                  <TableHead>من</TableHead>
                  <TableHead>إلى</TableHead>
                  <TableHead>المدة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeaves.map(l => {
                  const status = leaveStatus(l.start_month, l.end_month);
                  const months = monthsBetween(l.start_month, l.end_month);
                  return (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar name={l.employee?.full_name || '—'} avatarUrl={l.employee?.avatar_url || null} size="md" />
                          <div className="min-w-0">
                            <p className="font-bold text-ds-text truncate">{l.employee?.full_name || '—'}</p>
                            <p className="text-xs text-ds-faint truncate">
                              {[l.employee?.job_title, l.employee?.department_name].filter(Boolean).join(' — ')}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="info" size="sm">{l.leave_type?.name || '—'}</Badge>
                      </TableCell>
                      <TableCell><span className="text-sm text-ds-text">{formatMonthArabic(l.start_month)}</span></TableCell>
                      <TableCell><span className="text-sm text-ds-text">{formatMonthArabic(l.end_month)}</span></TableCell>
                      <TableCell><span className="font-bold text-amber-600">{months} شهر</span></TableCell>
                      <TableCell>
                        <Badge
                          variant={status === 'current' ? 'warning' : status === 'upcoming' ? 'info' : 'default'}
                          size="sm"
                        >
                          {status === 'current' ? 'حالية' : status === 'upcoming' ? 'قادمة' : 'منتهية'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(l)} className="flex items-center gap-1">
                            <Edit className="h-4 w-4" /><span>تعديل</span>
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => confirmDelete(l)} className="flex items-center gap-1">
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل إجازة' : 'إضافة إجازة جديدة'}>
        <form onSubmit={handleSave}>
          <div className="space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{formError}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-ds-muted mb-2">الموظف</label>
              {form.employee_id ? (
                <div className="flex items-center justify-between border border-ds-border rounded-lg p-3 bg-ds-bg">
                  {(() => {
                    const e = employeesById.get(form.employee_id);
                    return e ? (
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar name={e.full_name} avatarUrl={e.avatar_url} size="md" />
                        <div className="min-w-0">
                          <p className="font-bold text-ds-text truncate">{e.full_name}</p>
                          <p className="text-xs text-ds-faint truncate">
                            {[e.job_title, e.department_name].filter(Boolean).join(' — ')}
                          </p>
                        </div>
                      </div>
                    ) : <span className="text-sm text-ds-faint">—</span>;
                  })()}
                  {!editing && (
                    <button type="button" onClick={() => setForm({ ...form, employee_id: '' })}
                      className="text-xs text-ds-faint hover:text-ds-muted">تغيير</button>
                  )}
                </div>
              ) : (
                <>
                  <div className="relative mb-2">
                    <Search className="absolute right-3 top-3 h-4 w-4 text-ds-faint pointer-events-none" />
                    <input
                      type="text"
                      value={employeeSearch}
                      onChange={e => setEmployeeSearch(e.target.value)}
                      placeholder="ابحث بالاسم أو القسم"
                      className="input pr-9"
                    />
                  </div>
                  <div className="border border-ds-border rounded-lg max-h-56 overflow-y-auto">
                    {filteredEmployeesForPicker.length === 0 ? (
                      <p className="p-4 text-sm text-ds-faint text-center">لا توجد نتائج</p>
                    ) : (
                      filteredEmployeesForPicker.map(e => (
                        <button
                          type="button"
                          key={e.id}
                          onClick={() => setForm({ ...form, employee_id: e.id })}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-ds-bg cursor-pointer border-b border-ds-border-subtle last:border-b-0 text-right"
                        >
                          <UserAvatar name={e.full_name} avatarUrl={e.avatar_url} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ds-text truncate">{e.full_name}</p>
                            <p className="text-xs text-ds-faint truncate">
                              {[e.job_title, e.department_name].filter(Boolean).join(' — ')}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-ds-muted mb-2">نوع الإجازة</label>
              <ModernSelect
                value={form.leave_type_id}
                onChange={v => setForm({ ...form, leave_type_id: v })}
                ariaLabel="نوع الإجازة"
                placeholder="اختر النوع"
                options={leaveTypes.filter(t => t.is_active || t.id === form.leave_type_id).map(t => ({ value: t.id, label: t.name }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-ds-muted mb-2">من شهر</label>
                <input
                  type="month"
                  value={form.start_month}
                  onChange={e => setForm({ ...form, start_month: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ds-muted mb-2">إلى شهر</label>
                <input
                  type="month"
                  value={form.end_month}
                  onChange={e => setForm({ ...form, end_month: e.target.value })}
                  className="input"
                  required
                />
              </div>
            </div>

            {form.start_month && form.end_month && form.end_month >= form.start_month && (
              <p className="text-xs text-ds-faint">
                المدة: <span className="font-bold text-amber-600">{monthsBetween(monthIso(form.start_month), monthIso(form.end_month))} شهر</span>
              </p>
            )}

            <TextArea
              label="ملاحظات (اختيارية)"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="مثال: إجازة أمومة موافق عليها بقرار رقم …"
              rows={2}
            />

            {overlapChecking && (
              <p className="text-xs text-ds-faint">جاري التحقق من التقييمات السابقة…</p>
            )}
            {!overlapChecking && (overlapScoreCount || 0) > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900 mb-1">
                    يوجد {overlapScoreCount} تقييم/تقييمات للموظف في هذه الفترة
                  </p>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    لن يتم حذف هذه التقييمات، لكنها ستُستبعد من حساب المتوسط بعد إضافة الإجازة (يصبح المتوسط محسوباً على الأشهر المتاحة فقط).
                    يمكن حذف الإجازة لاحقاً لاستعادة احتساب هذه الأشهر.
                  </p>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.ack_existing_scores}
                      onChange={e => setForm({ ...form, ack_existing_scores: e.target.checked })}
                      className="rounded border-amber-300"
                    />
                    <span className="text-xs font-medium text-amber-900">أؤكد علمي بذلك</span>
                  </label>
                </div>
              </div>
            )}
          </div>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>إلغاء</Button>
            <Button type="submit" loading={saving}>{editing ? 'تحديث' : 'إضافة'}</Button>
          </ModalFooter>
        </form>
      </Modal>

      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="حذف الإجازة">
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <CalendarClock className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-ds-text text-lg font-medium mb-2">حذف الإجازة؟</p>
          <p className="text-ds-faint text-sm">
            بحذف هذه الإجازة سيُعاد احتساب الأشهر المعنية في تقارير الموظف. التقييمات الموجودة للموظف خلال تلك الأشهر (إن وُجدت) ستعود لتُحسب ضمن المتوسط.
          </p>
        </div>
        <ModalFooter className="justify-center">
          <Button type="button" variant="secondary" onClick={() => setIsDeleteOpen(false)}>إلغاء</Button>
          <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
            <span className="flex items-center gap-1"><Trash2 className="h-4 w-4" /><span>حذف الإجازة</span></span>
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};
