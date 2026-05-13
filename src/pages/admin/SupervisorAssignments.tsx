import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal, ModalFooter } from '../../components/ui/Modal';
import { TextArea } from '../../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import {
  Users, UserPlus, Shield, ShieldCheck, ShieldOff, ShieldX,
  CreditCard as Edit, AlertTriangle, Search,
  Trash2, CheckSquare, Square, Filter
} from 'lucide-react';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { ModernSelect } from '../../components/ui/ModernSelect';

// ─── Types ─────────────────────────────────────────────

interface AssignmentMember {
  id: string;
  employee_id: string;
  employee?: { full_name: string; email: string; job_title: string; department?: { name: string } };
}

interface Assignment {
  id: string;
  user_id: string;
  user_type: 'employee' | 'director';
  title?: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'inactive' | 'ended';
  notes?: string;
  created_by: string;
  created_at: string;
  user?: { full_name: string; email: string; role: string };
  creator?: { full_name: string };
  members?: AssignmentMember[];
}

interface UserOption {
  id: string;
  full_name: string;
  role: string;
  email: string;
}

interface EmployeeOption {
  id: string;
  full_name: string;
  email: string;
  job_title: string;
  employee_number: string;
  department_id: string | null;
  department?: { name: string };
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface AssignmentForm {
  user_type: 'employee' | 'director';
  user_id: string;
  notes: string;
  selected_employee_ids: Set<string>;
}

const emptyForm: AssignmentForm = {
  user_type: 'employee',
  user_id: '',
  notes: '',
  selected_employee_ids: new Set(),
};

// ─── Component ─────────────────────────────────────────

export const SupervisorAssignments: React.FC = () => {
  const { user } = useAuth();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [supervisorUsers, setSupervisorUsers] = useState<UserOption[]>([]);
  const [allEmployees, setAllEmployees] = useState<EmployeeOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [form, setForm] = useState<AssignmentForm>(emptyForm);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Employee picker filters inside modal
  const [empSearch, setEmpSearch] = useState('');
  const [empDeptFilter, setEmpDeptFilter] = useState('');

  const [confirmEndTarget, setConfirmEndTarget] = useState<Assignment | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ─── Data fetching ─────────────────────────────────

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [assignmentsRes, usersRes, employeesRes, deptsRes] = await Promise.all([
        supabase
          .from('supervisor_assignments')
          .select('*, user:users!supervisor_assignments_user_id_fkey(full_name, email, role), creator:users!supervisor_assignments_created_by_fkey(full_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('users')
          .select('id, full_name, role, email')
          .in('role', ['employee', 'director'])
          .order('full_name'),
        supabase
          .from('employees')
          .select('id, full_name, email, job_title, employee_number, department_id, department:departments(name)')
          .order('full_name'),
        supabase
          .from('departments')
          .select('id, name')
          .order('name'),
      ]);

      const assignmentsList = (assignmentsRes.data || []) as Assignment[];

      // Fetch members for all assignments in one query
      const assignmentIds = assignmentsList.map(a => a.id);
      if (assignmentIds.length > 0) {
        const { data: members } = await supabase
          .from('supervisor_assignment_members')
          .select('*, employee:employees(full_name, email, job_title, department:departments(name))')
          .in('assignment_id', assignmentIds);

        const membersByAssignment = new Map<string, AssignmentMember[]>();
        (members || []).forEach((m: any) => {
          const list = membersByAssignment.get(m.assignment_id) || [];
          list.push(m);
          membersByAssignment.set(m.assignment_id, list);
        });

        assignmentsList.forEach(a => {
          a.members = membersByAssignment.get(a.id) || [];
        });
      }

      setAssignments(assignmentsList);
      setSupervisorUsers(usersRes.data || []);
      setAllEmployees((employeesRes.data || []) as EmployeeOption[]);
      setDepartments(deptsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ─── Stats ─────────────────────────────────────────

  const totalAssignments = assignments.length;
  const activeAssignments = assignments.filter(a => a.status === 'active').length;
  const inactiveAssignments = assignments.filter(a => a.status === 'inactive').length;
  const endedAssignments = assignments.filter(a => a.status === 'ended').length;

  // ─── Filtered data ────────────────────────────────

  const filteredSupervisorUsers = supervisorUsers.filter(u =>
    form.user_type === 'director' ? u.role === 'director' : u.role === 'employee'
  );

  const filteredAssignments = assignments.filter(a => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (a.user?.full_name || '').toLowerCase().includes(q) ||
      (a.user?.email || '').toLowerCase().includes(q) ||
      (a.title || '').toLowerCase().includes(q) ||
      (a.members || []).some(m => (m.employee?.full_name || '').toLowerCase().includes(q))
    );
  });

  // Employee picker: filter employees for the modal (exclude the supervisor themselves)
  const pickerEmployees = allEmployees.filter(emp => {
    // Prevent self-assignment: supervisor cannot supervise themselves
    if (form.user_id && emp.user_id === form.user_id) return false;
    if (empDeptFilter && emp.department_id !== empDeptFilter) return false;
    if (empSearch) {
      const q = empSearch.toLowerCase();
      if (
        !emp.full_name.toLowerCase().includes(q) &&
        !emp.email.toLowerCase().includes(q) &&
        !(emp.employee_number || '').toLowerCase().includes(q) &&
        !emp.job_title.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  // ─── Modal actions ────────────────────────────────

  const openCreateModal = () => {
    setEditingAssignment(null);
    setForm(emptyForm);
    setFeedback(null);
    setEmpSearch('');
    setEmpDeptFilter('');
    setIsModalOpen(true);
  };

  const openEditModal = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    const memberIds = new Set((assignment.members || []).map(m => m.employee_id));
    setForm({
      user_type: assignment.user_type || 'employee',
      user_id: assignment.user_id,
      notes: assignment.notes || '',
      selected_employee_ids: memberIds,
    });
    setFeedback(null);
    setEmpSearch('');
    setEmpDeptFilter('');
    setIsModalOpen(true);
  };

  const toggleEmployee = (empId: string) => {
    setForm(prev => {
      const next = new Set(prev.selected_employee_ids);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return { ...prev, selected_employee_ids: next };
    });
  };

  const toggleAllVisible = () => {
    const visibleIds = pickerEmployees.map(e => e.id);
    const allSelected = visibleIds.every(id => form.selected_employee_ids.has(id));
    setForm(prev => {
      const next = new Set(prev.selected_employee_ids);
      if (allSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return { ...prev, selected_employee_ids: next };
    });
  };

  const clearAllSelected = () => {
    setForm(prev => ({ ...prev, selected_employee_ids: new Set() }));
  };

  // ─── Save ─────────────────────────────────────────

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (form.selected_employee_ids.size === 0) {
      setFeedback({ type: 'error', message: 'يرجى اختيار موظف واحد على الأقل' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const payload = {
        user_id: form.user_id,
        user_type: form.user_type,
        notes: form.notes || null,
      };

      let assignmentId: string;

      if (editingAssignment) {
        const { error } = await supabase
          .from('supervisor_assignments')
          .update(payload)
          .eq('id', editingAssignment.id);
        if (error) throw error;
        assignmentId = editingAssignment.id;

        // Delete old members and re-insert
        await supabase
          .from('supervisor_assignment_members')
          .delete()
          .eq('assignment_id', assignmentId);

        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'تعديل تعيين مشرف',
          entity_type: 'supervisor_assignments',
          entity_id: assignmentId,
          details: { ...payload, member_count: form.selected_employee_ids.size },
        });
      } else {
        const { data, error } = await supabase
          .from('supervisor_assignments')
          .insert({ ...payload, status: 'active', created_by: user.id })
          .select('id')
          .single();
        if (error) throw error;
        assignmentId = data.id;

        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'إنشاء تعيين مشرف',
          entity_type: 'supervisor_assignments',
          entity_id: assignmentId,
          details: { ...payload, member_count: form.selected_employee_ids.size },
        });
      }

      // Insert members
      const memberInserts = Array.from(form.selected_employee_ids).map(empId => ({
        assignment_id: assignmentId,
        employee_id: empId,
      }));
      if (memberInserts.length > 0) {
        const { error: membersError } = await supabase
          .from('supervisor_assignment_members')
          .insert(memberInserts);
        if (membersError) throw membersError;
      }

      // Orphan-cleanup: criteria group memberships for employees no longer in
      // the assignment must be removed; there is no FK between
      // supervisor_assignment_members and supervisor_criteria_group_members,
      // so the cascade-delete doesn't reach them.
      const newIds = Array.from(form.selected_employee_ids);
      const orphanQuery = supabase
        .from('supervisor_criteria_group_members')
        .delete()
        .eq('assignment_id', assignmentId);
      const { error: orphanError } = await (newIds.length > 0
        ? orphanQuery.not('employee_id', 'in', `(${newIds.join(',')})`)
        : orphanQuery);
      if (orphanError) throw orphanError;

      setFeedback({ type: 'success', message: editingAssignment ? 'تم تحديث التعيين بنجاح' : 'تم إنشاء التعيين بنجاح' });
      setTimeout(() => {
        setIsModalOpen(false);
        setEditingAssignment(null);
        fetchData();
      }, 600);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'حدث خطأ غير متوقع',
      });
    } finally {
      setSaving(false);
    }
  };

  // ─── Status actions ───────────────────────────────

  const handleToggleStatus = async (assignment: Assignment) => {
    if (!user) return;
    const newStatus = assignment.status === 'active' ? 'inactive' : 'active';
    try {
      const { error } = await supabase
        .from('supervisor_assignments')
        .update({ status: newStatus })
        .eq('id', assignment.id);
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: newStatus === 'active' ? 'تفعيل تعيين مشرف' : 'تعطيل تعيين مشرف',
        entity_type: 'supervisor_assignments',
        entity_id: assignment.id,
        details: { previous_status: assignment.status, new_status: newStatus },
      });
      fetchData();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleEndAssignment = async () => {
    if (!user || !confirmEndTarget) return;
    try {
      const { error } = await supabase
        .from('supervisor_assignments')
        .update({ status: 'ended' })
        .eq('id', confirmEndTarget.id);
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'إنهاء تعيين مشرف',
        entity_type: 'supervisor_assignments',
        entity_id: confirmEndTarget.id,
        details: { previous_status: confirmEndTarget.status },
      });
      setConfirmEndTarget(null);
      fetchData();
    } catch (error) {
      console.error('Error ending assignment:', error);
    }
  };

  // ─── Helpers ──────────────────────────────────────

  const handleUserTypeChange = (newType: 'employee' | 'director') => {
    setForm(prev => ({ ...prev, user_type: newType, user_id: '' }));
  };

  const getUserTypeBadge = (userType?: string) => {
    switch (userType) {
      case 'employee': return <Badge variant="info">موظف</Badge>;
      case 'director': return <Badge variant="success">مدير إدارة</Badge>;
      default: return <Badge variant="default">{userType || '--'}</Badge>;
    }
  };

  const getStatusBadge = (assignment: Assignment) => {
    switch (assignment.status) {
      case 'active': return <Badge variant="success">نشط</Badge>;
      case 'inactive': return <Badge variant="warning">معطل</Badge>;
      case 'ended': return <Badge variant="default">منتهي</Badge>;
      default: return <Badge variant="default">{assignment.status}</Badge>;
    }
  };

  // ─── Render ───────────────────────────────────────

  if (loading) {
    return <div className="page-loading-placeholder" aria-hidden="true" />;
  }

  const allVisibleSelected = pickerEmployees.length > 0 && pickerEmployees.every(e => form.selected_employee_ids.has(e.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-ds-xl p-5 lg:p-8 flex items-center justify-between"
        style={{
          background: 'var(--sc-blue-grad)',
          border: '1px solid var(--sc-blue-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-blue-val)' }}>إدارة تعيينات المشرفين</h1>
          <p className="mt-2" style={{ color: 'var(--sc-blue-label)' }}>تعيين موظفين أو مدراء إدارات كمشرفين مؤقتين لتقييم موظفين محددين</p>
        </div>
        <Button onClick={openCreateModal} className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          <span>تعيين مشرف جديد</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-ds-info-bg flex items-center justify-center flex-shrink-0">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-ds-faint">إجمالي التعيينات</p>
              <p className="text-2xl font-bold text-ds-text">{totalAssignments}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-ds-success-bg flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-ds-faint">نشطة</p>
              <p className="text-2xl font-bold text-ds-success-text">{activeAssignments}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-ds-warning-bg flex items-center justify-center flex-shrink-0">
              <ShieldOff className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-ds-faint">معطلة</p>
              <p className="text-2xl font-bold text-ds-warning-text">{inactiveAssignments}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-ds-overlay flex items-center justify-center flex-shrink-0">
              <ShieldX className="h-6 w-6 text-ds-faint" />
            </div>
            <div>
              <p className="text-sm text-ds-faint">منتهية</p>
              <p className="text-2xl font-bold text-ds-muted">{endedAssignments}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Assignments Table */}
      <Card>
        <div className="px-6 py-4 border-b border-ds-border flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-ds-text">جميع التعيينات</h2>
          <div className="relative w-full max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ds-faint" />
            <input
              type="text"
              placeholder="بحث بالاسم أو الموظفين..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-4 py-2 border border-ds-border bg-ds-input text-ds-text placeholder:text-ds-faint rounded-lg focus:ring-2 focus:ring-ds-accent focus:border-ds-accent outline-none transition-colors text-sm"
            />
          </div>
        </div>
        <CardBody className="p-0">
          {filteredAssignments.length === 0 ? (
            <EmptyState
              message={searchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد تعيينات مشرفين حاليًا'}
              icon={<Users className="h-12 w-12 text-ds-faint" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المشرف</TableHead>
                  <TableHead>نوع المستخدم</TableHead>
                  <TableHead>الموظفون المعينون</TableHead>

                  <TableHead>الحالة</TableHead>
                  <TableHead>بواسطة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserAvatar name={assignment.user?.full_name || ''} avatarUrl={assignment.user?.avatar_url} size="md" />
                        <div>
                          <p className="font-medium text-ds-text">{assignment.user?.full_name || '--'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getUserTypeBadge(assignment.user_type)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-ds-text">
                          {(assignment.members || []).length} موظف
                        </span>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {(assignment.members || []).slice(0, 3).map(m => (
                            <span key={m.id} className="text-xs bg-ds-overlay text-ds-muted px-2 py-0.5 rounded-full truncate max-w-[120px]">
                              {m.employee?.full_name || '--'}
                            </span>
                          ))}
                          {(assignment.members || []).length > 3 && (
                            <span className="text-xs text-ds-faint">
                              +{(assignment.members || []).length - 3} آخرين
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(assignment)}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-ds-faint">{assignment.creator?.full_name || '--'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" onClick={() => openEditModal(assignment)} className="flex items-center gap-1">
                          <Edit className="h-3.5 w-3.5" />
                          <span>تعديل</span>
                        </Button>
                        {assignment.status !== 'ended' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleToggleStatus(assignment)} className="flex items-center gap-1">
                              {assignment.status === 'active' ? (
                                <><ShieldOff className="h-3.5 w-3.5" /><span>تعطيل</span></>
                              ) : (
                                <><ShieldCheck className="h-3.5 w-3.5" /><span>تفعيل</span></>
                              )}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setConfirmEndTarget(assignment)} className="flex items-center gap-1 text-red-600 hover:text-ds-danger-text">
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>إنهاء</span>
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

      {/* ─── End Confirmation Modal ─────────────── */}
      <Modal
        isOpen={!!confirmEndTarget}
        onClose={() => setConfirmEndTarget(null)}
        title="تأكيد إنهاء التعيين"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-ds-danger-bg border border-ds-danger-border rounded-lg p-4">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-ds-danger-text">
                هل أنت متأكد من إنهاء تعيين <span className="font-bold">{confirmEndTarget?.user?.full_name}</span> كمشرف؟
              </p>
              <p className="text-xs text-red-600 mt-1">
                سيتم إلغاء صلاحية المشرف فورًا ولن يتمكن من تقييم الموظفين المعينين بعد ذلك.
              </p>
            </div>
          </div>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setConfirmEndTarget(null)}>إلغاء</Button>
            <Button onClick={handleEndAssignment} className="bg-red-600 hover:bg-red-700 text-white">
              <span className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                <span>تأكيد الإنهاء</span>
              </span>
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      {/* ─── Create / Edit Modal ──────────────── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAssignment ? 'تعديل تعيين مشرف' : 'تعيين مشرف جديد'}
        size="xl"
      >
        {feedback && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
            feedback.type === 'success'
              ? 'bg-ds-success-bg border border-ds-success-border text-ds-success-text'
              : 'bg-ds-danger-bg border border-ds-danger-border text-ds-danger-text'
          }`}>
            {feedback.type === 'error' && <AlertTriangle className="h-4 w-4 flex-shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Row 1: Supervisor selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ds-muted mb-1">نوع المشرف</label>
              <ModernSelect
                value={form.user_type}
                onChange={(v) => handleUserTypeChange(v as 'employee' | 'director')}
                ariaLabel="نوع المشرف"
                options={[
                  { value: 'employee', label: 'موظف' },
                  { value: 'director', label: 'مدير إدارة' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ds-muted mb-1">اسم المشرف</label>
              <ModernSelect
                value={form.user_id}
                onChange={(v) => setForm(prev => ({ ...prev, user_id: v }))}
                ariaLabel="اسم المشرف"
                placeholder="اختر المشرف"
                options={[
                  { value: '', label: 'اختر المشرف' },
                  ...filteredSupervisorUsers.map(u => ({ value: u.id, label: `${u.full_name} (${u.email})` })),
                ]}
              />
            </div>
          </div>

          {/* Employee Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-bold text-ds-text">
                اختيار الموظفين المشرف عليهم
                {form.selected_employee_ids.size > 0 && (
                  <span className="text-blue-600 font-normal mr-2">
                    ({form.selected_employee_ids.size} محدد)
                  </span>
                )}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleAllVisible}
                  className="text-xs text-blue-600 hover:text-ds-info-text font-medium"
                >
                  {allVisibleSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل المعروض'}
                </button>
                {form.selected_employee_ids.size > 0 && (
                  <button
                    type="button"
                    onClick={clearAllSelected}
                    className="text-xs text-red-500 hover:text-ds-danger-text font-medium"
                  >
                    مسح التحديد
                  </button>
                )}
              </div>
            </div>

            {/* Search + Filter bar */}
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ds-faint" />
                <input
                  type="text"
                  placeholder="بحث بالاسم أو البريد أو الرقم الوظيفي..."
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  className="w-full pr-9 pl-4 py-2 border border-ds-border bg-ds-input text-ds-text placeholder:text-ds-faint rounded-lg focus:ring-2 focus:ring-ds-accent focus:border-ds-accent outline-none transition-colors text-sm"
                />
              </div>
              <ModernSelect
                value={empDeptFilter}
                onChange={setEmpDeptFilter}
                icon={<Filter className="h-4 w-4" />}
                ariaLabel="تصفية الإدارة"
                className="min-w-[200px]"
                options={[
                  { value: '', label: 'كل الإدارات' },
                  ...departments.map(d => ({ value: d.id, label: d.name })),
                ]}
              />
            </div>

            {/* Employee table */}
            <div className="border border-ds-border rounded-lg overflow-hidden max-h-[320px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-ds-bg sticky top-0 z-10">
                  <tr>
                    <th className="w-10 px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={toggleAllVisible}
                        className="text-ds-faint hover:text-blue-600"
                      >
                        {allVisibleSelected && pickerEmployees.length > 0
                          ? <CheckSquare className="h-4 w-4 text-blue-600" />
                          : <Square className="h-4 w-4" />
                        }
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-ds-muted">اسم الموظف</th>
                    <th className="px-3 py-2.5 text-right font-medium text-ds-muted">البريد الإلكتروني</th>
                    <th className="px-3 py-2.5 text-right font-medium text-ds-muted">الإدارة</th>
                    <th className="px-3 py-2.5 text-right font-medium text-ds-muted">المسمى الوظيفي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ds-border-subtle">
                  {pickerEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-ds-faint">
                        لا توجد نتائج
                      </td>
                    </tr>
                  ) : (
                    pickerEmployees.map(emp => {
                      const isSelected = form.selected_employee_ids.has(emp.id);
                      return (
                        <tr
                          key={emp.id}
                          onClick={() => toggleEmployee(emp.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-ds-info-bg/60' : 'hover:bg-ds-bg'
                          }`}
                        >
                          <td className="px-3 py-2.5">
                            {isSelected
                              ? <CheckSquare className="h-4 w-4 text-blue-600" />
                              : <Square className="h-4 w-4 text-ds-faint" />
                            }
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <UserAvatar name={emp.full_name} avatarUrl={(emp as any).avatar_url} size="sm" />
                              <span className="font-medium text-ds-text">{emp.full_name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-ds-faint">{emp.email}</td>
                          <td className="px-3 py-2.5 text-ds-faint">{emp.department?.name || '--'}</td>
                          <td className="px-3 py-2.5 text-ds-faint">{emp.job_title}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <TextArea
            label="ملاحظات"
            value={form.notes}
            onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="أضف ملاحظات إضافية (اختياري)"
            rows={2}
          />

          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" loading={saving}>
              <span className="flex items-center gap-2">
                {editingAssignment ? (
                  <><Edit className="h-4 w-4" /><span>حفظ التعديلات</span></>
                ) : (
                  <><UserPlus className="h-4 w-4" /><span>إنشاء التعيين</span></>
                )}
              </span>
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
};
