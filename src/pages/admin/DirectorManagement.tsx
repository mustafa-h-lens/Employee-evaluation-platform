import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal, ModalFooter } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Users, UserPlus, CreditCard as Edit, Eye, EyeOff, Crown, FileCheck, FileClock, AlertTriangle } from 'lucide-react';

interface Director {
  id: string;
  full_name: string;
  email: string;
  job_title?: string;
  auth_id?: string;
}

interface DirectorEvaluation {
  director_id: string;
  status: string;
  percentage: number | null;
}

export const DirectorManagement: React.FC = () => {
  const [directors, setDirectors] = useState<Director[]>([]);
  const [evaluations, setEvaluations] = useState<DirectorEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Register modal
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    full_name: '',
    email: '',
    password: '',
    job_title: '',
    employee_number: '',
  });
  const [registerFeedback, setRegisterFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDirector, setEditingDirector] = useState<Director | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');

  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch directors
      const { data: directorData } = await supabase
        .from('users')
        .select('id, full_name, email, job_title, auth_id')
        .eq('role', 'director')
        .order('full_name');

      setDirectors(directorData || []);

      // Fetch active evaluation period
      const { data: activePeriod } = await supabase
        .from('evaluation_periods')
        .select('id')
        .eq('status', 'active')
        .maybeSingle();

      if (activePeriod) {
        const { data: evalData } = await supabase
          .from('director_evaluations')
          .select('director_id, status, percentage')
          .eq('period_id', activePeriod.id);

        setEvaluations(evalData || []);
      } else {
        setEvaluations([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEvaluation = (directorId: string): DirectorEvaluation | undefined => {
    return evaluations.find(e => e.director_id === directorId);
  };

  const getStatusBadge = (evaluation?: DirectorEvaluation) => {
    if (!evaluation) {
      return <Badge variant="default">بانتظار التقييم</Badge>;
    }
    switch (evaluation.status) {
      case 'بانتظار الموافقة':
        return <Badge variant="warning">بانتظار اعتماد التقييم</Badge>;
      case 'موافقة':
      case 'تم الإرسال':
      case 'اطلع المدير':
      case 'مغلق':
      case 'مكتمل':
        return <Badge variant="success">تم اعتماد التقييم</Badge>;
      case 'مرفوض':
        return <Badge variant="danger">مرفوض</Badge>;
      case 'مسودة':
      default:
        return <Badge variant="default">بانتظار التقييم</Badge>;
    }
  };

  // Stats
  const totalDirectors = directors.length;
  const evaluatedCount = evaluations.filter(e => e.status !== 'مسودة').length;
  const pendingCount = totalDirectors - evaluatedCount;

  // Register handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setRegisterFeedback(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setRegisterFeedback({ type: 'error', message: 'الجلسة منتهية، يرجى تسجيل الدخول مجددًا' });
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
          email: registerForm.email,
          password: registerForm.password,
          full_name: registerForm.full_name,
          role: 'director',
          job_title: registerForm.job_title || undefined,
          employee_number: registerForm.employee_number || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل في إنشاء المستخدم');
      }

      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'تسجيل مدير إدارة',
          entity_type: 'users',
          entity_id: result.user?.id || null,
          details: { full_name: registerForm.full_name, email: registerForm.email },
        });
      }

      setIsRegisterModalOpen(false);
      setRegisterForm({ full_name: '', email: '', password: '', job_title: '', employee_number: '' });
      fetchData();
    } catch (err) {
      setRegisterFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'حدث خطأ غير متوقع',
      });
    } finally {
      setSaving(false);
    }
  };

  // Edit handlers
  const openEditModal = (director: Director) => {
    setEditingDirector(director);
    setEditFullName(director.full_name);
    setEditEmail(director.email);
    setEditJobTitle(director.job_title || '');
    setIsEditModalOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingDirector) return;
    setSaving(true);

    try {
      await supabase
        .from('users')
        .update({ full_name: editFullName, email: editEmail, job_title: editJobTitle })
        .eq('id', editingDirector.id);

      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'تعديل بيانات مدير إدارة',
          entity_type: 'users',
          entity_id: editingDirector.id,
          details: { full_name: editFullName, email: editEmail, job_title: editJobTitle },
        });
      }

      setIsEditModalOpen(false);
      setEditingDirector(null);
      fetchData();
    } catch (error) {
      console.error('Error updating director:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRegisterForm(prev => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">مديري الإدارات</h1>
          <p className="text-gray-600 mt-2">إدارة وتسجيل مديري الإدارات في المنظمة</p>
        </div>
        <Button onClick={() => { setIsRegisterModalOpen(true); setRegisterFeedback(null); setRegisterForm({ full_name: '', email: '', password: '', job_title: '' }); setShowPassword(false); }} className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          <span>تسجيل مدير إدارة</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
              <Crown className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">إجمالي مديري الإدارات</p>
              <p className="text-2xl font-bold text-gray-900">{totalDirectors}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
              <FileCheck className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">مديرون تم تقييمهم</p>
              <p className="text-2xl font-bold text-green-700">{evaluatedCount}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <FileClock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">بانتظار التقييم</p>
              <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Directors Table */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">جميع مديري الإدارات</h2>
        </div>
        <CardBody className="p-0">
          {directors.length === 0 ? (
            <EmptyState
              message="لا يوجد مديري إدارات مسجلين حاليًا"
              icon={<Users className="h-12 w-12 text-gray-400" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>المسمى الوظيفي</TableHead>
                  <TableHead>حالة التقييم</TableHead>
                  <TableHead>النتيجة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directors.map((director) => {
                  const evaluation = getEvaluation(director.id);
                  return (
                    <TableRow key={director.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-purple-700">
                              {director.full_name.charAt(0)}
                            </span>
                          </div>
                          <span className="font-medium">{director.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">{director.email}</span>
                      </TableCell>
                      <TableCell>
                        {director.job_title ? (
                          <span className="text-sm text-gray-700">{director.job_title}</span>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(evaluation)}
                      </TableCell>
                      <TableCell>
                        {evaluation && evaluation.percentage != null && evaluation.status !== 'مسودة' ? (
                          <span className="font-semibold text-gray-900">{evaluation.percentage.toFixed(1)}%</span>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(director)}
                          className="flex items-center gap-1"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          <span>تعديل</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Register Director Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="تسجيل مدير إدارة"
        size="lg"
      >
        {registerFeedback && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
            registerFeedback.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {registerFeedback.type === 'error' && <AlertTriangle className="h-4 w-4 flex-shrink-0" />}
            <span>{registerFeedback.message}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4" autoComplete="off">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="الاسم الكامل"
              name="full_name"
              value={registerForm.full_name}
              onChange={handleRegisterChange}
              placeholder="مثال: أحمد محمد العلي"
              required
            />

            <Input
              label="البريد الإلكتروني"
              name="new-email"
              type="email"
              value={registerForm.email}
              onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
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
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
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
              value={registerForm.job_title}
              onChange={handleRegisterChange}
              placeholder="مثال: مدير إدارة الموارد البشرية"
            />

            <Input
              label="الرقم الوظيفي"
              name="employee_number"
              value={registerForm.employee_number}
              onChange={handleRegisterChange}
              placeholder="مثال: DIR001"
            />
          </div>

          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsRegisterModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" loading={saving}>
              <span className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                <span>إنشاء الحساب</span>
              </span>
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Edit Director Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="تعديل بيانات مدير الإدارة"
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
              <Edit className="h-4 w-4" />
              <span>حفظ التعديلات</span>
            </span>
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};
