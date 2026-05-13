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
  ChevronDown, ChevronUp, UserPlus, Crown, Users, ArrowLeftRight, Building2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { ModernSelect } from '../../components/ui/ModernSelect';

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
  department_id?: string | null;
}

interface Department {
  id: string;
  name: string;
  directorate_id: string;
  manager_id: string | null;
  status: string;
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
  const toast = useToast();
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [allDirectors, setAllDirectors] = useState<DirectorUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Directorate modal
  const [isDirModalOpen, setIsDirModalOpen] = useState(false);
  const [editingDir, setEditingDir] = useState<Directorate | null>(null);
  const [dirForm, setDirForm] = useState({ name: '', director_id: '', secondary_director_id: '' });
  const [newDeptNames, setNewDeptNames] = useState<string[]>([]);
  const [newDeptInput, setNewDeptInput] = useState('');

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

  // Departments
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptForm, setDeptForm] = useState({ name: '', directorate_id: '' });
  const [deleteDept, setDeleteDept] = useState<Department | null>(null);

  // Switch director modal
  const [switchTarget, setSwitchTarget] = useState<Directorate | null>(null);
  const [switchDirectorId, setSwitchDirectorId] = useState('');
  const [switchSecondaryId, setSwitchSecondaryId] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [dirResult, directorsResult, ceoResult, empsResult, deptsResult, empDirResult] = await Promise.all([
        supabase.from('directorates').select('id, name, director_id, secondary_director_id, director:users!directorates_director_id_fkey(full_name), secondary_director:users!directorates_secondary_director_id_fkey(full_name)').order('name'),
        supabase.from('users').select('id, full_name, email, job_title').eq('role', 'director').order('full_name'),
        supabase.from('users').select('id, full_name, email, job_title').eq('role', 'ceo').order('full_name'),
        supabase.from('employees').select('id, full_name, job_title, directorate_id, department_id').order('full_name'),
        supabase.from('departments').select('id, name, directorate_id, manager_id, status').eq('status', 'active').order('name'),
        supabase.from('employee_directorates').select('employee_id, directorate_id'),
      ]);
      setAllDepartments((deptsResult.data || []) as Department[]);

      // Combine directors and CEOs, CEOs first
      const combined = [...(ceoResult.data || []), ...(directorsResult.data || [])];
      setAllDirectors(combined);
      const emps = (empsResult.data || []) as any[];
      const empDirData = (empDirResult.data || []) as any[];

      // Build directorate → employee IDs map from junction table
      const dirEmpMap = new Map<string, Set<string>>();
      empDirData.forEach((a: any) => {
        if (!dirEmpMap.has(a.directorate_id)) dirEmpMap.set(a.directorate_id, new Set());
        dirEmpMap.get(a.directorate_id)!.add(a.employee_id);
      });
      // Also include legacy directorate_id
      emps.forEach((e: any) => {
        if (e.directorate_id) {
          if (!dirEmpMap.has(e.directorate_id)) dirEmpMap.set(e.directorate_id, new Set());
          dirEmpMap.get(e.directorate_id)!.add(e.id);
        }
      });
      const empLookup = new Map(emps.map((e: any) => [e.id, e]));

      if (dirResult.data) {
        setDirectorates(dirResult.data.map((dir: any) => {
          const empIds = dirEmpMap.get(dir.id) || new Set();
          return {
            ...dir,
            employees: [...empIds].map(id => empLookup.get(id)).filter(Boolean),
          };
        }));
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

        // Create departments for the new directorate
        if (data && newDeptNames.length > 0) {
          const deptPayloads = newDeptNames.map(name => ({ name, directorate_id: data.id, status: 'active' }));
          await supabase.from('departments').insert(deptPayloads);
          if (user) {
            for (const dp of deptPayloads) {
              await supabase.from('audit_logs').insert({ user_id: user.id, action: 'إضافة قسم', entity_type: 'departments', entity_id: data.id, details: dp });
            }
          }
        }
      }

      setIsDirModalOpen(false);
      setEditingDir(null);
      setDirForm({ name: '', director_id: '', secondary_director_id: '' });
      setNewDeptNames([]);
      setNewDeptInput('');
      fetchData();
    } catch (error: any) {
      toast.error('حدث خطأ: ' + (error?.message || ''));
    }
  };

  const handleDeleteDir = async () => {
    if (!deleteDir) return;
    setDeleting(true);
    try {
      // Remove junction table entries for this directorate
      await supabase.from('employee_directorates').delete().eq('directorate_id', deleteDir.id);
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

  // ─── Department CRUD ────────────────────────────────

  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { name: deptForm.name, directorate_id: deptForm.directorate_id, status: 'active' };
      if (editingDept) {
        await supabase.from('departments').update({ name: deptForm.name }).eq('id', editingDept.id);
        if (user) await supabase.from('audit_logs').insert({ user_id: user.id, action: 'تحديث قسم', entity_type: 'departments', entity_id: editingDept.id, details: payload });
      } else {
        const { data } = await supabase.from('departments').insert(payload).select().single();
        if (user && data) await supabase.from('audit_logs').insert({ user_id: user.id, action: 'إضافة قسم', entity_type: 'departments', entity_id: data.id, details: payload });
      }
      setIsDeptModalOpen(false);
      setEditingDept(null);
      setDeptForm({ name: '', directorate_id: '' });
      fetchData();
    } catch (error: any) {
      toast.error('حدث خطأ: ' + (error?.message || ''));
    }
  };

  const handleDeleteDept = async () => {
    if (!deleteDept) return;
    setDeleting(true);
    try {
      await supabase.from('employees').update({ department_id: null }).eq('department_id', deleteDept.id);
      await supabase.from('departments').delete().eq('id', deleteDept.id);
      if (user) await supabase.from('audit_logs').insert({ user_id: user.id, action: 'حذف قسم', entity_type: 'departments', entity_id: deleteDept.id, details: { name: deleteDept.name } });
      setDeleteDept(null);
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const getDeptsByDirectorate = (dirId: string) => allDepartments.filter(d => d.directorate_id === dirId);

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

      let result: any = {};
      try { result = await response.json(); } catch { /* non-JSON body */ }
      if (!response.ok) {
        const detail = result?.error || result?.message || `HTTP ${response.status} ${response.statusText || 'Error'}`;
        throw new Error(`فشل في إنشاء المستخدم — ${detail}`);
      }

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

  if (loading) return <div className="page-loading-placeholder" aria-hidden="true" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-ds-xl p-5 lg:p-8 flex items-center justify-between"
        style={{
          background: 'var(--sc-green-grad)',
          border: '1px solid var(--sc-green-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-green-val)' }}>الإدارات</h1>
          <p className="mt-2" style={{ color: 'var(--sc-green-label)' }}>إدارة الإدارات والمديرين وتعيين الموظفين</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { setIsRegisterOpen(true); setRegisterFeedback(null); }} variant="outline" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            <span>تسجيل مدير جديد</span>
          </Button>
          <Button onClick={() => { setEditingDir(null); setDirForm({ name: '', director_id: '', secondary_director_id: '' }); setNewDeptNames([]); setNewDeptInput(''); setIsDirModalOpen(true); }} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span>إضافة إدارة</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-ds-info-bg flex items-center justify-center"><Landmark className="h-6 w-6 text-blue-600" /></div>
            <div><p className="text-sm text-ds-faint">إجمالي الإدارات</p><p className="text-2xl font-bold text-ds-text">{directorates.length}</p></div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-ds-purple-bg flex items-center justify-center"><Crown className="h-6 w-6 text-purple-600" /></div>
            <div><p className="text-sm text-ds-faint">مديري الإدارات</p><p className="text-2xl font-bold text-ds-text">{allDirectors.length}</p></div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-ds-success-bg flex items-center justify-center"><Users className="h-6 w-6 text-green-600" /></div>
            <div><p className="text-sm text-ds-faint">إجمالي الموظفين</p><p className="text-2xl font-bold text-ds-text">{directorates.reduce((sum, d) => sum + (d.employees?.length || 0), 0)}</p></div>
          </CardBody>
        </Card>
      </div>

      {/* Directorates Table */}
      <Card>
        <div className="px-6 py-4 border-b border-ds-border">
          <h2 className="text-lg font-semibold text-ds-text">الإدارات والمديرون</h2>
        </div>
        <CardBody className="p-0">
          {directorates.length === 0 ? (
            <EmptyState message="لا يوجد إدارات" icon={<Landmark className="h-12 w-12 text-ds-faint" />} />
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
                    <TableRow className="cursor-pointer hover:bg-ds-bg" onClick={() => setExpandedId(expandedId === dir.id ? null : dir.id)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {expandedId === dir.id ? <ChevronUp className="h-4 w-4 text-ds-faint" /> : <ChevronDown className="h-4 w-4 text-ds-faint" />}
                          <span className="font-medium">{dir.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {dir.director?.full_name || dir.secondary_director?.full_name ? (
                          <div className="flex flex-col gap-1">
                            {dir.director?.full_name && (
                              <div className="flex items-center gap-2">
                                <UserAvatar name={dir.director.full_name} avatarUrl={(dir.director as any).avatar_url} size="sm" />
                                <span className="font-medium">{dir.director.full_name}</span>
                              </div>
                            )}
                            {dir.secondary_director?.full_name && (
                              <div className="flex items-center gap-2">
                                <UserAvatar name={dir.secondary_director.full_name} avatarUrl={(dir.secondary_director as any).avatar_url} size="sm" />
                                <span className="font-medium text-ds-muted">{dir.secondary_director.full_name}</span>
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
                        <TableCell colSpan={4} className="bg-ds-bg px-8 py-4">
                          {(() => {
                            const dirDepts = getDeptsByDirectorate(dir.id);
                            const empsNoDept = (dir.employees || []).filter(e => !e.department_id);
                            const hasDepts = dirDepts.length > 0;

                            return (
                              <div className="space-y-4">
                                {/* Departments side by side — each column has dept name + its employees */}
                                <div className="flex gap-4 flex-wrap items-start">
                                  {dirDepts.map((dept) => {
                                    const deptEmps = (dir.employees || []).filter(e => e.department_id === dept.id);
                                    return (
                                      <div key={dept.id} className="min-w-[220px] flex-1 max-w-sm bg-ds-surface border border-ds-info-border rounded-xl overflow-hidden">
                                        {/* Department header */}
                                        <div className="bg-ds-info-bg px-3 py-2 flex items-center justify-between border-b border-ds-info-border">
                                          <div className="flex items-center gap-1.5">
                                            <Building2 className="h-3.5 w-3.5 text-teal-600" />
                                            <span className="text-sm font-semibold text-ds-info-text">{dept.name}</span>
                                            <span className="text-xs text-teal-500">({deptEmps.length})</span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <button onClick={() => { setEditingDept(dept); setDeptForm({ name: dept.name, directorate_id: dept.directorate_id }); setIsDeptModalOpen(true); }}
                                              className="text-teal-400 hover:text-blue-600 transition-colors p-0.5"><Edit className="h-3 w-3" /></button>
                                            <button onClick={() => setDeleteDept(dept)}
                                              className="text-teal-400 hover:text-red-600 transition-colors p-0.5"><Trash2 className="h-3 w-3" /></button>
                                          </div>
                                        </div>
                                        {/* Employees list */}
                                        <div className="p-2 space-y-1.5">
                                          {deptEmps.length > 0 ? deptEmps.map((emp) => (
                                            <div key={emp.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ds-bg transition-colors">
                                              <UserAvatar name={emp.full_name} avatarUrl={(emp as any).avatar_url} size="sm" />
                                              <div>
                                                <span className="text-sm font-medium text-ds-text">{emp.full_name}</span>
                                                <span className="text-xs text-ds-faint block">{emp.job_title}</span>
                                              </div>
                                            </div>
                                          )) : (
                                            <p className="text-xs text-ds-faint text-center py-2">لا يوجد موظفون</p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {/* Add department card */}
                                  <button
                                    onClick={() => { setEditingDept(null); setDeptForm({ name: '', directorate_id: dir.id }); setIsDeptModalOpen(true); }}
                                    className="min-w-[160px] flex-shrink-0 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-ds-info-border hover:border-teal-400 rounded-xl px-4 py-6 text-teal-600 hover:text-ds-info-text hover:bg-ds-info-bg/50 transition-colors"
                                  >
                                    <Plus className="h-5 w-5" />
                                    <span className="text-xs font-medium">إضافة قسم</span>
                                  </button>
                                </div>

                                {/* Employees without a department */}
                                {empsNoDept.length > 0 && (
                                  <div className="bg-ds-surface border border-ds-border rounded-xl overflow-hidden">
                                    <div className="bg-ds-bg px-3 py-2 border-b border-ds-border">
                                      <p className="text-sm font-semibold text-ds-muted flex items-center gap-1.5">
                                        <Users className="h-3.5 w-3.5" />
                                        {hasDepts ? 'بدون قسم' : 'الموظفون'} ({empsNoDept.length})
                                      </p>
                                    </div>
                                    <div className="p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                                      {empsNoDept.map((emp) => (
                                        <div key={emp.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ds-bg transition-colors">
                                          <UserAvatar name={emp.full_name} avatarUrl={(emp as any).avatar_url} size="sm" />
                                          <div>
                                            <span className="text-sm font-medium text-ds-text">{emp.full_name}</span>
                                            <span className="text-xs text-ds-faint block">{emp.job_title}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {(dir.employees?.length || 0) === 0 && !hasDepts && (
                                  <p className="text-sm text-ds-faint">لا يوجد موظفون تابعون لهذه الإدارة</p>
                                )}
                              </div>
                            );
                          })()}
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
        <div className="px-6 py-4 border-b border-ds-border">
          <h2 className="text-lg font-semibold text-ds-text">مديري الإدارات</h2>
        </div>
        <CardBody className="p-0">
          {allDirectors.length === 0 ? (
            <EmptyState message="لا يوجد مديري إدارات" icon={<Crown className="h-12 w-12 text-ds-faint" />} />
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
                          <UserAvatar name={director.full_name} avatarUrl={(director as any).avatar_url} size="sm" />
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{director.full_name}</span>
                            {isCeo && <Badge variant="warning" size="sm">إدارة عليا</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><span className="text-sm text-ds-muted">{director.email}</span></TableCell>
                      <TableCell>{director.job_title || <span className="text-ds-faint">--</span>}</TableCell>
                      <TableCell>
                        {dirNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {dirNames.map((name, i) => <Badge key={i} variant="info">{name}</Badge>)}
                          </div>
                        ) : <span className="text-ds-faint">غير معين</span>}
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
            <label className="block text-sm font-medium text-ds-muted mb-1">المدير الأساسي</label>
            <ModernSelect
              value={dirForm.director_id}
              onChange={(v) => setDirForm({ ...dirForm, director_id: v })}
              ariaLabel="المدير الأساسي"
              placeholder="-- بدون مدير --"
              options={[
                { value: '', label: '-- بدون مدير --' },
                ...allDirectors
                  .filter(d => d.id === dirForm.director_id || isCeoUser(d.email) || !directorates.some(dir => (dir.director_id === d.id || dir.secondary_director_id === d.id) && dir.id !== editingDir?.id))
                  .map((d) => ({
                    value: d.id,
                    label: `${d.full_name} (${d.email})`,
                    hint: isCeoUser(d.email) ? 'إدارة عليا' : undefined,
                  })),
              ]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ds-muted mb-1">المدير المشارك <span className="text-ds-faint text-xs">(اختياري)</span></label>
            <ModernSelect
              value={dirForm.secondary_director_id}
              onChange={(v) => setDirForm({ ...dirForm, secondary_director_id: v })}
              ariaLabel="المدير المشارك"
              placeholder="-- بدون مدير مشارك --"
              options={[
                { value: '', label: '-- بدون مدير مشارك --' },
                ...allDirectors
                  .filter(d => d.id !== dirForm.director_id && (d.id === dirForm.secondary_director_id || isCeoUser(d.email) || !directorates.some(dir => (dir.director_id === d.id || dir.secondary_director_id === d.id) && dir.id !== editingDir?.id)))
                  .map((d) => ({
                    value: d.id,
                    label: `${d.full_name} (${d.email})`,
                    hint: isCeoUser(d.email) ? 'إدارة عليا' : undefined,
                  })),
              ]}
            />
          </div>
          {/* Departments section */}
          <div className="border border-ds-info-border rounded-lg p-3 bg-ds-info-bg/50">
            <p className="text-sm font-medium text-ds-info-text flex items-center gap-1.5 mb-2">
              <Building2 className="h-4 w-4" />
              أقسام الإدارة {editingDir ? `(${getDeptsByDirectorate(editingDir.id).length})` : newDeptNames.length > 0 ? `(${newDeptNames.length})` : ''}
            </p>

            {/* Existing departments (edit mode) */}
            {editingDir && (() => {
              const dirDepts = getDeptsByDirectorate(editingDir.id);
              return dirDepts.length > 0 ? (
                <div className="space-y-1.5 mb-2">
                  {dirDepts.map(dept => (
                    <div key={dept.id} className="flex items-center justify-between bg-ds-surface rounded-lg px-3 py-2 border border-teal-100">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-teal-500" />
                        <span className="text-sm font-medium text-ds-text">{dept.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => { setEditingDept(dept); setDeptForm({ name: dept.name, directorate_id: dept.directorate_id }); setIsDeptModalOpen(true); }}
                          className="p-1 text-ds-faint hover:text-blue-600 hover:bg-ds-info-bg rounded transition-colors"><Edit className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => setDeleteDept(dept)}
                          className="p-1 text-ds-faint hover:text-red-600 hover:bg-ds-danger-bg rounded transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}

            {/* New departments list (add mode) */}
            {!editingDir && newDeptNames.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {newDeptNames.map((name, i) => (
                  <div key={i} className="flex items-center justify-between bg-ds-surface rounded-lg px-3 py-2 border border-teal-100">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-teal-500" />
                      <span className="text-sm font-medium text-ds-text">{name}</span>
                    </div>
                    <button type="button" onClick={() => setNewDeptNames(prev => prev.filter((_, idx) => idx !== i))}
                      className="p-1 text-ds-faint hover:text-red-600 hover:bg-ds-danger-bg rounded transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Add department input */}
            {editingDir ? (
              <button type="button" onClick={() => { setEditingDept(null); setDeptForm({ name: '', directorate_id: editingDir.id }); setIsDeptModalOpen(true); }}
                className="text-xs text-teal-600 hover:text-ds-info-text font-medium flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-ds-info-bg transition-colors">
                <Plus className="h-3.5 w-3.5" />إضافة قسم
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newDeptInput}
                  onChange={(e) => setNewDeptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newDeptInput.trim()) {
                      e.preventDefault();
                      setNewDeptNames(prev => [...prev, newDeptInput.trim()]);
                      setNewDeptInput('');
                    }
                  }}
                  placeholder="اسم القسم..."
                  className="flex-1 px-3 py-1.5 text-sm border border-ds-info-border rounded-lg focus:ring-2 focus:ring-teal-400 focus:border-teal-400 bg-ds-surface"
                />
                <button type="button" onClick={() => {
                  if (newDeptInput.trim()) {
                    setNewDeptNames(prev => [...prev, newDeptInput.trim()]);
                    setNewDeptInput('');
                  }
                }}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" />إضافة
                </button>
              </div>
            )}
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
            <label className="block text-sm font-medium text-ds-muted mb-1">المدير الأساسي</label>
            <ModernSelect
              value={switchDirectorId}
              onChange={setSwitchDirectorId}
              ariaLabel="المدير الأساسي"
              placeholder="-- بدون مدير --"
              options={[
                { value: '', label: '-- بدون مدير --' },
                ...allDirectors
                  .filter(d => d.id === switchDirectorId || isCeoUser(d.email) || !directorates.some(dir => (dir.director_id === d.id || dir.secondary_director_id === d.id) && dir.id !== switchTarget?.id))
                  .map((d) => ({
                    value: d.id,
                    label: `${d.full_name} (${d.email})`,
                    hint: isCeoUser(d.email) ? 'إدارة عليا' : undefined,
                  })),
              ]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ds-muted mb-1">المدير المشارك <span className="text-ds-faint text-xs">(اختياري)</span></label>
            <ModernSelect
              value={switchSecondaryId}
              onChange={setSwitchSecondaryId}
              ariaLabel="المدير المشارك"
              placeholder="-- بدون مدير مشارك --"
              options={[
                { value: '', label: '-- بدون مدير مشارك --' },
                ...allDirectors
                  .filter(d => d.id !== switchDirectorId && (d.id === switchSecondaryId || isCeoUser(d.email) || !directorates.some(dir => (dir.director_id === d.id || dir.secondary_director_id === d.id) && dir.id !== switchTarget?.id)))
                  .map((d) => ({
                    value: d.id,
                    label: `${d.full_name} (${d.email})`,
                    hint: isCeoUser(d.email) ? 'إدارة عليا' : undefined,
                  })),
              ]}
            />
          </div>
          {switchTarget?.director?.full_name && switchDirectorId !== switchTarget?.director_id && (
            <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg px-4 py-3 text-sm text-ds-warning-text">
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
          <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${registerFeedback.type === 'error' ? 'bg-ds-danger-bg border border-ds-danger-border text-ds-danger-text' : 'bg-ds-success-bg border border-ds-success-border text-ds-success-text'}`}>
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
          <div className="w-14 h-14 bg-ds-danger-bg rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="h-7 w-7 text-red-600" /></div>
          <p className="text-ds-text font-medium mb-2">هل أنت متأكد من حذف <span className="font-bold">{deleteDir?.name}</span>؟</p>
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
          <div className="w-14 h-14 bg-ds-danger-bg rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="h-7 w-7 text-red-600" /></div>
          <p className="text-ds-muted mb-2">هل أنت متأكد من حذف <span className="font-bold text-ds-text">{deleteDirector?.full_name}</span>؟</p>
          <p className="text-sm text-red-600">سيتم حذف الحساب نهائيًا.</p>
        </div>
        <ModalFooter className="justify-center">
          <Button variant="secondary" onClick={() => setDeleteDirector(null)}>إلغاء</Button>
          <Button variant="danger" onClick={handleDeleteDirector} loading={deleting}><span className="flex items-center gap-1"><Trash2 className="h-4 w-4" /><span>حذف نهائي</span></span></Button>
        </ModalFooter>
      </Modal>

      {/* ─── Add/Edit Department Modal ─────────── */}
      <Modal isOpen={isDeptModalOpen} onClose={() => setIsDeptModalOpen(false)} title={editingDept ? 'تعديل القسم' : 'إضافة قسم جديد'}>
        <form onSubmit={handleDeptSubmit} className="space-y-4">
          <Input label="اسم القسم" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} required placeholder="مثال: قسم التصميم" />
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsDeptModalOpen(false)}>إلغاء</Button>
            <Button type="submit">{editingDept ? 'تحديث' : 'إضافة'}</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ─── Delete Department Modal ──────────── */}
      <Modal isOpen={!!deleteDept} onClose={() => setDeleteDept(null)} title="تأكيد حذف القسم">
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-ds-danger-bg rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="h-7 w-7 text-red-600" /></div>
          <p className="text-ds-text font-medium mb-2">هل أنت متأكد من حذف قسم <span className="font-bold">{deleteDept?.name}</span>؟</p>
          <p className="text-sm text-amber-600">سيتم فك ربط الموظفين المرتبطين بهذا القسم</p>
        </div>
        <ModalFooter className="justify-center">
          <Button variant="secondary" onClick={() => setDeleteDept(null)}>إلغاء</Button>
          <Button variant="danger" onClick={handleDeleteDept} loading={deleting}><span className="flex items-center gap-1"><Trash2 className="h-4 w-4" /><span>حذف</span></span></Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};
