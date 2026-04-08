import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Modal, ModalFooter } from '../../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import {
  Plus, CreditCard as Edit, Trash2, Landmark, AlertTriangle,
  ChevronDown, ChevronUp, UserPlus, Crown, Users, ArrowLeftRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface DirectorUser {
  id: string;
  full_name: string;
  email: string;
  job_title?: string;
}

interface EmployeeBasic {
  id: string;
  full_name: string;
  job_title: string;
}

interface Directorate {
  id: string;
  name: string;
  director_id: string | null;
  secondary_director_id: string | null;
  director?: { full_name: string };
  secondary_director?: { full_name: string };
  employees?: EmployeeBasic[];
}

const CEO_EMAILS = ['ahmed@h-lens.co', 'saad@h-lens.co'];

export const Directorates: React.FC = () => {
  const { user } = useAuth();
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [allDirectors, setAllDirectors] = useState<DirectorUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Directorate modal
  const [isDirModalOpen, setIsDirModalOpen] = useState(false);
  const [editingDir, setEditingDir] = useState<Directorate | null>(null);
  const [dirForm, setDirForm] = useState({ name: '', director_id: '', secondary_director_id: '' });

  // Register director modal
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [registerForm, setRegisterForm] = useState({ full_name: '', email: '', job_title: '', employee_number: '' });
  const [registerFeedback, setRegisterFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit director modal
  const [isEditDirOpen, setIsEditDirOpen] = useState(false);
  const [editingDirector, setEditingDirector] = useState<DirectorUser | null>(null);
  const [editDirForm, setEditDirForm] = useState({ full_name: '', email: '', job_title: '' });

  // Delete modals
  const [deleteDir, setDeleteDir] = useState<Directorate | null>(null);
  const [deleteDirector, setDeleteDirector] = useState<DirectorUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Switch director modal
  const [switchTarget, setSwitchTarget] = useState<Directorate | null>(null);
  const [switchDirectorId, setSwitchDirectorId] = useState('');
  const [switchSecondaryId, setSwitchSecondaryId] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [dirResult, directorsResult, ceoResult, empsResult] = await Promise.all([
        supabase.from('directorates').select('id, name, director_id, secondary_director_id, director:users!directorates_director_id_fkey(full_name), secondary_director:users!directorates_secondary_director_id_fkey(full_name)').order('name'),
        supabase.from('users').select('id, full_name, email, job_title').eq('role', 'director').order('full_name'),
        supabase.from('users').select('id, full_name, email, job_title').eq('role', 'ceo').order('full_name'),
        supabase.from('employees').select('id, full_name, job_title, directorate_id').order('full_name'),
      ]);

      // Combine directors and CEOs, CEOs first
      const combined = [...(ceoResult.data || []), ...(directorsResult.data || [])];
      setAllDirectors(combined);
      const emps = (empsResult.data || []) as any[];

      if (dirResult.data) {
        setDirectorates(dirResult.data.map((dir: any) => ({
          ...dir,
          employees: emps.filter((e: any) => e.directorate_id === dir.id),
        })));
      }
    } catch (error) {
      console.error('Error fetching:', error);
    } finally {
      setLoading(false);
    }
  };

  // ─── Directorate CRUD ──────────────────────────────

  const handleDirSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { name: dirForm.name, director_id: dirForm.director_id || null, secondary_director_id: dirForm.secondary_director_id || null };

      if (editingDir) {
        await supabase.from('directorates').update(payload).eq('id', editingDir.id);
        if (user) await supabase.from('audit_logs').insert({ user_id: user.id, action: 'تحديث إدارة', entity_type: 'directorates', entity_id: editingDir.id, details: payload });
      } else {
        const { data } = await supabase.from('directorates').insert(payload).select().single();
        if (user && data) await supabase.from('audit_logs').insert({ user_id: user.id, action: 'إضافة إدارة', entity_type: 'directorates', entity_id: data.id, details: payload });
      }

      setIsDirModalOpen(false);
      setEditingDir(null);
      setDirForm({ name: '', director_id: '', secondary_director_id: '' });
      fetchData();
    } catch (error: any) {
      alert('حدث خطأ: ' + (error?.message || ''));
    }
  };

  const handleDeleteDir = async () => {
    if (!deleteDir) return;
    setDeleting(true);
    try {
      await supabase.from('employees').update({ directorate_id: null }).eq('directorate_id', deleteDir.id);
      await supabase.from('directorates').delete().eq('id', deleteDir.id);
      if (user) await supabase.from('audit_logs').insert({ user_id: user.id, action: 'حذف إدارة', entity_type: 'directorates', entity_id: deleteDir.id, details: { name: deleteDir.name } });
      setDeleteDir(null);
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  // ─── Switch Director ───────────────────────────────

  const handleSwitchDirector = async () => {
    if (!switchTarget) return;
    setSaving(true);
    try {
      await supabase.from('directorates').update({
        director_id: switchDirectorId || null,
        secondary_director_id: switchSecondaryId || null,
      }).eq('id', switchTarget.id);
      if (user) await supabase.from('audit_logs').insert({ user_id: user.id, action: 'تغيير مدير إدارة', entity_type: 'directorates', entity_id: switchTarget.id, details: { new_director_id: switchDirectorId || null, new_secondary_director_id: switchSecondaryId || null } });
      setSwitchTarget(null);
      setSwitchDirectorId('');
      setSwitchSecondaryId('');
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  // ─── Director CRUD ─────────────────────────────────

  const handleRegisterDirector = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setRegisterFeedback(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setRegisterFeedback({ type: 'error', message: 'الجلسة منتهية' }); return; }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users?action=create-user`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...registerForm, password: '12345678', role: 'director' }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'فشل في إنشاء المستخدم');

      if (user) await supabase.from('audit_logs').insert({ user_id: user.id, action: 'تسجيل مدير إدارة', entity_type: 'users', entity_id: result.user?.id, details: { full_name: registerForm.full_name } });

      setIsRegisterOpen(false);
      setRegisterForm({ full_name: '', email: '', job_title: '', employee_number: '' });
      fetchData();
    } catch (err) {
      setRegisterFeedback({ type: 'error', message: err instanceof Error ? err.message : 'حدث خطأ' });
    } finally {
      setSaving(false);
    }
  };

  const handleEditDirector = async () => {
    if (!editingDirector) return;
    setSaving(true);
    try {
      await supabase.from('users').update({ full_name: editDirForm.full_name, email: editDirForm.email, job_title: editDirForm.job_title }).eq('id', editingDirector.id);
      if (user) await supabase.from('audit_logs').insert({ user_id: user.id, action: 'تعديل مدير إدارة', entity_type: 'users', entity_id: editingDirector.id, details: editDirForm });
      setIsEditDirOpen(false);
      setEditingDirector(null);
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDirector = async () => {
    if (!deleteDirector) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users?action=delete-user`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: deleteDirector.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (user) await supabase.from('audit_logs').insert({ user_id: user.id, action: 'حذف مدير إدارة', entity_type: 'users', entity_id: deleteDirector.id, details: { full_name: deleteDirector.full_name } });
      setDeleteDirector(null);
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  // ─── Helpers ───────────────────────────────────────

  const isCeoUser = (email: string) => CEO_EMAILS.includes(email);
  const unassignedDirectors = allDirectors.filter(d => isCeoUser(d.email) || !directorates.some(dir => dir.director_id === d.id || dir.secondary_director_id === d.id));
  const getDirectorateNames = (directorId: string) => directorates.filter(d => d.director_id === directorId || d.secondary_director_id === directorId).map(d => d.name);

  if (loading) return <div className="flex items-center justify-center h-64">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">الإدارات</h1>
          <p className="text-gray-600 mt-2">إدارة الإدارات والمديرين وتعيين الموظفين</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { setIsRegisterOpen(true); setRegisterFeedback(null); setShowPassword(false); }} variant="outline" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            <span>تسجيل مدير جديد</span>
          </Button>
          <Button onClick={() => { setEditingDir(null); setDirForm({ name: '', director_id: '', secondary_director_id: '' }); setIsDirModalOpen(true); }} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span>إضافة إدارة</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center"><Landmark className="h-6 w-6 text-blue-600" /></div>
            <div><p className="text-sm text-gray-500">إجمالي الإدارات</p><p className="text-2xl font-bold text-gray-900">{directorates.length}</p></div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center"><Crown className="h-6 w-6 text-purple-600" /></div>
            <div><p className="text-sm text-gray-500">مديري الإدارات</p><p className="text-2xl font-bold text-gray-900">{allDirectors.length}</p></div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center"><Users className="h-6 w-6 text-green-600" /></div>
            <div><p className="text-sm text-gray-500">إجمالي الموظفين</p><p className="text-2xl font-bold text-gray-900">{directorates.reduce((sum, d) => sum + (d.employees?.length || 0), 0)}</p></div>
          </CardBody>
        </Card>
      </div>

      {/* Directorates Table */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">الإدارات والمديرون</h2>
        </div>
        <CardBody className="p-0">
          {directorates.length === 0 ? (
            <EmptyState message="لا يوجد إدارات" icon={<Landmark className="h-12 w-12 text-gray-400" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم الإدارة</TableHead>
                  <TableHead>مدير الإدارة</TableHead>
                  <TableHead>عدد الموظفين</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directorates.map((dir) => (
                  <React.Fragment key={dir.id}>
                    <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => setExpandedId(expandedId === dir.id ? null : dir.id)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {expandedId === dir.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                          <span className="font-medium">{dir.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {dir.director?.full_name || dir.secondary_director?.full_name ? (
                          <div className="flex flex-col gap-1">
                            {dir.director?.full_name && (
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-bold text-purple-700">{dir.director.full_name.charAt(0)}</span>
                                </div>
                                <span className="font-medium">{dir.director.full_name}</span>
                              </div>
                            )}
                            {dir.secondary_director?.full_name && (
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-bold text-amber-700">{dir.secondary_director.full_name.charAt(0)}</span>
                                </div>
                                <span className="font-medium text-gray-600">{dir.secondary_director.full_name}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge variant="warning">غير معين</Badge>
                        )}
                      </TableCell>
                      <TableCell><span className="font-medium">{dir.employees?.length || 0}</span></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="outline" onClick={() => { setSwitchTarget(dir); setSwitchDirectorId(dir.director_id || ''); setSwitchSecondaryId(dir.secondary_director_id || ''); }} className="flex items-center gap-1">
                            <ArrowLeftRight className="h-3.5 w-3.5" /><span>تغيير المدير</span>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingDir(dir); setDirForm({ name: dir.name, director_id: dir.director_id || '', secondary_director_id: dir.secondary_director_id || '' }); setIsDirModalOpen(true); }} className="flex items-center gap-1">
                            <Edit className="h-3.5 w-3.5" /><span>تعديل</span>
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setDeleteDir(dir)} className="flex items-center gap-1">
                            <Trash2 className="h-3.5 w-3.5" /><span>حذف</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === dir.id && (
                      <TableRow>
                        <TableCell colSpan={4} className="bg-gray-50 px-8 py-3">
                          {(dir.employees?.length || 0) > 0 ? (
                            <>
                              <p className="text-sm font-medium text-gray-500 mb-2">الموظفون ({dir.employees!.length}):</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {dir.employees!.map((emp) => (
                                  <div key={emp.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200">
                                    <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                                      <span className="text-xs font-bold text-blue-700">{emp.full_name.charAt(0)}</span>
                                    </div>
                                    <div>
                                      <span className="text-sm font-medium text-gray-800">{emp.full_name}</span>
                                      <span className="text-xs text-gray-500 block">{emp.job_title}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-gray-400">لا يوجد موظفون تابعون لهذه الإدارة</p>
                          )}
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

      {/* Directors List */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">مديري الإدارات</h2>
        </div>
        <CardBody className="p-0">
          {allDirectors.length === 0 ? (
            <EmptyState message="لا يوجد مديري إدارات" icon={<Crown className="h-12 w-12 text-gray-400" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>المسمى الوظيفي</TableHead>
                  <TableHead>الإدارة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allDirectors.map((director) => {
                  const dirNames = getDirectorateNames(director.id);
                  const isCeo = isCeoUser(director.email);
                  return (
                    <TableRow key={director.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isCeo ? 'bg-amber-100' : 'bg-purple-100'}`}>
                            <span className={`text-sm font-bold ${isCeo ? 'text-amber-700' : 'text-purple-700'}`}>{director.full_name.charAt(0)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{director.full_name}</span>
                            {isCeo && <Badge variant="warning" size="sm">إدارة عليا</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><span className="text-sm text-gray-600">{director.email}</span></TableCell>
                      <TableCell>{director.job_title || <span className="text-gray-400">--</span>}</TableCell>
                      <TableCell>
                        {dirNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {dirNames.map((name, i) => <Badge key={i} variant="info">{name}</Badge>)}
                          </div>
                        ) : <span className="text-gray-400">غير معين</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" onClick={() => { setEditingDirector(director); setEditDirForm({ full_name: director.full_name, email: director.email, job_title: director.job_title || '' }); setIsEditDirOpen(true); }} className="flex items-center gap-1">
                            <Edit className="h-3.5 w-3.5" /><span>تعديل</span>
                          </Button>
                          {!isCeo && (
                            <Button size="sm" variant="danger" onClick={() => setDeleteDirector(director)} className="flex items-center gap-1">
                              <Trash2 className="h-3.5 w-3.5" /><span>حذف</span>
                            </Button>
                          )}
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

      {/* ─── Add/Edit Directorate Modal ──────── */}
      <Modal isOpen={isDirModalOpen} onClose={() => setIsDirModalOpen(false)} title={editingDir ? 'تعديل الإدارة' : 'إضافة إدارة جديدة'}>
        <form onSubmit={handleDirSubmit} className="space-y-4">
          <Input label="اسم الإدارة" value={dirForm.name} onChange={(e) => setDirForm({ ...dirForm, name: e.target.value })} required placeholder="مثال: إدارة التقنية" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">المدير الأساسي</label>
            <select value={dirForm.director_id} onChange={(e) => setDirForm({ ...dirForm, director_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="">-- بدون مدير --</option>
              {allDirectors.filter(d => d.id === dirForm.director_id || isCeoUser(d.email) || !directorates.some(dir => (dir.director_id === d.id || dir.secondary_director_id === d.id) && dir.id !== editingDir?.id)).map((d) => (
                <option key={d.id} value={d.id}>{d.full_name} ({d.email}){isCeoUser(d.email) ? ' — إدارة عليا' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">المدير المشارك <span className="text-gray-400 text-xs">(اختياري)</span></label>
            <select value={dirForm.secondary_director_id} onChange={(e) => setDirForm({ ...dirForm, secondary_director_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="">-- بدون مدير مشارك --</option>
              {allDirectors.filter(d => d.id !== dirForm.director_id && (d.id === dirForm.secondary_director_id || isCeoUser(d.email) || !directorates.some(dir => (dir.director_id === d.id || dir.secondary_director_id === d.id) && dir.id !== editingDir?.id))).map((d) => (
                <option key={d.id} value={d.id}>{d.full_name} ({d.email}){isCeoUser(d.email) ? ' — إدارة عليا' : ''}</option>
              ))}
            </select>
          </div>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsDirModalOpen(false)}>إلغاء</Button>
            <Button type="submit">{editingDir ? 'تحديث' : 'إضافة'}</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ─── Switch Director Modal ──────────── */}
      <Modal isOpen={!!switchTarget} onClose={() => setSwitchTarget(null)} title={`تغيير مدير: ${switchTarget?.name || ''}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">المدير الأساسي</label>
            <select value={switchDirectorId} onChange={(e) => setSwitchDirectorId(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="">-- بدون مدير --</option>
              {allDirectors.filter(d => d.id === switchDirectorId || isCeoUser(d.email) || !directorates.some(dir => (dir.director_id === d.id || dir.secondary_director_id === d.id) && dir.id !== switchTarget?.id)).map((d) => (
                <option key={d.id} value={d.id}>{d.full_name} ({d.email}){isCeoUser(d.email) ? ' — إدارة عليا' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">المدير المشارك <span className="text-gray-400 text-xs">(اختياري)</span></label>
            <select value={switchSecondaryId} onChange={(e) => setSwitchSecondaryId(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="">-- بدون مدير مشارك --</option>
              {allDirectors.filter(d => d.id !== switchDirectorId && (d.id === switchSecondaryId || isCeoUser(d.email) || !directorates.some(dir => (dir.director_id === d.id || dir.secondary_director_id === d.id) && dir.id !== switchTarget?.id))).map((d) => (
                <option key={d.id} value={d.id}>{d.full_name} ({d.email}){isCeoUser(d.email) ? ' — إدارة عليا' : ''}</option>
              ))}
            </select>
          </div>
          {switchTarget?.director?.full_name && switchDirectorId !== switchTarget?.director_id && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
              سيتم استبدال <span className="font-bold">{switchTarget.director.full_name}</span> بالمدير الجديد
            </div>
          )}
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setSwitchTarget(null)}>إلغاء</Button>
          <Button onClick={handleSwitchDirector} loading={saving}>
            <span className="flex items-center gap-1"><ArrowLeftRight className="h-4 w-4" /><span>تأكيد التغيير</span></span>
          </Button>
        </ModalFooter>
      </Modal>

      {/* ─── Register Director Modal ─────────── */}
      <Modal isOpen={isRegisterOpen} onClose={() => setIsRegisterOpen(false)} title="تسجيل مدير إدارة جديد" size="lg">
        {registerFeedback && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${registerFeedback.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
            {registerFeedback.type === 'error' && <AlertTriangle className="h-4 w-4 flex-shrink-0" />}
            <span>{registerFeedback.message}</span>
          </div>
        )}
        <form onSubmit={handleRegisterDirector} className="space-y-4" autoComplete="off">
          <div className="grid grid-cols-2 gap-4">
            <Input label="الاسم الكامل" name="full_name" value={registerForm.full_name} onChange={(e) => setRegisterForm(prev => ({ ...prev, full_name: e.target.value }))} required placeholder="أحمد محمد" />
            <Input label="البريد الإلكتروني" name="new-email" type="email" value={registerForm.email} onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))} autoComplete="off" required placeholder="example@h-lens.co" />
            <Input label="المسمى الوظيفي" value={registerForm.job_title} onChange={(e) => setRegisterForm(prev => ({ ...prev, job_title: e.target.value }))} placeholder="مدير إدارة التقنية" />
            <Input label="الرقم الوظيفي" value={registerForm.employee_number} onChange={(e) => setRegisterForm(prev => ({ ...prev, employee_number: e.target.value }))} placeholder="DIR001" />
          </div>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsRegisterOpen(false)}>إلغاء</Button>
            <Button type="submit" loading={saving}><span className="flex items-center gap-1"><UserPlus className="h-4 w-4" /><span>إنشاء الحساب</span></span></Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ─── Edit Director Modal ─────────────── */}
      <Modal isOpen={isEditDirOpen} onClose={() => setIsEditDirOpen(false)} title="تعديل بيانات المدير">
        <div className="space-y-4">
          <Input label="الاسم الكامل" value={editDirForm.full_name} onChange={(e) => setEditDirForm(prev => ({ ...prev, full_name: e.target.value }))} />
          <Input label="البريد الإلكتروني" type="email" value={editDirForm.email} onChange={(e) => setEditDirForm(prev => ({ ...prev, email: e.target.value }))} />
          <Input label="المسمى الوظيفي" value={editDirForm.job_title} onChange={(e) => setEditDirForm(prev => ({ ...prev, job_title: e.target.value }))} />
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setIsEditDirOpen(false)}>إلغاء</Button>
          <Button onClick={handleEditDirector} loading={saving} disabled={!editDirForm.full_name.trim()}>حفظ</Button>
        </ModalFooter>
      </Modal>

      {/* ─── Delete Directorate Modal ────────── */}
      <Modal isOpen={!!deleteDir} onClose={() => setDeleteDir(null)} title="تأكيد حذف الإدارة">
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="h-7 w-7 text-red-600" /></div>
          <p className="text-gray-900 font-medium mb-2">هل أنت متأكد من حذف <span className="font-bold">{deleteDir?.name}</span>؟</p>
          {(deleteDir?.employees?.length ?? 0) > 0 && <p className="text-sm text-amber-600">سيتم فك ربط {deleteDir?.employees?.length} موظف</p>}
        </div>
        <ModalFooter className="justify-center">
          <Button variant="secondary" onClick={() => setDeleteDir(null)}>إلغاء</Button>
          <Button variant="danger" onClick={handleDeleteDir} loading={deleting}><span className="flex items-center gap-1"><Trash2 className="h-4 w-4" /><span>حذف</span></span></Button>
        </ModalFooter>
      </Modal>

      {/* ─── Delete Director Modal ───────────── */}
      <Modal isOpen={!!deleteDirector} onClose={() => setDeleteDirector(null)} title="تأكيد حذف المدير">
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="h-7 w-7 text-red-600" /></div>
          <p className="text-gray-700 mb-2">هل أنت متأكد من حذف <span className="font-bold text-gray-900">{deleteDirector?.full_name}</span>؟</p>
          <p className="text-sm text-red-600">سيتم حذف الحساب نهائيًا.</p>
        </div>
        <ModalFooter className="justify-center">
          <Button variant="secondary" onClick={() => setDeleteDirector(null)}>إلغاء</Button>
          <Button variant="danger" onClick={handleDeleteDirector} loading={deleting}><span className="flex items-center gap-1"><Trash2 className="h-4 w-4" /><span>حذف نهائي</span></span></Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};
