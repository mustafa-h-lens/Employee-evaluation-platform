import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal, ModalFooter } from '../../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Plus, CreditCard as Edit, Trash2, Users, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Employee {
  id: string;
  employee_number: string;
  full_name: string;
  email: string;
  phone: string | null;
  job_title: string;
  department_id: string | null;
  department?: { name: string };
  manager?: { full_name: string };
}

export const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [formData, setFormData] = useState({
    employee_number: '',
    full_name: '',
    email: '',
    phone: '',
    job_title: '',
    department_id: '',
    manager_id: ''
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
    fetchManagers();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data } = await supabase
        .from('employees')
        .select(`
          *,
          department:departments(name),
          manager:users!employees_manager_id_fkey(full_name)
        `)
        .order('full_name');

      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('id, name').order('name');
    setDepartments(data || []);
  };

  const fetchManagers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('role', 'manager')
      .order('full_name');
    setManagers(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingEmployee) {
        await supabase
          .from('employees')
          .update({
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone,
            job_title: formData.job_title,
            department_id: formData.department_id || null,
            manager_id: formData.manager_id || null
          })
          .eq('id', editingEmployee.id);

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
            job_title: formData.job_title,
            department_id: formData.department_id || null,
            manager_id: formData.manager_id || null
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
      department_id: '',
      manager_id: ''
    });
  };

  const openEditModal = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      employee_number: employee.employee_number,
      full_name: employee.full_name,
      email: employee.email,
      phone: employee.phone || '',
      job_title: employee.job_title,
      department_id: employee.department_id || '',
      manager_id: ''
    });
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingEmployee(null);
    resetForm();
    setIsModalOpen(true);
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

  if (loading) {
    return <div className="flex items-center justify-center h-64">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">إدارة الموظفين</h1>
          <p className="text-gray-600 mt-2">إدارة بيانات الموظفين وتوزيعهم على الأقسام</p>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center justify-between animate-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="h-4.5 w-4.5 text-red-600" />
            </div>
            <span className="text-red-800 font-medium text-sm">
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
              icon={<Users className="h-12 w-12 text-gray-400" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={employees.length > 0 && selectedIds.size === employees.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </TableHead>
                  <TableHead>الإجراءات</TableHead>
                  <TableHead>القسم</TableHead>
                  <TableHead>المسمى الوظيفي</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>اسم الموظف</TableHead>
                  <TableHead>رقم الموظف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id} className={selectedIds.has(emp.id) ? 'bg-red-50/50' : ''}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(emp.id)}
                        onChange={() => toggleSelect(emp.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
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
                      {emp.department?.name || <span className="text-gray-400">غير محدد</span>}
                    </TableCell>
                    <TableCell>{emp.job_title}</TableCell>
                    <TableCell className="text-sm">{emp.email}</TableCell>
                    <TableCell>
                      <span className="font-medium">{emp.full_name}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{emp.employee_number}</span>
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
        title={editingEmployee ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
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
            <Input
              label="المسمى الوظيفي"
              value={formData.job_title}
              onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
              required
              placeholder="مطور برمجيات"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">القسم</label>
              <select
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">اختر القسم</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
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
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-gray-900 text-lg font-medium mb-2">
            هل أنت متأكد من حذف هذا الموظف؟
          </p>
          <p className="text-gray-500 text-sm">
            سيتم حذف <span className="font-bold text-gray-700">{deleteTarget?.full_name}</span> ({deleteTarget?.email}) نهائيًا مع حساب الدخول الخاص به.
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

      <Modal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        title="تأكيد حذف موظفين متعددين"
      >
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-gray-900 text-lg font-medium mb-2">
            هل أنت متأكد من حذف {selectedIds.size} موظف؟
          </p>
          <div className="text-gray-500 text-sm space-y-2">
            <p>سيتم حذف الموظفين التالية أسماؤهم نهائيًا مع حساباتهم:</p>
            <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
              {selectedNames.map((name, i) => (
                <div key={i} className="text-gray-700 font-medium py-0.5">{name}</div>
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
