import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { UserPlus, CheckCircle, AlertCircle, Plus, X } from 'lucide-react';

interface DirectorateOption {
  id: string;
  name: string;
}

interface DepartmentOption {
  id: string;
  name: string;
  directorate_id: string;
}

interface DirAssignment {
  directorate_id: string;
  department_id: string;
  is_primary: boolean;
}

export const RegisterUser: React.FC = () => {
  const [directorates, setDirectorates] = useState<DirectorateOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [form, setForm] = useState({
    email: '',
    full_name: '',
    role: 'employee',
    job_title: '',
    phone: '',
    employee_number: '',
  });

  const [dirAssignments, setDirAssignments] = useState<DirAssignment[]>([
    { directorate_id: '', department_id: '', is_primary: true }
  ]);

  useEffect(() => {
    fetchDirectorates();
  }, []);

  const fetchDirectorates = async () => {
    const [dirRes, deptRes] = await Promise.all([
      supabase.from('directorates').select('id, name').order('name'),
      supabase.from('departments').select('id, name, directorate_id').eq('status', 'active').order('name'),
    ]);
    if (dirRes.data) setDirectorates(dirRes.data);
    if (deptRes.data) setDepartments(deptRes.data);
  };

  const getFilteredDepts = (directorateId: string) => {
    return departments.filter(d => d.directorate_id === directorateId);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const addDirAssignment = () => {
    setDirAssignments(prev => [...prev, { directorate_id: '', department_id: '', is_primary: false }]);
  };

  const removeDirAssignment = (index: number) => {
    setDirAssignments(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some(a => a.is_primary)) {
        next[0].is_primary = true;
      }
      return next.length > 0 ? next : [{ directorate_id: '', department_id: '', is_primary: true }];
    });
  };

  const updateDirAssignment = (index: number, field: string, value: string | boolean) => {
    setDirAssignments(prev => {
      const next = [...prev];
      if (field === 'is_primary' && value === true) {
        next.forEach((a, i) => { a.is_primary = i === index; });
      } else if (field === 'directorate_id') {
        next[index] = { ...next[index], directorate_id: value as string, department_id: '' };
      } else {
        next[index] = { ...next[index], [field]: value };
      }
      return next;
    });
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

      const primary = dirAssignments.find(a => a.is_primary) || dirAssignments[0];
      const validAssignments = dirAssignments.filter(a => a.directorate_id);

      // Enforce: when a chosen directorate has any departments, the assignment
      // must include a department.
      for (const a of validAssignments) {
        const dirDepts = getFilteredDepts(a.directorate_id);
        if (dirDepts.length > 0 && !a.department_id) {
          const dir = directorates.find(d => d.id === a.directorate_id);
          setFeedback({ type: 'error', message: `الإدارة "${dir?.name || ''}" تحتوي على أقسام — يجب اختيار قسم للموظف.` });
          setLoading(false);
          return;
        }
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
          password: '12345678',
          full_name: form.full_name,
          role: form.role,
          job_title: form.job_title || undefined,
          directorate_id: primary?.directorate_id || undefined,
          department_id: primary?.department_id || undefined,
          phone: form.phone || undefined,
          employee_number: form.employee_number || undefined,
          dir_assignments: validAssignments.length > 0 ? validAssignments : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل في إنشاء المستخدم');
      }

      setFeedback({ type: 'success', message: `تم إنشاء حساب ${form.full_name} بنجاح` });
      setForm({
        email: '',
        full_name: '',
        role: 'employee',
        job_title: '',
        phone: '',
        employee_number: '',
      });
      setDirAssignments([{ directorate_id: '', department_id: '', is_primary: true }]);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'حدث خطأ غير متوقع',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ds-text">تسجيل المستخدمين</h1>
        <p className="text-ds-muted mt-1">إنشاء حسابات جديدة للموظفين والمدراء</p>
      </div>

      <div className="max-w-xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ds-text">مستخدم جديد</h2>
                <p className="text-sm text-ds-faint">أدخل بيانات المستخدم</p>
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

              <Select
                label="الدور"
                name="role"
                value={form.role}
                onChange={handleChange}
                options={[
                  { value: 'employee', label: 'موظف' },
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

                  {/* Multi-directorate assignments */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-ds-text">الإدارات والأقسام</h3>
                      <button
                        type="button"
                        onClick={addDirAssignment}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        إضافة إدارة أخرى
                      </button>
                    </div>

                    <div className="space-y-3">
                      {dirAssignments.map((assignment, index) => {
                        const filteredDepts = getFilteredDepts(assignment.directorate_id);
                        return (
                          <div key={index} className={`p-3 rounded-lg border ${assignment.is_primary ? 'border-purple-200 bg-purple-50/50' : 'border-ds-border bg-ds-bg/50'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name="primary_dir_reg"
                                  checked={assignment.is_primary}
                                  onChange={() => updateDirAssignment(index, 'is_primary', true)}
                                  className="w-3.5 h-3.5 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-xs text-ds-muted">
                                  {assignment.is_primary ? (
                                    <span className="text-purple-700 font-medium">الإدارة الرئيسية</span>
                                  ) : 'تعيين كرئيسية'}
                                </span>
                              </label>
                              {dirAssignments.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeDirAssignment(index)}
                                  className="text-red-400 hover:text-red-600 p-0.5"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <Select
                                label="الإدارة"
                                name={`directorate_${index}`}
                                value={assignment.directorate_id}
                                onChange={(e) => updateDirAssignment(index, 'directorate_id', e.target.value)}
                                options={[
                                  { value: '', label: '-- اختر الإدارة --' },
                                  ...directorates.map(d => ({ value: d.id, label: d.name })),
                                ]}
                              />

                              {filteredDepts.length > 0 && (
                                <Select
                                  label="القسم"
                                  name={`department_${index}`}
                                  value={assignment.department_id}
                                  onChange={(e) => updateDirAssignment(index, 'department_id', e.target.value)}
                                  options={[
                                    { value: '', label: '-- اختر القسم (اختياري) --' },
                                    ...filteredDepts.map(d => ({ value: d.id, label: d.name })),
                                  ]}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

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
    </div>
  );
};
