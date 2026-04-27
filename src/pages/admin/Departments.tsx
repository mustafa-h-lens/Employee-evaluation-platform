import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal, ModalFooter } from '../../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Plus, CreditCard as Edit, Trash2, Building2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ModernSelect } from '../../components/ui/ModernSelect';

interface Department {
  id: string;
  name: string;
  directorate_id: string | null;
  directorate?: { name: string };
  employee_count?: number;
}

interface DirectorateOption {
  id: string;
  name: string;
}

export const Departments: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [directorates, setDirectorates] = useState<DirectorateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState({ name: '', directorate_id: '' });
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchDepartments();
    fetchDirectorates();
  }, []);

  const fetchDepartments = async () => {
    try {
      const deptResult = await supabase
        .from('departments')
        .select('id, name, directorate_id, directorate:directorates(name)')
        .eq('status', 'active')
        .order('name');

      if (!deptResult.error && deptResult.data) {
        const departmentsWithCount = await Promise.all(
          deptResult.data.map(async (dept) => {
            const { count } = await supabase
              .from('employees')
              .select('*', { count: 'exact', head: true })
              .eq('department_id', dept.id);

            return {
              ...dept,
              employee_count: count || 0
            };
          })
        );
        setDepartments(departmentsWithCount);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDirectorates = async () => {
    const { data } = await supabase.from('directorates').select('id, name').order('name');
    setDirectorates(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingDepartment) {
        await supabase
          .from('departments')
          .update({ name: formData.name, directorate_id: formData.directorate_id || null })
          .eq('id', editingDepartment.id);

        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'تحديث قسم',
            entity_type: 'departments',
            entity_id: editingDepartment.id,
            details: { name: formData.name }
          });
        }
      } else {
        const { data } = await supabase
          .from('departments')
          .insert({ name: formData.name, directorate_id: formData.directorate_id || null, status: 'active' })
          .select()
          .single();

        if (user && data) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'إضافة قسم',
            entity_type: 'departments',
            entity_id: data.id,
            details: { name: formData.name }
          });
        }
      }

      setIsModalOpen(false);
      setEditingDepartment(null);
      setFormData({ name: '', directorate_id: '' });
      fetchDepartments();
    } catch (error) {
      console.error('Error saving department:', error);
    }
  };

  const openEditModal = (department: Department) => {
    setEditingDepartment(department);
    setFormData({ name: department.name, directorate_id: department.directorate_id || '' });
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingDepartment(null);
    setFormData({ name: '', directorate_id: '' });
    setIsModalOpen(true);
  };

  const confirmDelete = (dept: Department) => {
    setDeleteTarget(dept);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      await supabase.from('employees').update({ department_id: null }).eq('department_id', deleteTarget.id);
      await supabase.from('departments').delete().eq('id', deleteTarget.id);

      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'حذف قسم',
          entity_type: 'departments',
          entity_id: deleteTarget.id,
          details: { name: deleteTarget.name }
        });
      }

      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      fetchDepartments();
    } catch (error) {
      console.error('Error deleting department:', error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <div
        className="rounded-ds-xl p-8 flex items-center justify-between"
        style={{
          background: 'var(--sc-green-grad)',
          border: '1px solid var(--sc-green-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-green-val)' }}>إدارة الأقسام</h1>
          <p className="mt-2" style={{ color: 'var(--sc-green-label)' }}>إدارة أقسام الشركة</p>
        </div>
        <Button onClick={openAddModal} className="flex items-center gap-2">
          <span>إضافة قسم</span>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <Card>
        <CardBody className="p-0">
          {departments.length === 0 ? (
            <EmptyState
              message="لا يوجد أقسام مضافة حاليًا"
              icon={<Building2 className="h-12 w-12 text-ds-faint" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم القسم</TableHead>
                  <TableHead>الإدارة</TableHead>
                  <TableHead>عدد الموظفين</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell>
                      <span className="font-medium">{dept.name}</span>
                    </TableCell>
                    <TableCell>
                      {dept.directorate?.name || <span className="text-ds-faint">غير محدد</span>}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{dept.employee_count}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(dept)}
                          className="flex items-center gap-1"
                        >
                          <Edit className="h-4 w-4" />
                          <span>تعديل</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => confirmDelete(dept)}
                          className="flex items-center gap-1"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>حذف</span>
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
        title={editingDepartment ? 'تعديل القسم' : 'إضافة قسم جديد'}
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              label="اسم القسم"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="مثال: تقنية المعلومات"
            />
            <div>
              <label className="block text-sm font-medium text-ds-muted mb-1">الإدارة التابع لها</label>
              <ModernSelect
                value={formData.directorate_id}
                onChange={(v) => setFormData({ ...formData, directorate_id: v })}
                ariaLabel="الإدارة"
                placeholder="-- اختر الإدارة --"
                options={directorates.map((dir) => ({ value: dir.id, label: dir.name }))}
              />
            </div>
          </div>

          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit">
              {editingDepartment ? 'تحديث' : 'إضافة'}
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
            هل أنت متأكد من حذف القسم؟
          </p>
          <p className="text-ds-faint text-sm">
            سيتم حذف قسم <span className="font-bold text-ds-muted">{deleteTarget?.name}</span> نهائيًا.
            {(deleteTarget?.employee_count ?? 0) > 0 && (
              <span className="block mt-1 text-red-500">
                تحذير: يوجد {deleteTarget?.employee_count} موظف في هذا القسم
              </span>
            )}
          </p>
        </div>
        <ModalFooter className="justify-center">
          <Button type="button" variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
            إلغاء
          </Button>
          <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
            <span className="flex items-center gap-1">
              <Trash2 className="h-4 w-4" />
              <span>حذف القسم</span>
            </span>
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};
