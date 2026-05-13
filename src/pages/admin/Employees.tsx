import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal, ModalFooter } from '../../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { MobileRow } from '../../components/ui/MobileRow';
import { CreditCard as Edit, Trash2, Users, AlertTriangle, UserPlus, Plus, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { RegisterUserModal } from '../../components/ui/RegisterUserModal';
import { ModernSelect } from '../../components/ui/ModernSelect';

interface DirAssignment {
  directorate_id: string;
  department_id: string;
  is_primary: boolean;
  job_title: string;
}

interface EmployeeDirInfo {
  directorate_id: string;
  department_id: string | null;
  is_primary: boolean;
  job_title?: string | null;
  directorate?: { name: string };
  department?: { name: string };
}

interface Employee {
  id: string;
  employee_number: string;
  full_name: string;
  email: string;
  phone: string | null;
  job_title: string;
  department_id: string | null;
  directorate_id: string | null;
  directorate?: { name: string };
  department?: { name: string };
  dir_assignments?: EmployeeDirInfo[];
}

export const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [directoratesList, setDirectoratesList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    employee_number: '',
    full_name: '',
    email: '',
    phone: '',
    job_title: '',
  });
  const [dirAssignments, setDirAssignments] = useState<DirAssignment[]>([
    { directorate_id: '', department_id: '', is_primary: true, job_title: '' }
  ]);
  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    fetchEmployees();
    fetchDirectorates();
    fetchDepartments();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data } = await supabase
        .from('employees')
        .select(`
          *,
          directorate:directorates(name),
          department:departments(name),
          linked_user:users!employees_user_id_fkey(role)
        `)
        .order('full_name');

      // Only show normal employees — exclude directors, ceo, admin
      const filtered = (data || []).filter(
        (e: any) => !e.linked_user || e.linked_user.role === 'employee'
      );

      // Fetch all dir assignments for these employees
      const empIds = filtered.map((e: any) => e.id);
      if (empIds.length > 0) {
        const { data: assignments } = await supabase
          .from('employee_directorates')
          .select('employee_id, directorate_id, department_id, is_primary, job_title, directorate:directorates(name), department:departments(name)')
          .in('employee_id', empIds);

        const assignMap = new Map<string, EmployeeDirInfo[]>();
        (assignments || []).forEach((a: any) => {
          const list = assignMap.get(a.employee_id) || [];
          list.push({
            directorate_id: a.directorate_id,
            department_id: a.department_id,
            is_primary: a.is_primary,
            job_title: a.job_title,
            directorate: a.directorate,
            department: a.department,
          });
          assignMap.set(a.employee_id, list);
        });

        filtered.forEach((emp: any) => {
          emp.dir_assignments = assignMap.get(emp.id) || [];
        });
      }

      setEmployees(filtered);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDirectorates = async () => {
    const { data } = await supabase.from('directorates').select('id, name').order('name');
    setDirectoratesList(data || []);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('id, name, directorate_id').eq('status', 'active').order('name');
    setDepartmentsList(data || []);
  };

  const getFilteredDepts = (directorateId: string) => {
    return departmentsList.filter(d => d.directorate_id === directorateId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Get primary assignment for backward compat
    const primary = dirAssignments.find(a => a.is_primary) || dirAssignments[0];
    const validAssignments = dirAssignments.filter(a => a.directorate_id);
    // Use primary assignment's job_title as the main job_title
    const effectiveJobTitle = primary?.job_title || formData.job_title;

    // Enforce: when a chosen directorate has any departments, the assignment
    // must include a department. Without this, criteria lookup during
    // evaluation would not know which department's list to use.
    for (const a of validAssignments) {
      const dirDepts = getFilteredDepts(a.directorate_id);
      if (dirDepts.length > 0 && !a.department_id) {
        const dir = directoratesList.find(d => d.id === a.directorate_id);
        toast.error(`الإدارة "${dir?.name || ''}" تحتوي على أقسام — يجب اختيار قسم للموظف.`);
        return;
      }
    }

    try {
      if (editingEmployee) {
        await supabase
          .from('employees')
          .update({
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone,
            job_title: effectiveJobTitle,
            directorate_id: primary?.directorate_id || null,
            department_id: primary?.department_id || null
          })
          .eq('id', editingEmployee.id);

        // Update dir assignments: delete old, insert new
        await supabase
          .from('employee_directorates')
          .delete()
          .eq('employee_id', editingEmployee.id);

        if (validAssignments.length > 0) {
          await supabase
            .from('employee_directorates')
            .insert(
              validAssignments.map(a => ({
                employee_id: editingEmployee.id,
                directorate_id: a.directorate_id,
                department_id: a.department_id || null,
                is_primary: a.is_primary,
                job_title: a.job_title || null,
              }))
            );
        }

        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'تحديث موظف',
            entity_type: 'employees',
            entity_id: editingEmployee.id,
            details: { name: formData.full_name }
          });
        }
      } else {
        const { data: newEmployee } = await supabase
          .from('employees')
          .insert({
            employee_number: formData.employee_number,
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone,
            job_title: effectiveJobTitle,
            directorate_id: primary?.directorate_id || null,
            department_id: primary?.department_id || null
          })
          .select()
          .single();

        const { data: newUser } = await supabase
          .from('users')
          .insert({
            email: formData.email,
            password_hash: '$2a$10$demo',
            full_name: formData.full_name,
            role: 'employee'
          })
          .select()
          .single();

        if (newEmployee && newUser) {
          await supabase
            .from('employees')
            .update({ user_id: newUser.id })
            .eq('id', newEmployee.id);

          // Insert dir assignments
          if (validAssignments.length > 0) {
            await supabase
              .from('employee_directorates')
              .insert(
                validAssignments.map(a => ({
                  employee_id: newEmployee.id,
                  directorate_id: a.directorate_id,
                  department_id: a.department_id || null,
                  is_primary: a.is_primary,
                  job_title: a.job_title || null,
                }))
              );
          }

          if (user) {
            await supabase.from('audit_logs').insert({
              user_id: user.id,
              action: 'إضافة موظف',
              entity_type: 'employees',
              entity_id: newEmployee.id,
              details: { name: formData.full_name }
            });
          }
        }
      }

      setIsModalOpen(false);
      setEditingEmployee(null);
      resetForm();
      fetchEmployees();
    } catch (error) {
      console.error('Error saving employee:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      employee_number: '',
      full_name: '',
      email: '',
      phone: '',
      job_title: '',
    });
    setDirAssignments([{ directorate_id: '', department_id: '', is_primary: true, job_title: '' }]);
  };

  const openEditModal = async (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      employee_number: employee.employee_number,
      full_name: employee.full_name,
      email: employee.email,
      phone: employee.phone || '',
      job_title: employee.job_title,
    });

    // Load existing dir assignments
    const { data: assignments } = await supabase
      .from('employee_directorates')
      .select('directorate_id, department_id, is_primary, job_title')
      .eq('employee_id', employee.id);

    if (assignments && assignments.length > 0) {
      setDirAssignments(assignments.map(a => ({
        directorate_id: a.directorate_id,
        department_id: a.department_id || '',
        is_primary: a.is_primary,
        job_title: a.job_title || '',
      })));
    } else if (employee.directorate_id) {
      // Fallback to legacy fields
      setDirAssignments([{
        directorate_id: employee.directorate_id,
        department_id: employee.department_id || '',
        is_primary: true,
        job_title: employee.job_title || '',
      }]);
    } else {
      setDirAssignments([{ directorate_id: '', department_id: '', is_primary: true, job_title: '' }]);
    }

    setIsModalOpen(true);
  };

  const addDirAssignment = () => {
    setDirAssignments(prev => [...prev, { directorate_id: '', department_id: '', is_primary: false, job_title: '' }]);
  };

  const removeDirAssignment = (index: number) => {
    setDirAssignments(prev => {
      const next = prev.filter((_, i) => i !== index);
      // If we removed the primary, make the first one primary
      if (next.length > 0 && !next.some(a => a.is_primary)) {
        next[0].is_primary = true;
      }
      return next.length > 0 ? next : [{ directorate_id: '', department_id: '', is_primary: true, job_title: '' }];
    });
  };

  const updateDirAssignment = (index: number, field: string, value: string | boolean) => {
    setDirAssignments(prev => {
      const next = [...prev];
      if (field === 'is_primary' && value === true) {
        // Only one primary
        next.forEach((a, i) => { a.is_primary = i === index; });
      } else if (field === 'directorate_id') {
        next[index] = { ...next[index], directorate_id: value as string, department_id: '' };
      } else {
        next[index] = { ...next[index], [field]: value };
      }
      return next;
    });
  };

  const confirmDelete = (emp: Employee) => {
    setDeleteTarget(emp);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: linkedUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', deleteTarget.email)
        .maybeSingle();

      // employee_directorates will cascade-delete
      await supabase
        .from('employees')
        .delete()
        .eq('id', deleteTarget.id);

      if (linkedUser) {
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users?action=delete-user`;
        await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: linkedUser.id }),
        });
      }

      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'حذف موظف',
          entity_type: 'employees',
          entity_id: deleteTarget.id,
          details: { name: deleteTarget.full_name }
        });
      }

      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      fetchEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === employees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(employees.map(e => e.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const toDelete = employees.filter(e => selectedIds.has(e.id));
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users?action=delete-user`;

      for (const emp of toDelete) {
        const { data: linkedUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', emp.email)
          .maybeSingle();

        await supabase.from('employees').delete().eq('id', emp.id);

        if (linkedUser) {
          await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ user_id: linkedUser.id }),
          });
        }

        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'حذف موظف',
            entity_type: 'employees',
            entity_id: emp.id,
            details: { name: emp.full_name }
          });
        }
      }

      setSelectedIds(new Set());
      setIsBulkDeleteModalOpen(false);
      fetchEmployees();
    } catch (error) {
      console.error('Error bulk deleting employees:', error);
    } finally {
      setBulkDeleting(false);
    }
  };

  const selectedNames = employees
    .filter(e => selectedIds.has(e.id))
    .map(e => e.full_name);

  const renderDirAssignmentLabels = (emp: Employee) => {
    const assignments = emp.dir_assignments;
    if (!assignments || assignments.length === 0) {
      // Fallback to legacy
      return {
        directorates: emp.directorate?.name || null,
        departments: emp.department?.name || null,
        jobTitles: null as { title: string; dirName: string }[] | null,
      };
    }

    const sorted = [...assignments].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));

    const dirNames = sorted
      .map(a => a.directorate?.name)
      .filter(Boolean);

    const deptNames = sorted
      .map(a => a.department?.name)
      .filter(Boolean);

    const hasPerDirTitles = sorted.some(a => a.job_title);
    const jobTitles = hasPerDirTitles
      ? sorted.filter(a => a.job_title).map(a => ({ title: a.job_title!, dirName: a.directorate?.name || '' }))
      : null;

    return {
      directorates: dirNames.length > 0 ? dirNames : null,
      departments: deptNames.length > 0 ? deptNames : null,
      jobTitles,
    };
  };

  if (loading) {
    return <div className="page-loading-placeholder" aria-hidden="true" />;
  }

  return (
    <div className="space-y-6">
      <div
        className="rounded-ds-xl p-5 lg:p-8 flex items-center justify-between"
        style={{
          background: 'var(--sc-blue-grad)',
          border: '1px solid var(--sc-blue-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--sc-blue-val)' }}>إدارة الموظفين</h1>
          <p className="mt-2" style={{ color: 'var(--sc-blue-label)' }}>إدارة بيانات الموظفين وتوزيعهم على الإدارات</p>
        </div>
        <Button onClick={() => setIsRegisterModalOpen(true)} className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          <span>تسجيل موظف جديد</span>
        </Button>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-ds-danger-bg border border-ds-danger-border rounded-xl px-5 py-3 flex items-center justify-between animate-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-ds-danger-bg rounded-full flex items-center justify-center">
              <Trash2 className="h-4.5 w-4.5 text-red-600" />
            </div>
            <span className="text-ds-danger-text font-medium text-sm">
              تم تحديد <span className="font-bold">{selectedIds.size}</span> موظف
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSelectedIds(new Set())}
            >
              إلغاء التحديد
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="flex items-center gap-1"
            >
              <Trash2 className="h-4 w-4" />
              <span>حذف المحدد ({selectedIds.size})</span>
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardBody className="p-0">
          {employees.length === 0 ? (
            <EmptyState
              message="لا يوجد موظفون مضافون حاليًا"
              icon={<Users className="h-12 w-12 text-ds-faint" />}
            />
          ) : (
            <ResponsiveTable
              desktop={<Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم الموظف</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>الإدارات</TableHead>
                  <TableHead>الأقسام</TableHead>
                  <TableHead>المسمى الوظيفي</TableHead>
                  <TableHead>رقم الموظف</TableHead>
                  <TableHead>الإجراءات</TableHead>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={employees.length > 0 && selectedIds.size === employees.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-ds-border text-blue-600 focus:ring-ds-accent cursor-pointer"
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => {
                  const labels = renderDirAssignmentLabels(emp);
                  return (
                    <TableRow key={emp.id} className={selectedIds.has(emp.id) ? 'bg-ds-danger-bg/50' : ''}>
                      <TableCell>
                        <span className="font-medium">{emp.full_name}</span>
                      </TableCell>
                      <TableCell className="text-sm">{emp.email}</TableCell>
                      <TableCell>
                        {labels.directorates ? (
                          Array.isArray(labels.directorates) ? (
                            <div className="flex flex-col gap-1">
                              {labels.directorates.map((name, i) => (
                                <span key={i} className={`inline-block text-xs px-2 py-0.5 rounded-full border ${
                                  i === 0
                                    ? 'bg-ds-purple-bg text-ds-purple-text border-ds-purple-border font-medium'
                                    : 'bg-ds-overlay text-ds-muted border-ds-border-subtle'
                                }`}>
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm">{labels.directorates}</span>
                          )
                        ) : (
                          <span className="text-ds-faint">غير محدد</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {labels.departments ? (
                          Array.isArray(labels.departments) ? (
                            <div className="flex flex-col gap-1">
                              {labels.departments.map((name, i) => (
                                <span key={i} className="inline-block text-xs px-2 py-0.5 rounded-full bg-ds-info-bg text-ds-info-text border border-ds-info-border">
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm">{labels.departments}</span>
                          )
                        ) : (
                          <span className="text-ds-faint">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {labels.jobTitles ? (
                          <div className="flex flex-col gap-1">
                            {labels.jobTitles.map((jt, i) => (
                              <div key={i} className="text-sm">
                                <span className="font-medium">{jt.title}</span>
                                <span className="text-xs text-ds-faint mr-1">({jt.dirName})</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          emp.job_title
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{emp.employee_number}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(emp)}
                            className="flex items-center gap-1"
                          >
                            <Edit className="h-4 w-4" />
                            <span>تعديل</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => confirmDelete(emp)}
                            className="flex items-center gap-1"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>حذف</span>
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(emp.id)}
                          onChange={() => toggleSelect(emp.id)}
                          className="w-4 h-4 rounded border-ds-border text-blue-600 focus:ring-ds-accent cursor-pointer"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>}
            mobile={employees.map(emp => {
              const labels = renderDirAssignmentLabels(emp);
              const dirText = !labels.directorates
                ? '—'
                : Array.isArray(labels.directorates)
                  ? labels.directorates.join(' · ')
                  : labels.directorates;
              const deptText = !labels.departments
                ? '—'
                : Array.isArray(labels.departments)
                  ? labels.departments.join(' · ')
                  : labels.departments;
              const jobTitleText = labels.jobTitles
                ? labels.jobTitles.map(jt => jt.title).join(' · ')
                : emp.job_title;
              return (
                <MobileRow
                  key={emp.id}
                  title={emp.full_name}
                  subtitle={emp.email}
                  fields={[
                    { label: 'رقم الموظف', value: emp.employee_number },
                    { label: 'المسمى الوظيفي', value: jobTitleText },
                    { label: 'الإدارة', value: dirText },
                    { label: 'القسم', value: deptText },
                  ]}
                  action={
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => openEditModal(emp)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => confirmDelete(emp)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  }
                />
              );
            })}
          />
          )}
        </CardBody>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEmployee ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!editingEmployee && (
              <Input
                label="رقم الموظف"
                value={formData.employee_number}
                onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
                required
                placeholder="EMP001"
              />
            )}
            <Input
              label="الاسم الكامل"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
              placeholder="محمد أحمد"
            />
            <Input
              label="البريد الإلكتروني"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={!!editingEmployee}
              placeholder="mohammed@h-lens.co"
            />
            <Input
              label="رقم الجوال"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+966501234567"
            />
          </div>

          {/* Multi-directorate assignments */}
          <div className="mt-6 border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ds-text">الإدارات والأقسام</h3>
              <button
                type="button"
                onClick={addDirAssignment}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-ds-info-text font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
                إضافة إدارة أخرى
              </button>
            </div>

            <div className="space-y-3">
              {dirAssignments.map((assignment, index) => {
                const filteredDepts = getFilteredDepts(assignment.directorate_id);
                return (
                  <div key={index} className="p-3 rounded-lg border border-ds-border bg-ds-bg/50">
                    {dirAssignments.length > 1 && (
                      <div className="flex items-center justify-end mb-2">
                        <button
                          type="button"
                          onClick={() => removeDirAssignment(index)}
                          className="text-red-400 hover:text-red-600 p-0.5"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-ds-muted mb-1">الإدارة</label>
                        <ModernSelect
                          value={assignment.directorate_id}
                          onChange={(v) => updateDirAssignment(index, 'directorate_id', v)}
                          ariaLabel="الإدارة"
                          placeholder="اختر الإدارة"
                          options={[
                            { value: '', label: 'اختر الإدارة' },
                            ...directoratesList.map((dir) => ({ value: dir.id, label: dir.name })),
                          ]}
                        />
                      </div>
                      {filteredDepts.length > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-ds-muted mb-1">القسم</label>
                          <ModernSelect
                            value={assignment.department_id}
                            onChange={(v) => updateDirAssignment(index, 'department_id', v)}
                            ariaLabel="القسم"
                            placeholder="-- اختر القسم --"
                            options={[
                              { value: '', label: '-- اختر القسم (اختياري) --' },
                              ...filteredDepts.map((dept) => ({ value: dept.id, label: dept.name })),
                            ]}
                          />
                        </div>
                      )}
                      <div className={filteredDepts.length > 0 ? 'col-span-2' : ''}>
                        <label className="block text-xs font-medium text-ds-muted mb-1">المسمى الوظيفي في هذه الإدارة</label>
                        <input
                          type="text"
                          value={assignment.job_title}
                          onChange={(e) => updateDirAssignment(index, 'job_title', e.target.value)}
                          placeholder={formData.job_title || 'المسمى الوظيفي'}
                          className="w-full px-3 py-2 text-sm border border-ds-border bg-ds-input text-ds-text placeholder:text-ds-faint rounded-lg focus:ring-2 focus:ring-ds-accent focus:border-ds-accent outline-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit">
              {editingEmployee ? 'تحديث' : 'إضافة'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="تأكيد حذف الموظف"
      >
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 bg-ds-danger-bg rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-ds-text text-lg font-medium mb-2">
            هل أنت متأكد من حذف هذا الموظف؟
          </p>
          <p className="text-ds-faint text-sm">
            سيتم حذف <span className="font-bold text-ds-muted">{deleteTarget?.full_name}</span> ({deleteTarget?.email}) نهائيًا مع حساب الدخول الخاص به.
          </p>
        </div>
        <ModalFooter className="justify-center">
          <Button type="button" variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
            إلغاء
          </Button>
          <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
            <span className="flex items-center gap-1">
              <Trash2 className="h-4 w-4" />
              <span>حذف الموظف</span>
            </span>
          </Button>
        </ModalFooter>
      </Modal>

      <RegisterUserModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        role="employee"
        onSuccess={fetchEmployees}
      />

      <Modal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        title="تأكيد حذف موظفين متعددين"
      >
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 bg-ds-danger-bg rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-ds-text text-lg font-medium mb-2">
            هل أنت متأكد من حذف {selectedIds.size} موظف؟
          </p>
          <div className="text-ds-faint text-sm space-y-2">
            <p>سيتم حذف الموظفين التالية أسماؤهم نهائيًا مع حساباتهم:</p>
            <div className="bg-ds-bg rounded-lg p-3 max-h-40 overflow-y-auto">
              {selectedNames.map((name, i) => (
                <div key={i} className="text-ds-muted font-medium py-0.5">{name}</div>
              ))}
            </div>
          </div>
        </div>
        <ModalFooter className="justify-center">
          <Button type="button" variant="secondary" onClick={() => setIsBulkDeleteModalOpen(false)}>
            إلغاء
          </Button>
          <Button type="button" variant="danger" onClick={handleBulkDelete} loading={bulkDeleting}>
            <span className="flex items-center gap-1">
              <Trash2 className="h-4 w-4" />
              <span>حذف الكل ({selectedIds.size})</span>
            </span>
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};
