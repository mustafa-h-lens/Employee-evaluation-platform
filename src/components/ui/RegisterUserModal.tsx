import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal, ModalFooter } from './Modal';
import { Input, Select } from './Input';
import { Button } from './Button';
import { UserPlus, CheckCircle, AlertCircle } from 'lucide-react';

interface DirectorateOption {
  id: string;
  name: string;
}

interface DepartmentOption {
  id: string;
  name: string;
  directorate_id: string;
}

interface RegisterUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: 'employee';
  onSuccess: () => void;
}

export const RegisterUserModal: React.FC<RegisterUserModalProps> = ({ isOpen, onClose, role, onSuccess }) => {
  const [directorates, setDirectorates] = useState<DirectorateOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [form, setForm] = useState({
    email: '',
    full_name: '',
    job_title: '',
    directorate_id: '',
    department_id: '',
    phone: '',
    employee_number: '',
  });

  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      setForm({ email: '', full_name: '', job_title: '', directorate_id: '', department_id: '', phone: '', employee_number: '' });
      if (role === 'employee') {
        fetchDirectorates();
      }
    }
  }, [isOpen, role]);

  const fetchDirectorates = async () => {
    const [dirRes, deptRes] = await Promise.all([
      supabase.from('directorates').select('id, name').order('name'),
      supabase.from('departments').select('id, name, directorate_id').eq('status', 'active').order('name'),
    ]);
    if (dirRes.data) setDirectorates(dirRes.data);
    if (deptRes.data) setDepartments(deptRes.data);
  };

  const filteredDepartments = departments.filter(d => d.directorate_id === form.directorate_id);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'directorate_id') {
      setForm(prev => ({ ...prev, directorate_id: value, department_id: '' }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
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
          role,
          job_title: form.job_title || undefined,
          directorate_id: form.directorate_id || undefined,
          department_id: form.department_id || undefined,
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

  const title = 'تسجيل موظف جديد';

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

          <Input
            label="المسمى الوظيفي"
            name="job_title"
            value={form.job_title}
            onChange={handleChange}
            placeholder="مثال: مطور برمجيات"
          />

          <Input
            label="الرقم الوظيفي"
            name="employee_number"
            value={form.employee_number}
            onChange={handleChange}
            placeholder="مثال: EMP017"
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
                label="الإدارة"
                name="directorate_id"
                value={form.directorate_id}
                onChange={handleChange}
                options={[
                  { value: '', label: '-- اختر الإدارة --' },
                  ...directorates.map(d => ({ value: d.id, label: d.name })),
                ]}
              />

              {filteredDepartments.length > 0 && (
                <Select
                  label="القسم"
                  name="department_id"
                  value={form.department_id}
                  onChange={handleChange}
                  options={[
                    { value: '', label: '-- اختر القسم (اختياري) --' },
                    ...filteredDepartments.map(d => ({ value: d.id, label: d.name })),
                  ]}
                />
              )}
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
