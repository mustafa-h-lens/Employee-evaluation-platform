import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal, ModalFooter } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Users, UserPlus, CreditCard as Edit, Crown, FileCheck, FileClock, AlertTriangle, Trash2 } from 'lucide-react';
import { UserAvatar } from '../../components/ui/UserAvatar';

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
  const [registerForm, setRegisterForm] = useState({
    full_name: '',
    email: '',
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

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Director | null>(null);
  const [deleting, setDeleting] = useState(false);

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
        .eq('status', 'نشطة')
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
          password: '12345678',
          full_name: registerForm.full_name,
          role: 'director',
          job_title: registerForm.job_title || undefined,
          employee_number: registerForm.employee_number || undefined,
        }),
      });

      let result: any = {};
      try { result = await response.json(); } catch { /* non-JSON body */ }

      if (!response.ok) {
        const detail = result?.error || result?.message || `HTTP ${response.status} ${response.statusText || 'Error'}`;
        throw new Error(`فشل في إنشاء المستخدم — ${detail}`);
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
      setRegisterForm({ full_name: '', email: '', job_title: '', employee_number: '' });
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

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
      if (!response.ok) throw new Error(result.error || 'فشل في حذف المستخدم');

      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'حذف مدير إدارة',
          entity_type: 'users',
          entity_id: deleteTarget.id,
          details: { full_name: deleteTarget.full_name, email: deleteTarget.email },
        });
      }

      setDeleteTarget(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting director:', error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="page-loading-placeholder" aria-hidden="true" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-ds-xl p-5 lg:p-8 flex items-center justify-between"
        style={{
          background: 'var(--sc-amber-grad)',
          border: '1px solid var(--sc-amber-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-amber-val)' }}>مديري الإدارات</h1>
          <p className="mt-2" style={{ color: 'var(--sc-amber-label)' }}>إدارة وتسجيل مديري الإدارات في المنظمة</p>
        </div>
        <Button onClick={() => { setIsRegisterModalOpen(true); setRegisterFeedback(null); setRegisterForm({ full_name: '', email: '', job_title: '', employee_number: '' }); }} className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          <span>تسجيل مدير إدارة</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-ds-purple-bg flex items-center justify-center flex-shrink-0">
              <Crown className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-ds-faint">إجمالي مديري الإدارات</p>
              <p className="text-2xl font-bold text-ds-text">{totalDirectors}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-ds-success-bg flex items-center justify-center flex-shrink-0">
              <FileCheck className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-ds-faint">مديرون تم تقييمهم</p>
              <p className="text-2xl font-bold text-ds-success-text">{evaluatedCount}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-ds-warning-bg flex items-center justify-center flex-shrink-0">
              <FileClock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-ds-faint">بانتظار التقييم</p>
              <p className="text-2xl font-bold text-ds-warning-text">{pendingCount}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Directors Table */}
      <Card>
        <div className="px-6 py-4 border-b border-ds-border">
          <h2 className="text-lg font-semibold text-ds-text">جميع مديري الإدارات</h2>
        </div>
        <CardBody className="p-0 overflow-x-auto">
          {directors.length === 0 ? (
            <EmptyState
              message="لا يوجد مديري إدارات مسجلين حاليًا"
              icon={<Users className="h-12 w-12 text-ds-faint" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>المسمى الوظيفي</TableHead>
                  <TableHead className="min-w-[180px]">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directors.map((director) => {
                  const evaluation = getEvaluation(director.id);
                  return (
                    <TableRow key={director.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar name={director.full_name} avatarUrl={(director as any).avatar_url} size="sm" />
                          <span className="font-medium">{director.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-ds-muted">{director.email}</span>
                      </TableCell>
                      <TableCell>
                        {director.job_title ? (
                          <span className="text-sm text-ds-muted">{director.job_title}</span>
                        ) : (
                          <span className="text-ds-faint">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(director)}
                            className="flex items-center gap-1"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span>تعديل</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setDeleteTarget(director)}
                            className="flex items-center gap-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>حذف</span>
                          </Button>
                        </div>
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
              ? 'bg-ds-success-bg border border-ds-success-border text-ds-success-text'
              : 'bg-ds-danger-bg border border-ds-danger-border text-ds-danger-text'
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="تأكيد حذف مدير الإدارة"
        size="sm"
      >
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-ds-danger-bg flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <p className="text-ds-muted">
            هل أنت متأكد من حذف <span className="font-bold text-ds-text">{deleteTarget?.full_name}</span>؟
          </p>
          <p className="text-sm text-red-600">
            سيتم حذف الحساب نهائيًا ولا يمكن التراجع عن هذا الإجراء.
          </p>
        </div>
        <ModalFooter className="justify-center">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            إلغاء
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            <span className="flex items-center gap-1">
              <Trash2 className="h-4 w-4" />
              <span>حذف نهائي</span>
            </span>
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Director Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="تعديل بيانات مدير الإدارة"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ds-muted mb-1">الاسم الكامل</label>
            <Input
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              placeholder="الاسم الكامل"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ds-muted mb-1">البريد الإلكتروني</label>
            <Input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="البريد الإلكتروني"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ds-muted mb-1">المسمى الوظيفي</label>
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
