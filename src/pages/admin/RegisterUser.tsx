import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { UserPlus, Users, Eye, EyeOff, CheckCircle, AlertCircle, Trash2, AlertTriangle } from 'lucide-react';
import { Modal, ModalFooter } from '../../components/ui/Modal';

interface Department {
  id: string;
  name: string;
  manager_id: string | null;
}

interface UserRecord {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
}

export const RegisterUser: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<{ id: string; full_name: string }[]>([]);
  const [recentUsers, setRecentUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'employee',
    job_title: '',
    department_id: '',
    manager_id: '',
    phone: '',
    employee_number: '',
  });

  useEffect(() => {
    fetchDepartments();
    fetchManagers();
    fetchRecentUsers();
  }, []);

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('id, name, manager_id')
      .order('name');
    if (data) setDepartments(data);
  };

  const fetchManagers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('role', 'manager')
      .order('full_name');
    if (data) setManagers(data);
  };

  const fetchRecentUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, email, full_name, role, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setRecentUsers(data);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setFeedback({ type: 'error', message: 'الجلسة منتهية، يرجى تسجيل الدخول مجددًا' });
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users?action=create-user`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          role: form.role,
          job_title: form.job_title || undefined,
          department_id: form.department_id || undefined,
          manager_id: form.manager_id || undefined,
          phone: form.phone || undefined,
          employee_number: form.employee_number || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل في إنشاء المستخدم');
      }

      setFeedback({ type: 'success', message: `تم إنشاء حساب ${form.full_name} بنجاح` });
      setForm({
        email: '',
        password: '',
        full_name: '',
        role: 'employee',
        job_title: '',
        department_id: '',
        manager_id: '',
        phone: '',
        employee_number: '',
      });
      fetchRecentUsers();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'حدث خطأ غير متوقع',
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (userRecord: UserRecord) => {
    setDeleteTarget(userRecord);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setFeedback({ type: 'error', message: 'الجلسة منتهية، يرجى تسجيل الدخول مجددًا' });
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users?action=delete-user`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: deleteTarget.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل في حذف المستخدم');
      }

      setFeedback({ type: 'success', message: `تم حذف حساب ${deleteTarget.full_name} بنجاح` });
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      fetchRecentUsers();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'حدث خطأ غير متوقع',
      });
      setIsDeleteModalOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'مدير نظام';
      case 'manager': return 'مدير قسم';
      case 'employee': return 'موظف';
      default: return role;
    }
  };

  const roleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'danger' as const;
      case 'manager': return 'info' as const;
      case 'employee': return 'default' as const;
      default: return 'default' as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">تسجيل المستخدمين</h1>
          <p className="text-gray-600 mt-1">إنشاء حسابات جديدة للموظفين والمدراء</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
          <Users className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">{recentUsers.length} مستخدم مسجل</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <UserPlus className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">مستخدم جديد</h2>
                  <p className="text-sm text-gray-500">أدخل بيانات المستخدم</p>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              {feedback && (
                <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
                  feedback.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {feedback.type === 'success'
                    ? <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    : <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  }
                  <span>{feedback.message}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="الاسم الكامل"
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                  placeholder="مثال: محمد أحمد"
                  required
                />

                <Input
                  label="البريد الإلكتروني"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="example@h-lens.co"
                  required
                />

                <div className="relative">
                  <Input
                    label="كلمة المرور"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="أدخل كلمة مرور قوية"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-8 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword
                      ? <EyeOff className="h-4 w-4" />
                      : <Eye className="h-4 w-4" />
                    }
                  </button>
                </div>

                <Select
                  label="الدور"
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  options={[
                    { value: 'employee', label: 'موظف' },
                    { value: 'manager', label: 'مدير قسم' },
                  ]}
                  required
                />

                <Input
                  label="المسمى الوظيفي"
                  name="job_title"
                  value={form.job_title}
                  onChange={handleChange}
                  placeholder="مثال: مطور برمجيات"
                />

                {form.role === 'employee' && (
                  <>
                    <Input
                      label="الرقم الوظيفي"
                      name="employee_number"
                      value={form.employee_number}
                      onChange={handleChange}
                      placeholder="مثال: EMP017"
                    />

                    <Select
                      label="القسم"
                      name="department_id"
                      value={form.department_id}
                      onChange={handleChange}
                      options={[
                        { value: '', label: '-- اختر القسم --' },
                        ...departments.map(d => ({ value: d.id, label: d.name })),
                      ]}
                    />

                    <Select
                      label="المدير المباشر"
                      name="manager_id"
                      value={form.manager_id}
                      onChange={handleChange}
                      options={[
                        { value: '', label: '-- اختر المدير --' },
                        ...managers.map(m => ({ value: m.id, label: m.full_name })),
                      ]}
                    />

                    <Input
                      label="رقم الجوال"
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="+966501234567"
                    />
                  </>
                )}

                <div className="pt-2">
                  <Button type="submit" fullWidth size="lg" loading={loading}>
                    <span className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5" />
                      <span>إنشاء الحساب</span>
                    </span>
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">آخر المستخدمين المسجلين</h2>
            </CardHeader>
            <CardBody className="p-0">
              {recentUsers.length === 0 ? (
                <EmptyState message="لا يوجد مستخدمين مسجلين بعد" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الإجراءات</TableHead>
                      <TableHead>الاسم</TableHead>
                      <TableHead>البريد الإلكتروني</TableHead>
                      <TableHead>الدور</TableHead>
                      <TableHead>تاريخ التسجيل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentUsers.map(u => (
                      <TableRow key={u.id}>
                        <TableCell>
                          {u.role !== 'admin' ? (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => confirmDelete(u)}
                              className="flex items-center gap-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>حذف</span>
                            </Button>
                          ) : (
                            <span className="text-gray-400 text-xs">--</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{u.full_name}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-gray-600 text-xs">{u.email}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={roleBadgeVariant(u.role)} size="sm">
                            {roleLabel(u.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-gray-500 text-xs">
                            {new Date(u.created_at).toLocaleDateString('ar-SA')}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="تأكيد حذف المستخدم"
      >
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-gray-900 text-lg font-medium mb-2">
            هل أنت متأكد من حذف هذا المستخدم؟
          </p>
          <p className="text-gray-500 text-sm">
            سيتم حذف حساب <span className="font-bold text-gray-700">{deleteTarget?.full_name}</span> ({deleteTarget?.email}) نهائيًا ولا يمكن التراجع عن هذا الإجراء.
          </p>
        </div>
        <ModalFooter className="justify-center">
          <Button type="button" variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
            إلغاء
          </Button>
          <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
            <span className="flex items-center gap-1">
              <Trash2 className="h-4 w-4" />
              <span>حذف المستخدم</span>
            </span>
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};
