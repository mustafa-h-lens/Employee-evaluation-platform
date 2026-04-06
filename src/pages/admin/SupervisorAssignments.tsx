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
  Calendar, CreditCard as Edit, AlertTriangle, Search, Clock,
  Trash2, CheckSquare, Square, Filter
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────

interface AssignmentMember {
  id: string;
  employee_id: string;
  employee?: { full_name: string; email: string; job_title: string; department?: { name: string } };
}

interface Assignment {
  id: string;
  user_id: string;
  user_type: 'employee' | 'manager';
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
  user_type: 'employee' | 'manager';
  user_id: string;
  title: string;
  start_date: string;
  end_date: string;
  notes: string;
  selected_employee_ids: Set<string>;
}

const emptyForm: AssignmentForm = {
  user_type: 'employee',
  user_id: '',
  title: '',
  start_date: '',
  end_date: '',
  notes: '',
  selected_employee_ids: new Set(),
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
};

const getRemainingDays = (endDate: string): number => {
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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
          .in('role', ['employee', 'manager'])
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
    form.user_type === 'employee' ? u.role === 'employee' : u.role === 'manager'
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
      user_type: assignment.user_type || (assignment.user?.role === 'manager' ? 'manager' : 'employee'),
      user_id: assignment.user_id,
      title: assignment.title || '',
      start_date: assignment.start_date,
      end_date: assignment.end_date,
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

    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setFeedback({ type: 'error', message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const payload = {
        user_id: form.user_id,
        user_type: form.user_type,
        title: form.title || null,
        start_date: form.start_date,
        end_date: form.end_date,
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

  const handleUserTypeChange = (newType: 'employee' | 'manager') => {
    setForm(prev => ({ ...prev, user_type: newType, user_id: '' }));
  };

  const getUserTypeBadge = (userType?: string) => {
    switch (userType) {
      case 'employee': return <Badge variant="info">موظف</Badge>;
      case 'manager': return <Badge variant="warning">مدير قسم</Badge>;
      default: return <Badge variant="default">{userType || '--'}</Badge>;
    }
  };

  const getStatusBadge = (assignment: Assignment) => {
    const remaining = getRemainingDays(assignment.end_date);
    switch (assignment.status) {
      case 'active':
        return (
          <div className="flex flex-col items-start gap-1">
            <Badge variant="success">نشط</Badge>
            {remaining <= 7 && remaining >= 0 && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {remaining === 0 ? 'ينتهي اليوم' : `متبقي ${remaining} يوم`}
              </span>
            )}
            {remaining < 0 && (
              <span className="text-xs text-red-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                منتهي الصلاحية
              </span>
            )}
          </div>
        );
      case 'inactive': return <Badge variant="warning">معطل</Badge>;
      case 'ended': return <Badge variant="default">منتهي</Badge>;
      default: return <Badge variant="default">{assignment.status}</Badge>;
    }
  };

  // ─── Render ───────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">جاري تحميل التعيينات...</p>
        </div>
      </div>
    );
  }

  const allVisibleSelected = pickerEmployees.length > 0 && pickerEmployees.every(e => form.selected_employee_ids.has(e.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">إدارة تعيينات المشرفين</h1>
          <p className="text-gray-600 mt-2">تعيين موظفين أو مدراء أقسام كمشرفين مؤقتين لتقييم موظفين محددين</p>
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
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">إجمالي التعيينات</p>
              <p className="text-2xl font-bold text-gray-900">{totalAssignments}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">نشطة</p>
              <p className="text-2xl font-bold text-green-700">{activeAssignments}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <ShieldOff className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">معطلة</p>
              <p className="text-2xl font-bold text-amber-700">{inactiveAssignments}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <ShieldX className="h-6 w-6 text-gray-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">منتهية</p>
              <p className="text-2xl font-bold text-gray-700">{endedAssignments}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Assignments Table */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-gray-900">جميع التعيينات</h2>
          <div className="relative w-full max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="بحث بالاسم أو الموظفين..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
            />
          </div>
        </div>
        <CardBody className="p-0">
          {filteredAssignments.length === 0 ? (
            <EmptyState
              message={searchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد تعيينات مشرفين حاليًا'}
              icon={<Users className="h-12 w-12 text-gray-400" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المشرف</TableHead>
                  <TableHead>نوع المستخدم</TableHead>
                  <TableHead>الموظفون المعينون</TableHead>
                  <TableHead>فترة التعيين</TableHead>
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
                        <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-blue-700">
                            {assignment.user?.full_name?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{assignment.user?.full_name || '--'}</p>
                          {assignment.title && (
                            <p className="text-xs text-gray-500">{assignment.title}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getUserTypeBadge(assignment.user_type)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-gray-900">
                          {(assignment.members || []).length} موظف
                        </span>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {(assignment.members || []).slice(0, 3).map(m => (
                            <span key={m.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full truncate max-w-[120px]">
                              {m.employee?.full_name || '--'}
                            </span>
                          ))}
                          {(assignment.members || []).length > 3 && (
                            <span className="text-xs text-gray-400">
                              +{(assignment.members || []).length - 3} آخرين
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          <span>{formatDate(assignment.start_date)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-500 mt-0.5">
                          <span className="text-gray-400 mr-5">←</span>
                          <span>{formatDate(assignment.end_date)}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(assignment)}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-gray-500">{assignment.creator?.full_name || '--'}</span>
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
                            <Button size="sm" variant="outline" onClick={() => setConfirmEndTarget(assignment)} className="flex items-center gap-1 text-red-600 hover:text-red-700">
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
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">
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
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {feedback.type === 'error' && <AlertTriangle className="h-4 w-4 flex-shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Row 1: Supervisor selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نوع المشرف</label>
              <select
                value={form.user_type}
                onChange={(e) => handleUserTypeChange(e.target.value as 'employee' | 'manager')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              >
                <option value="employee">موظف</option>
                <option value="manager">مدير قسم</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم المشرف</label>
              <select
                value={form.user_id}
                onChange={(e) => setForm(prev => ({ ...prev, user_id: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              >
                <option value="">اختر المشرف</option>
                {filteredSupervisorUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Dates + Title */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ البداية</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ النهاية</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">عنوان التعيين (اختياري)</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="مثال: مشرف مؤقت"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Employee Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-bold text-gray-900">
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
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {allVisibleSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل المعروض'}
                </button>
                {form.selected_employee_ids.size > 0 && (
                  <button
                    type="button"
                    onClick={clearAllSelected}
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    مسح التحديد
                  </button>
                )}
              </div>
            </div>

            {/* Search + Filter bar */}
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="بحث بالاسم أو البريد أو الرقم الوظيفي..."
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  className="w-full pr-9 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                />
              </div>
              <div className="relative">
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  value={empDeptFilter}
                  onChange={(e) => setEmpDeptFilter(e.target.value)}
                  className="pr-9 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm min-w-[180px]"
                >
                  <option value="">كل الأقسام</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Employee table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[320px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="w-10 px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={toggleAllVisible}
                        className="text-gray-500 hover:text-blue-600"
                      >
                        {allVisibleSelected && pickerEmployees.length > 0
                          ? <CheckSquare className="h-4 w-4 text-blue-600" />
                          : <Square className="h-4 w-4" />
                        }
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-gray-700">اسم الموظف</th>
                    <th className="px-3 py-2.5 text-right font-medium text-gray-700">البريد الإلكتروني</th>
                    <th className="px-3 py-2.5 text-right font-medium text-gray-700">القسم</th>
                    <th className="px-3 py-2.5 text-right font-medium text-gray-700">المسمى الوظيفي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pickerEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-400">
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
                            isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-3 py-2.5">
                            {isSelected
                              ? <CheckSquare className="h-4 w-4 text-blue-600" />
                              : <Square className="h-4 w-4 text-gray-400" />
                            }
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-blue-700">{emp.full_name.charAt(0)}</span>
                              </div>
                              <span className="font-medium text-gray-900">{emp.full_name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-gray-500">{emp.email}</td>
                          <td className="px-3 py-2.5 text-gray-500">{emp.department?.name || '--'}</td>
                          <td className="px-3 py-2.5 text-gray-500">{emp.job_title}</td>
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
