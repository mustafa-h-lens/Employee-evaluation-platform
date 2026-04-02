import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal, ModalFooter } from './Modal';
import { Input, Select } from './Input';
import { Button } from './Button';
import { UserPlus, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';

interface Department {
  id: string;
  name: string;
}

interface RegisterUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: 'employee' | 'manager';
  onSuccess: () => void;
}

export const RegisterUserModal: React.FC<RegisterUserModalProps> = ({ isOpen, onClose, role, onSuccess }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    job_title: '',
    department_id: '',
    manager_id: '',
    phone: '',
    employee_number: '',
  });

  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      setForm({ email: '', password: '', full_name: '', job_title: '', department_id: '', manager_id: '', phone: '', employee_number: '' });
      setShowPassword(false);
      if (role === 'employee') {
        fetchDepartments();
        fetchManagers();
      }
    }
  }, [isOpen, role]);

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('id, name').order('name');
    if (data) setDepartments(data);
  };

  const fetchManagers = async () => {
    const { data } = await supabase.from('users').select('id, full_name').eq('role', 'manager').order('full_name');
    if (data) setManagers(data);
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
          role,
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

      onSuccess();
      onClose();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'حدث خطأ غير متوقع',
      });
    } finally {
      setLoading(false);
    }
  };

  const title = role === 'employee' ? 'تسجيل موظف جديد' : 'تسجيل مدير جديد';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
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

      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
        <div className="grid grid-cols-2 gap-4">
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
            name="new-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
            placeholder="example@h-lens.co"
            autoComplete="off"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
            <div className="relative">
              <input
                name="new-password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="أدخل كلمة مرور قوية"
                autoComplete="new-password"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Input
            label="المسمى الوظيفي"
            name="job_title"
            value={form.job_title}
            onChange={handleChange}
            placeholder={role === 'employee' ? 'مثال: مطور برمجيات' : 'مثال: مدير تقنية المعلومات'}
          />

          <Input
            label="الرقم الوظيفي"
            name="employee_number"
            value={form.employee_number}
            onChange={handleChange}
            placeholder={role === 'employee' ? 'مثال: EMP017' : 'مثال: MGR001'}
          />

          {role === 'employee' && (
            <>

              <Input
                label="رقم الجوال"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder="+966501234567"
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
            </>
          )}
        </div>

        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" loading={loading}>
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              <span>إنشاء الحساب</span>
            </span>
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};
