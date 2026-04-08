import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { UserPlus, CheckCircle, AlertCircle } from 'lucide-react';

interface DirectorateOption {
  id: string;
  name: string;
}

export const RegisterUser: React.FC = () => {
  const [directorates, setDirectorates] = useState<DirectorateOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [form, setForm] = useState({
    email: '',
    full_name: '',
    role: 'employee',
    job_title: '',
    directorate_id: '',
    phone: '',
    employee_number: '',
  });

  useEffect(() => {
    fetchDirectorates();
  }, []);

  const fetchDirectorates = async () => {
    const { data } = await supabase
      .from('directorates')
      .select('id, name')
      .order('name');
    if (data) setDirectorates(data);
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
          password: '12345678',
          full_name: form.full_name,
          role: form.role,
          job_title: form.job_title || undefined,
          directorate_id: form.directorate_id || undefined,
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
        full_name: '',
        role: 'employee',
        job_title: '',
        directorate_id: '',
        phone: '',
        employee_number: '',
      });
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
        <h1 className="text-2xl font-bold text-gray-900">تسجيل المستخدمين</h1>
        <p className="text-gray-600 mt-1">إنشاء حسابات جديدة للموظفين والمدراء</p>
      </div>

      <div className="max-w-xl">
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

                  <Select
                    label="الإدارة"
                    name="directorate_id"
                    value={form.directorate_id}
                    onChange={handleChange}
                    options={[
                      { value: '', label: '-- اختر الإدارة --' },
                      ...directorates.map(d => ({ value: d.id, label: d.name })),
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
    </div>
  );
};
