import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal, ModalFooter } from '../../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Plus, CreditCard as Edit, Trash2, Landmark, AlertTriangle, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Directorate {
  id: string;
  name: string;
  director_id: string | null;
  director?: { full_name: string };
  departments?: { id: string; name: string; manager?: { full_name: string } }[];
}

interface DirectorOption {
  id: string;
  full_name: string;
  email: string;
}

interface DepartmentOption {
  id: string;
  name: string;
  directorate_id: string | null;
}

export const Directorates: React.FC = () => {
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [availableDirectors, setAvailableDirectors] = useState<DirectorOption[]>([]);
  const [allDepartments, setAllDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDirectorate, setEditingDirectorate] = useState<Directorate | null>(null);
  const [formData, setFormData] = useState({ name: '', director_id: '' });
  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Directorate | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dirResult, directorsResult, deptsResult] = await Promise.all([
        supabase
          .from('directorates')
          .select(`
            id, name, director_id,
            director:users!directorates_director_id_fkey(full_name)
          `)
          .order('name'),
        supabase
          .from('users')
          .select('id, full_name, email')
          .eq('role', 'director')
          .order('full_name'),
        supabase
          .from('departments')
          .select('id, name, directorate_id, manager:users!departments_manager_id_fkey(full_name)')
          .order('name'),
      ]);

      if (directorsResult.data) setAvailableDirectors(directorsResult.data);

      const depts = (deptsResult.data || []) as any[];
      setAllDepartments(depts);

      if (dirResult.data) {
        const withDepts = dirResult.data.map((dir: any) => ({
          ...dir,
          departments: depts.filter((d: any) => d.directorate_id === dir.id),
        }));
        setDirectorates(withDepts);
      }
    } catch (error) {
      console.error('Error fetching directorates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const directorId = formData.director_id || null;

    try {
      let directorateId: string;

      if (editingDirectorate) {
        directorateId = editingDirectorate.id;
        await supabase
          .from('directorates')
          .update({ name: formData.name, director_id: directorId })
          .eq('id', directorateId);

        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'تحديث إدارة',
            entity_type: 'directorates',
            entity_id: directorateId,
            details: { name: formData.name },
          });
        }
      } else {
        const { data, error: insertError } = await supabase
          .from('directorates')
          .insert({ name: formData.name, director_id: directorId })
          .select()
          .single();

        if (insertError) throw insertError;
        if (!data) return;
        directorateId = data.id;

        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'إضافة إدارة',
            entity_type: 'directorates',
            entity_id: directorateId,
            details: { name: formData.name },
          });
        }
      }

      // Update department assignments: unlink old, link new
      const currentlyLinked = allDepartments.filter(d => d.directorate_id === directorateId).map(d => d.id);
      const toUnlink = currentlyLinked.filter(id => !selectedDeptIds.has(id));
      const toLink = [...selectedDeptIds].filter(id => !currentlyLinked.includes(id));

      if (toUnlink.length > 0) {
        await supabase
          .from('departments')
          .update({ directorate_id: null })
          .in('id', toUnlink);
      }
      if (toLink.length > 0) {
        await supabase
          .from('departments')
          .update({ directorate_id: directorateId })
          .in('id', toLink);
      }

      setIsModalOpen(false);
      setEditingDirectorate(null);
      setFormData({ name: '', director_id: '' });
      setSelectedDeptIds(new Set());
      fetchData();
    } catch (error: any) {
      console.error('Error saving directorate:', error);
      alert('حدث خطأ أثناء الحفظ:\n' + (error?.message || JSON.stringify(error)));
    }
  };

  const openEditModal = (dir: Directorate) => {
    setEditingDirectorate(dir);
    setFormData({ name: dir.name, director_id: dir.director_id || '' });
    setSelectedDeptIds(new Set((dir.departments || []).map(d => d.id)));
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingDirectorate(null);
    setFormData({ name: '', director_id: '' });
    setSelectedDeptIds(new Set());
    setIsModalOpen(true);
  };

  const confirmDelete = (dir: Directorate) => {
    setDeleteTarget(dir);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      // Unlink departments first
      await supabase
        .from('departments')
        .update({ directorate_id: null })
        .eq('directorate_id', deleteTarget.id);

      await supabase
        .from('directorates')
        .delete()
        .eq('id', deleteTarget.id);

      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'حذف إدارة',
          entity_type: 'directorates',
          entity_id: deleteTarget.id,
          details: { name: deleteTarget.name },
        });
      }

      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting directorate:', error);
    } finally {
      setDeleting(false);
    }
  };

  const toggleDeptSelection = (deptId: string) => {
    setSelectedDeptIds(prev => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  };

  // Departments available for assignment: unassigned OR already assigned to editing directorate
  const availableDepts = allDepartments.filter(
    d => !d.directorate_id || d.directorate_id === editingDirectorate?.id
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">إدارة الإدارات</h1>
          <p className="text-gray-600 mt-2">إدارة الإدارات وربط الأقسام بها</p>
        </div>
        <Button onClick={openAddModal} className="flex items-center gap-2">
          <span>إضافة إدارة</span>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <Card>
        <CardBody className="p-0">
          {directorates.length === 0 ? (
            <EmptyState
              message="لا يوجد إدارات مضافة حاليًا"
              icon={<Landmark className="h-12 w-12 text-gray-400" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم الإدارة</TableHead>
                  <TableHead>مدير الإدارة</TableHead>
                  <TableHead>عدد الأقسام</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directorates.map((dir) => (
                  <React.Fragment key={dir.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedId(expandedId === dir.id ? null : dir.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {expandedId === dir.id ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="font-medium">{dir.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {dir.director?.full_name ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-purple-700">
                                {dir.director.full_name.charAt(0)}
                              </span>
                            </div>
                            <span className="font-medium">{dir.director.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">غير محدد</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{dir.departments?.length || 0}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(dir)}
                            className="flex items-center gap-1"
                          >
                            <Edit className="h-4 w-4" />
                            <span>تعديل</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => confirmDelete(dir)}
                            className="flex items-center gap-1"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>حذف</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === dir.id && (dir.departments?.length || 0) > 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="bg-gray-50 px-8 py-3">
                          <p className="text-sm font-medium text-gray-500 mb-2">الأقسام التابعة:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {dir.departments!.map((dept: any) => (
                              <div
                                key={dept.id}
                                className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200"
                              >
                                <Building2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                <div>
                                  <span className="text-sm font-medium text-gray-800">{dept.name}</span>
                                  {dept.manager?.full_name && (
                                    <span className="text-xs text-gray-500 block">
                                      مدير: {dept.manager.full_name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {expandedId === dir.id && (dir.departments?.length || 0) === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="bg-gray-50 px-8 py-3">
                          <p className="text-sm text-gray-400">لا توجد أقسام تابعة لهذه الإدارة</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDirectorate ? 'تعديل الإدارة' : 'إضافة إدارة جديدة'}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                اسم الإدارة <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="مثال: إدارة التقنية"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                مدير الإدارة <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.director_id}
                onChange={(e) => setFormData({ ...formData, director_id: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- اختر مدير الإدارة --</option>
                {availableDirectors
                  .filter(d => d.id === formData.director_id || !directorates.some(dir => dir.director_id === d.id && dir.id !== editingDirectorate?.id))
                  .map((dir) => (
                    <option key={dir.id} value={dir.id}>
                      {dir.full_name} ({dir.email})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الأقسام التابعة
              </label>
              {availableDepts.length === 0 ? (
                <p className="text-sm text-gray-400">لا توجد أقسام متاحة للربط</p>
              ) : (
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                  {availableDepts.map((dept) => (
                    <label
                      key={dept.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDeptIds.has(dept.id)}
                        onChange={() => toggleDeptSelection(dept.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-800">{dept.name}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {selectedDeptIds.size > 0
                  ? `تم اختيار ${selectedDeptIds.size} قسم`
                  : 'لم يتم اختيار أي قسم'}
              </p>
            </div>
          </div>

          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit">
              {editingDirectorate ? 'تحديث' : 'إضافة'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete confirmation */}
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
            هل أنت متأكد من حذف الإدارة؟
          </p>
          <p className="text-gray-500 text-sm">
            سيتم حذف إدارة <span className="font-bold text-gray-700">{deleteTarget?.name}</span> نهائيًا.
            {(deleteTarget?.departments?.length ?? 0) > 0 && (
              <span className="block mt-1 text-amber-600">
                سيتم فك ربط {deleteTarget?.departments?.length} قسم من هذه الإدارة
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
              <span>حذف الإدارة</span>
            </span>
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};
