import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal, ModalFooter } from '../../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { UserCog, Building2, ArrowLeftRight, UserMinus, AlertTriangle, Search, Users, Pencil } from 'lucide-react';
import { Input } from '../../components/ui/Input';

import { useAuth } from '../../contexts/AuthContext';

interface Manager {
  id: string;
  full_name: string;
  email: string;
  job_title?: string;
  auth_id?: string;
}

interface DepartmentWithManager {
  id: string;
  name: string;
  manager_id: string | null;
  manager?: { id: string; full_name: string; email: string } | null;
  employee_count: number;
}

export const Managers: React.FC = () => {
  const [departments, setDepartments] = useState<DepartmentWithManager[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isUnassignModalOpen, setIsUnassignModalOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<DepartmentWithManager | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<Manager | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [deptResult, managerResult] = await Promise.all([
        supabase
          .from('departments')
          .select(`
            id, name, manager_id,
            manager:users!departments_manager_id_fkey(id, full_name, email)
          `)
          .order('name'),
        supabase
          .from('users')
          .select('id, full_name, email, job_title, auth_id')
          .eq('role', 'manager')
          .order('full_name'),
      ]);

      if (deptResult.data) {
        const withCounts = await Promise.all(
          deptResult.data.map(async (dept) => {
            const { count } = await supabase
              .from('employees')
              .select('*', { count: 'exact', head: true })
              .eq('department_id', dept.id);
            return { ...dept, employee_count: count || 0 };
          })
        );
        setDepartments(withCounts as DepartmentWithManager[]);
      }

      if (managerResult.data) {
        setManagers(managerResult.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const assignedManagerIds = departments
    .filter(d => d.manager_id)
    .map(d => d.manager_id!);

  const availableManagers = managers.filter(
    m => !assignedManagerIds.includes(m.id)
  );

  const openAssignModal = (dept: DepartmentWithManager) => {
    setSelectedDept(dept);
    setSelectedManagerId(dept.manager_id || '');
    setIsAssignModalOpen(true);
  };

  const openUnassignModal = (dept: DepartmentWithManager) => {
    setSelectedDept(dept);
    setIsUnassignModalOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedDept || !selectedManagerId) return;
    setSaving(true);

    try {
      await supabase
        .from('departments')
        .update({ manager_id: selectedManagerId })
        .eq('id', selectedDept.id);

      const managerName = managers.find(m => m.id === selectedManagerId)?.full_name;

      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'تعيين مدير قسم',
          entity_type: 'departments',
          entity_id: selectedDept.id,
          details: { department: selectedDept.name, manager: managerName }
        });
      }

      setIsAssignModalOpen(false);
      setSelectedDept(null);
      setSelectedManagerId('');
      fetchData();
    } catch (error) {
      console.error('Error assigning manager:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async () => {
    if (!selectedDept) return;
    setSaving(true);

    try {
      const managerName = selectedDept.manager?.full_name;

      await supabase
        .from('departments')
        .update({ manager_id: null })
        .eq('id', selectedDept.id);

      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'إلغاء تعيين مدير قسم',
          entity_type: 'departments',
          entity_id: selectedDept.id,
          details: { department: selectedDept.name, manager: managerName }
        });
      }

      setIsUnassignModalOpen(false);
      setSelectedDept(null);
      fetchData();
    } catch (error) {
      console.error('Error unassigning manager:', error);
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (mgr: Manager) => {
    setEditingManager(mgr);
    setEditFullName(mgr.full_name);
    setEditEmail(mgr.email);
    setEditJobTitle(mgr.job_title || '');
    setEditPassword('');
    setIsEditModalOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingManager) return;
    setSaving(true);
    try {
      await supabase
        .from('users')
        .update({ full_name: editFullName, email: editEmail, job_title: editJobTitle })
        .eq('id', editingManager.id);

      if (editPassword.trim() && editingManager.auth_id) {
        await supabase.functions.invoke('manage-users?action=update-password', {
          body: { auth_id: editingManager.auth_id, password: editPassword.trim() }
        });
      }

      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'تعديل بيانات مدير',
          entity_type: 'users',
          entity_id: editingManager.id,
          details: { full_name: editFullName, email: editEmail, job_title: editJobTitle }
        });
      }

      setIsEditModalOpen(false);
      setEditingManager(null);
      fetchData();
    } catch (error) {
      console.error('Error updating manager:', error);
    } finally {
      setSaving(false);
    }
  };

  const filteredDepartments = departments.filter(dept => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      dept.name.toLowerCase().includes(q) ||
      (dept.manager?.full_name || '').toLowerCase().includes(q) ||
      (dept.manager?.email || '').toLowerCase().includes(q)
    );
  });

  const assignedCount = departments.filter(d => d.manager_id).length;
  const unassignedCount = departments.filter(d => !d.manager_id).length;

  if (loading) {
    return <div className="flex items-center justify-center h-64">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">إدارة مدراء الأقسام</h1>
          <p className="text-gray-600 mt-2">تعيين وإدارة مدراء الأقسام في المنظمة</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">إجمالي الأقسام</p>
              <p className="text-2xl font-bold text-gray-900">{departments.length}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
              <UserCog className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">أقسام بمدراء</p>
              <p className="text-2xl font-bold text-green-700">{assignedCount}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">أقسام بدون مدير</p>
              <p className="text-2xl font-bold text-amber-700">{unassignedCount}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">تعيينات المدراء</h2>
            <div className="relative w-72">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالقسم أو اسم المدير..."
                className="w-full pr-10 pl-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        </div>
        <CardBody className="p-0">
          {filteredDepartments.length === 0 ? (
            <EmptyState
              message={searchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد أقسام مضافة حاليًا'}
              icon={<Users className="h-12 w-12 text-gray-400" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الإجراءات</TableHead>
                  <TableHead>عدد الموظفين</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>المدير المعين</TableHead>
                  <TableHead>القسم</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDepartments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAssignModal(dept)}
                          className="flex items-center gap-1"
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                          <span>{dept.manager_id ? 'تغيير' : 'تعيين'}</span>
                        </Button>
                        {dept.manager_id && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => openUnassignModal(dept)}
                            className="flex items-center gap-1"
                          >
                            <UserMinus className="h-4 w-4" />
                            <span>إلغاء</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{dept.employee_count}</span>
                    </TableCell>
                    <TableCell>
                      {dept.manager?.email ? (
                        <span className="text-sm text-gray-600">{dept.manager.email}</span>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {dept.manager?.full_name ? (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-blue-700">
                              {dept.manager.full_name.charAt(0)}
                            </span>
                          </div>
                          <span className="font-medium">{dept.manager.full_name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">لم يتم التعيين</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-4 w-4 text-gray-500" />
                        </div>
                        <span className="font-medium">{dept.name}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {managers.length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">جميع المدراء المسجلين</h2>
          </div>
          <CardBody className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الإجراءات</TableHead>
                  <TableHead>القسم</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>الاسم</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managers.map((mgr) => {
                  const assignedDept = departments.find(d => d.manager_id === mgr.id);
                  return (
                    <TableRow key={mgr.id}>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(mgr)}
                          className="flex items-center gap-1"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>تعديل</span>
                        </Button>
                      </TableCell>
                      <TableCell>
                        {assignedDept ? (
                          <Badge variant="info">{assignedDept.name}</Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">غير معين لقسم</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">{mgr.email}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-blue-700">
                              {mgr.full_name.charAt(0)}
                            </span>
                          </div>
                          <span className="font-medium">{mgr.full_name}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}

      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={selectedDept?.manager_id ? `تغيير مدير قسم ${selectedDept?.name}` : `تعيين مدير لقسم ${selectedDept?.name}`}
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-900">{selectedDept?.name}</p>
                <p className="text-sm text-blue-700">{selectedDept?.employee_count} موظف في القسم</p>
              </div>
            </div>
          </div>

          {selectedDept?.manager_id && selectedDept?.manager && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800 mb-1">المدير الحالي:</p>
              <p className="font-medium text-amber-900">{selectedDept.manager.full_name}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">اختر المدير الجديد</label>
            <select
              value={selectedManagerId}
              onChange={(e) => setSelectedManagerId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">-- اختر مدير --</option>
              {availableManagers.map((mgr) => (
                <option key={mgr.id} value={mgr.id}>
                  {mgr.full_name} ({mgr.email})
                </option>
              ))}
              {selectedDept?.manager_id && (
                <option value={selectedDept.manager_id} disabled>
                  {selectedDept.manager?.full_name} (الحالي)
                </option>
              )}
            </select>
            {availableManagers.length === 0 && !selectedDept?.manager_id && (
              <p className="mt-2 text-sm text-amber-600">
                لا يوجد مدراء متاحون. يرجى تسجيل مدير جديد أولًا من صفحة تسجيل المستخدمين.
              </p>
            )}
          </div>
        </div>

        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => setIsAssignModalOpen(false)}>
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleAssign}
            loading={saving}
            disabled={!selectedManagerId || selectedManagerId === selectedDept?.manager_id}
          >
            <span className="flex items-center gap-1">
              <UserCog className="h-4 w-4" />
              <span>تعيين المدير</span>
            </span>
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="تعديل بيانات المدير"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الكامل</label>
            <Input
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              placeholder="الاسم الكامل"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
            <Input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="البريد الإلكتروني"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">المسمى الوظيفي</label>
            <Input
              value={editJobTitle}
              onChange={(e) => setEditJobTitle(e.target.value)}
              placeholder="المسمى الوظيفي"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور الجديدة</label>
            <Input
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="اتركه فارغاً إذا لم تريد تغييره"
            />
          </div>
        </div>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleEditSave}
            loading={saving}
            disabled={!editFullName.trim() || !editEmail.trim()}
          >
            <span className="flex items-center gap-1">
              <Pencil className="h-4 w-4" />
              <span>حفظ التعديلات</span>
            </span>
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={isUnassignModalOpen}
        onClose={() => setIsUnassignModalOpen(false)}
        title="إلغاء تعيين المدير"
      >
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-gray-900 text-lg font-medium mb-2">
            هل تريد إلغاء تعيين المدير؟
          </p>
          <p className="text-gray-500 text-sm">
            سيتم إلغاء تعيين <span className="font-bold text-gray-700">{selectedDept?.manager?.full_name}</span> من قسم <span className="font-bold text-gray-700">{selectedDept?.name}</span>.
          </p>
        </div>
        <ModalFooter className="justify-center">
          <Button type="button" variant="secondary" onClick={() => setIsUnassignModalOpen(false)}>
            إلغاء
          </Button>
          <Button type="button" variant="danger" onClick={handleUnassign} loading={saving}>
            <span className="flex items-center gap-1">
              <UserMinus className="h-4 w-4" />
              <span>إلغاء التعيين</span>
            </span>
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};
