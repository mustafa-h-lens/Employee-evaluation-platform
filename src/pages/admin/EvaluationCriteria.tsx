import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, TextArea } from '../../components/ui/Input';
import { Modal, ModalFooter } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { ModernSelect } from '../../components/ui/ModernSelect';
import {
  Plus,
  CreditCard as Edit,
  Trash2,
  ClipboardList,
  AlertTriangle,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Scale,
  EyeOff,
  Building2,
  Filter,
  Shield,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Toggle } from '../../components/ui/Toggle';
import { useAuth } from '../../contexts/AuthContext';

interface Criterion {
  id: string;
  title: string;
  description: string;
  weight: number;
  order: number;
  is_active: boolean;
  score_count?: number;
}

interface DeptCriterion {
  id: string;
  department_id: string | null;
  directorate_id: string | null;
  group_id: string | null;
  title: string;
  description: string;
  weight: number;
  order: number;
  is_active: boolean;
}

interface DirCriteriaGroup {
  id: string;
  directorate_id: string;
  name: string;
  order: number;
  is_default: boolean;
}

interface DirEmployee {
  id: string;
  full_name: string;
  job_title: string | null;
  department_name: string | null;
}

interface Directorate {
  id: string;
  name: string;
}

interface SupervisorAssignment {
  id: string;
  title: string | null;
  user: { full_name: string } | null;
}

interface SupervisorCriterion {
  id: string;
  assignment_id: string;
  group_id: string | null;
  title: string;
  description: string;
  weight: number;
  order: number;
  is_active: boolean;
  created_by: string | null;
}

interface SupCriteriaGroup {
  id: string;
  assignment_id: string;
  name: string;
  order: number;
  is_default: boolean;
}

interface SupGroupMember {
  group_id: string;
  employee_id: string;
  employee?: { full_name: string };
}

interface FormData {
  title: string;
  description: string;
  weight: string;
  is_active: boolean;
}

const defaultFormData: FormData = {
  title: '',
  description: '',
  weight: '',
  is_active: true,
};

export const EvaluationCriteria: React.FC = () => {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<Criterion | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [generalWeightLimit, setGeneralWeightLimit] = useState(50);
  const [specificWeightLimit, setSpecificWeightLimit] = useState(50);
  const [activeTab, setActiveTab] = useState<'general' | 'departments' | 'ceo' | 'supervisors' | 'ceo-eval'>('general');
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [groupsByDirectorate, setGroupsByDirectorate] = useState<Record<string, DirCriteriaGroup[]>>({});
  const [criteriaByGroup, setCriteriaByGroup] = useState<Record<string, DeptCriterion[]>>({});
  const [membersByGroup, setMembersByGroup] = useState<Record<string, DirEmployee[]>>({});
  const [employeesByDirectorate, setEmployeesByDirectorate] = useState<Record<string, DirEmployee[]>>({});
  const [groupMembershipByDir, setGroupMembershipByDir] = useState<Record<string, Record<string, string>>>({});
  const [selectedDirId, setSelectedDirId] = useState<string>('all');
  const [expandedCriterionId, setExpandedCriterionId] = useState<string | null>(null);
  const [ceoCriteria, setCeoCriteria] = useState<DeptCriterion[]>([]);

  // Directorate group CRUD state
  const [isDirGroupModalOpen, setIsDirGroupModalOpen] = useState(false);
  const [dirGroupCrudDirectorateId, setDirGroupCrudDirectorateId] = useState<string>('');
  const [editingDirGroup, setEditingDirGroup] = useState<DirCriteriaGroup | null>(null);
  const [dirGroupForm, setDirGroupForm] = useState<{ name: string; memberIds: Set<string> }>({ name: '', memberIds: new Set() });
  const [savingDirGroup, setSavingDirGroup] = useState(false);
  const [dirGroupError, setDirGroupError] = useState('');
  const [dirGroupDeleteTarget, setDirGroupDeleteTarget] = useState<DirCriteriaGroup | null>(null);
  const [isDirGroupDeleteOpen, setIsDirGroupDeleteOpen] = useState(false);
  const [deletingDirGroup, setDeletingDirGroup] = useState(false);

  // Directorate criterion CRUD state
  const [isDirCriterionModalOpen, setIsDirCriterionModalOpen] = useState(false);
  const [dirCriterionGroupId, setDirCriterionGroupId] = useState<string>('');
  const [dirCriterionDirectorateId, setDirCriterionDirectorateId] = useState<string>('');
  const [editingDirCriterion, setEditingDirCriterion] = useState<DeptCriterion | null>(null);
  const [dirCriterionForm, setDirCriterionForm] = useState<FormData>(defaultFormData);
  const [savingDirCriterion, setSavingDirCriterion] = useState(false);
  const [dirCriterionError, setDirCriterionError] = useState('');
  const [dirCriterionDeleteTarget, setDirCriterionDeleteTarget] = useState<DeptCriterion | null>(null);
  const [isDirCriterionDeleteOpen, setIsDirCriterionDeleteOpen] = useState(false);
  const [deletingDirCriterion, setDeletingDirCriterion] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Criterion | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // CEO evaluation criteria state (criteria for employees evaluating CEOs)
  const [ceoEvalCriteria, setCeoEvalCriteria] = useState<Criterion[]>([]);
  const [isCeoEvalModalOpen, setIsCeoEvalModalOpen] = useState(false);
  const [editingCeoEvalCriterion, setEditingCeoEvalCriterion] = useState<Criterion | null>(null);
  const [ceoEvalFormData, setCeoEvalFormData] = useState<FormData>(defaultFormData);
  const [ceoEvalSaving, setCeoEvalSaving] = useState(false);
  const [ceoEvalFormError, setCeoEvalFormError] = useState('');
  const [ceoEvalDeleteTarget, setCeoEvalDeleteTarget] = useState<Criterion | null>(null);
  const [isCeoEvalDeleteModalOpen, setIsCeoEvalDeleteModalOpen] = useState(false);
  const [ceoEvalDeleting, setCeoEvalDeleting] = useState(false);
  const [ceoEvalDeleteError, setCeoEvalDeleteError] = useState('');

  // Supervisor criteria state (read-only)
  const [supAssignments, setSupAssignments] = useState<SupervisorAssignment[]>([]);
  const [selectedSupAssignment, setSelectedSupAssignment] = useState('');
  const [supCriteria, setSupCriteria] = useState<SupervisorCriterion[]>([]);
  const [supGroups, setSupGroups] = useState<SupCriteriaGroup[]>([]);
  const [supGroupMembers, setSupGroupMembers] = useState<SupGroupMember[]>([]);

  // CEO criteria CRUD state
  const [isCeoModalOpen, setIsCeoModalOpen] = useState(false);
  const [editingCeoCriterion, setEditingCeoCriterion] = useState<DeptCriterion | null>(null);
  const [ceoFormData, setCeoFormData] = useState<FormData>(defaultFormData);
  const [ceoSaving, setCeoSaving] = useState(false);
  const [ceoFormError, setCeoFormError] = useState('');
  const [ceoDeleteTarget, setCeoDeleteTarget] = useState<DeptCriterion | null>(null);
  const [isCeoDeleteModalOpen, setIsCeoDeleteModalOpen] = useState(false);
  const [ceoDeleting, setCeoDeleting] = useState(false);
  const [ceoDeleteError, setCeoDeleteError] = useState('');

  const { user } = useAuth();

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from('evaluation_settings')
      .select('*')
      .limit(1)
      .single();
    if (data) {
      setGeneralWeightLimit(data.general_weight);
      setSpecificWeightLimit(data.specific_weight);
    }
  }, []);

  const fetchDepartmentsAndCriteria = useCallback(async () => {
    const [dirsRes, groupsRes, allDirCriteriaRes, ceoCriteriaRes, membershipRes, employeesRes] = await Promise.all([
      supabase.from('directorates').select('id, name').order('name'),
      supabase.from('department_criteria_groups').select('*').order('order'),
      supabase.from('department_criteria').select('*').not('directorate_id', 'is', null).order('order'),
      supabase.from('department_criteria').select('*').is('department_id', null).is('directorate_id', null).order('order'),
      supabase.from('department_criteria_group_members').select('group_id, directorate_id, employee_id'),
      supabase.from('employees')
        .select('id, full_name, job_title, directorate_id, department:departments(name)')
        .eq('status', 'active')
        .order('full_name'),
    ]);
    const dirsList = (dirsRes.data as unknown as Directorate[]) || [];
    setDirectorates(dirsList);

    const employeeMap = new Map<string, DirEmployee>();
    const empByDir: Record<string, DirEmployee[]> = {};
    (employeesRes.data || []).forEach((e: any) => {
      const emp: DirEmployee = {
        id: e.id,
        full_name: e.full_name || 'موظف',
        job_title: e.job_title || null,
        department_name: e.department?.name || null,
      };
      employeeMap.set(e.id, emp);
      if (e.directorate_id) (empByDir[e.directorate_id] ||= []).push(emp);
    });
    setEmployeesByDirectorate(empByDir);

    const dirGroupsMap: Record<string, DirCriteriaGroup[]> = {};
    (groupsRes.data || []).forEach((g: any) => {
      (dirGroupsMap[g.directorate_id] ||= []).push(g as DirCriteriaGroup);
    });
    Object.values(dirGroupsMap).forEach(arr => arr.sort((a, b) => a.order - b.order));
    setGroupsByDirectorate(dirGroupsMap);

    const cByGroup: Record<string, DeptCriterion[]> = {};
    (allDirCriteriaRes.data || []).forEach((c: any) => {
      if (!c.group_id) return;
      (cByGroup[c.group_id] ||= []).push(c as DeptCriterion);
    });
    Object.values(cByGroup).forEach(arr => arr.sort((a, b) => a.order - b.order));
    setCriteriaByGroup(cByGroup);

    const mByGroup: Record<string, DirEmployee[]> = {};
    const memByDir: Record<string, Record<string, string>> = {};
    (membershipRes.data || []).forEach((row: any) => {
      const emp = employeeMap.get(row.employee_id);
      if (emp) (mByGroup[row.group_id] ||= []).push(emp);
      ((memByDir[row.directorate_id] ||= {}))[row.employee_id] = row.group_id;
    });
    setMembersByGroup(mByGroup);
    setGroupMembershipByDir(memByDir);

    setCeoCriteria((ceoCriteriaRes.data || []) as DeptCriterion[]);
  }, []);

  const fetchCriteria = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('evaluation_criteria')
        .select('*')
        .order('order', { ascending: true });

      if (!error && data) {
        const criteriaWithCount = await Promise.all(
          data.map(async (c) => {
            const { count } = await supabase
              .from('evaluation_scores')
              .select('*', { count: 'exact', head: true })
              .eq('criterion_id', c.id);
            return { ...c, score_count: count || 0 };
          })
        );
        setCriteria(criteriaWithCount);
      }
    } catch (error) {
      console.error('Error fetching criteria:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCeoEvalCriteria = useCallback(async () => {
    const { data } = await supabase
      .from('ceo_evaluation_criteria')
      .select('*')
      .order('order', { ascending: true });
    setCeoEvalCriteria((data || []) as Criterion[]);
  }, []);

  const fetchSupAssignments = useCallback(async () => {
    const { data } = await supabase
      .from('supervisor_assignments')
      .select('id, title, user:users!supervisor_assignments_user_id_fkey(full_name)')
      .eq('status', 'active')
      .order('created_at');
    const list = (data || []) as unknown as SupervisorAssignment[];
    setSupAssignments(list);
    if (list.length > 0 && !selectedSupAssignment) {
      setSelectedSupAssignment(list[0].id);
    }
  }, []);

  const fetchSupCriteria = useCallback(async () => {
    if (!selectedSupAssignment) { setSupCriteria([]); setSupGroups([]); setSupGroupMembers([]); return; }
    const [criteriaRes, groupsRes, memberRes] = await Promise.all([
      supabase.from('supervisor_criteria').select('*')
        .eq('assignment_id', selectedSupAssignment).order('order'),
      supabase.from('supervisor_criteria_groups').select('*')
        .eq('assignment_id', selectedSupAssignment).order('order'),
      supabase.from('supervisor_criteria_group_members')
        .select('group_id, employee_id, employee:employees(full_name)')
        .eq('assignment_id', selectedSupAssignment),
    ]);
    setSupCriteria((criteriaRes.data || []) as SupervisorCriterion[]);
    setSupGroups((groupsRes.data || []) as SupCriteriaGroup[]);
    setSupGroupMembers((memberRes.data || []) as unknown as SupGroupMember[]);
  }, [selectedSupAssignment]);

  useEffect(() => {
    fetchCriteria();
    fetchSettings();
    fetchDepartmentsAndCriteria();
    fetchCeoEvalCriteria();
    fetchSupAssignments();
  }, [fetchCriteria, fetchSettings, fetchDepartmentsAndCriteria, fetchSupAssignments]);

  useEffect(() => { fetchSupCriteria(); }, [fetchSupCriteria]);

  const totalWeight = criteria
    .filter(c => c.is_active)
    .reduce((sum, c) => sum + c.weight, 0);

  const openAddModal = () => {
    setEditingCriterion(null);
    setFormData(defaultFormData);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (criterion: Criterion) => {
    setEditingCriterion(criterion);
    setFormData({
      title: criterion.title,
      description: criterion.description,
      weight: criterion.weight.toString(),
      is_active: criterion.is_active,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);

    const weight = parseFloat(formData.weight);

    if (!formData.title.trim()) {
      setFormError('يرجى إدخال عنوان المعيار');
      setSaving(false);
      return;
    }

    if (!formData.description.trim()) {
      setFormError('يرجى إدخال وصف المعيار');
      setSaving(false);
      return;
    }

    if (!weight || weight < 1 || weight > 100) {
      setFormError('يرجى إدخال وزن صحيح (1-100)');
      setSaving(false);
      return;
    }

    try {
      if (editingCriterion) {
        const { error } = await supabase
          .from('evaluation_criteria')
          .update({
            title: formData.title.trim(),
            description: formData.description.trim(),
            weight,
            is_active: formData.is_active,
          })
          .eq('id', editingCriterion.id);

        if (error) {
          setFormError(error.message);
          setSaving(false);
          return;
        }

        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'تحديث معيار تقييم',
            entity_type: 'evaluation_criteria',
            entity_id: editingCriterion.id,
            details: { title: formData.title, weight },
          });
        }
      } else {
        const maxOrder = criteria.length > 0
          ? Math.max(...criteria.map(c => c.order))
          : 0;

        const { data, error } = await supabase
          .from('evaluation_criteria')
          .insert({
            title: formData.title.trim(),
            description: formData.description.trim(),
            weight,
            order: maxOrder + 1,
            is_active: formData.is_active,
          })
          .select()
          .single();

        if (error) {
          setFormError(error.message);
          setSaving(false);
          return;
        }

        if (user && data) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'إضافة معيار تقييم',
            entity_type: 'evaluation_criteria',
            entity_id: data.id,
            details: { title: formData.title, weight },
          });
        }
      }

      setIsModalOpen(false);
      setEditingCriterion(null);
      fetchCriteria();
    } catch (error) {
      console.error('Error saving criterion:', error);
      setFormError('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (criterion: Criterion) => {
    setDeleteTarget(criterion);
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const { error } = await supabase
        .from('evaluation_criteria')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) {
        setDeleteError('فشل حذف المعيار. تأكد من عدم وجود تقييمات مرتبطة به.');
        setDeleting(false);
        return;
      }

      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'حذف معيار تقييم',
          entity_type: 'evaluation_criteria',
          entity_id: deleteTarget.id,
          details: { title: deleteTarget.title },
        });
      }

      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      fetchCriteria();
    } catch (error) {
      console.error('Error deleting criterion:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (criterion: Criterion) => {
    const newActive = !criterion.is_active;
    const { error } = await supabase
      .from('evaluation_criteria')
      .update({ is_active: newActive })
      .eq('id', criterion.id);

    if (!error) {
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: newActive ? 'تفعيل معيار تقييم' : 'تعطيل معيار تقييم',
          entity_type: 'evaluation_criteria',
          entity_id: criterion.id,
          details: { title: criterion.title, is_active: newActive },
        });
      }
      fetchCriteria();
    }
  };

  const handleReorder = async (criterion: Criterion, direction: 'up' | 'down') => {
    const currentIndex = criteria.findIndex(c => c.id === criterion.id);
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (swapIndex < 0 || swapIndex >= criteria.length) return;

    const swapCriterion = criteria[swapIndex];

    await Promise.all([
      supabase.from('evaluation_criteria').update({ order: swapCriterion.order }).eq('id', criterion.id),
      supabase.from('evaluation_criteria').update({ order: criterion.order }).eq('id', swapCriterion.id),
    ]);

    fetchCriteria();
  };

  // ── CEO evaluation criteria handlers (for employees evaluating CEOs) ──
  const ceoEvalTotalWeight = ceoEvalCriteria.filter(c => c.is_active).reduce((s, c) => s + c.weight, 0);

  const handleCeoEvalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCeoEvalFormError('');
    setCeoEvalSaving(true);
    const weight = parseFloat(ceoEvalFormData.weight);
    if (!ceoEvalFormData.title.trim()) { setCeoEvalFormError('يرجى إدخال عنوان المعيار'); setCeoEvalSaving(false); return; }
    if (!ceoEvalFormData.description.trim()) { setCeoEvalFormError('يرجى إدخال وصف المعيار'); setCeoEvalSaving(false); return; }
    if (!weight || weight < 1 || weight > 100) { setCeoEvalFormError('يرجى إدخال وزن صحيح (1-100)'); setCeoEvalSaving(false); return; }
    try {
      if (editingCeoEvalCriterion) {
        const { error } = await supabase.from('ceo_evaluation_criteria').update({ title: ceoEvalFormData.title.trim(), description: ceoEvalFormData.description.trim(), weight, is_active: ceoEvalFormData.is_active }).eq('id', editingCeoEvalCriterion.id);
        if (error) { setCeoEvalFormError(error.message); setCeoEvalSaving(false); return; }
        if (user) await supabase.from('audit_logs').insert({ user_id: user.id, action: 'تحديث معيار تقييم الإدارة العليا', entity_type: 'ceo_evaluation_criteria', entity_id: editingCeoEvalCriterion.id, details: { title: ceoEvalFormData.title, weight } });
      } else {
        const maxOrder = ceoEvalCriteria.length > 0 ? Math.max(...ceoEvalCriteria.map(c => c.order)) : 0;
        const { data, error } = await supabase.from('ceo_evaluation_criteria').insert({ title: ceoEvalFormData.title.trim(), description: ceoEvalFormData.description.trim(), weight, order: maxOrder + 1, is_active: ceoEvalFormData.is_active }).select().single();
        if (error) { setCeoEvalFormError(error.message); setCeoEvalSaving(false); return; }
        if (user && data) await supabase.from('audit_logs').insert({ user_id: user.id, action: 'إضافة معيار تقييم الإدارة العليا', entity_type: 'ceo_evaluation_criteria', entity_id: data.id, details: { title: ceoEvalFormData.title, weight } });
      }
      setIsCeoEvalModalOpen(false);
      setEditingCeoEvalCriterion(null);
      fetchCeoEvalCriteria();
    } catch { setCeoEvalFormError('حدث خطأ أثناء الحفظ'); } finally { setCeoEvalSaving(false); }
  };

  const handleCeoEvalDelete = async () => {
    if (!ceoEvalDeleteTarget) return;
    setCeoEvalDeleting(true);
    try {
      const { error } = await supabase.from('ceo_evaluation_criteria').delete().eq('id', ceoEvalDeleteTarget.id);
      if (error) { setCeoEvalDeleteError('فشل حذف المعيار.'); setCeoEvalDeleting(false); return; }
      if (user) await supabase.from('audit_logs').insert({ user_id: user.id, action: 'حذف معيار تقييم الإدارة العليا', entity_type: 'ceo_evaluation_criteria', entity_id: ceoEvalDeleteTarget.id, details: { title: ceoEvalDeleteTarget.title } });
      setIsCeoEvalDeleteModalOpen(false);
      setCeoEvalDeleteTarget(null);
      fetchCeoEvalCriteria();
    } catch { console.error('Error deleting CEO eval criterion'); } finally { setCeoEvalDeleting(false); }
  };

  const handleCeoEvalToggleActive = async (criterion: Criterion) => {
    const newActive = !criterion.is_active;
    const { error } = await supabase.from('ceo_evaluation_criteria').update({ is_active: newActive }).eq('id', criterion.id);
    if (!error) {
      if (user) await supabase.from('audit_logs').insert({ user_id: user.id, action: newActive ? 'تفعيل معيار تقييم الإدارة العليا' : 'تعطيل معيار تقييم الإدارة العليا', entity_type: 'ceo_evaluation_criteria', entity_id: criterion.id, details: { title: criterion.title, is_active: newActive } });
      fetchCeoEvalCriteria();
    }
  };

  const handleCeoEvalReorder = async (criterion: Criterion, direction: 'up' | 'down') => {
    const currentIndex = ceoEvalCriteria.findIndex(c => c.id === criterion.id);
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= ceoEvalCriteria.length) return;
    const swapCriterion = ceoEvalCriteria[swapIndex];
    await Promise.all([
      supabase.from('ceo_evaluation_criteria').update({ order: swapCriterion.order }).eq('id', criterion.id),
      supabase.from('ceo_evaluation_criteria').update({ order: criterion.order }).eq('id', swapCriterion.id),
    ]);
    fetchCeoEvalCriteria();
  };

  // ── CEO criteria handlers ──
  const ceoTotalWeight = ceoCriteria
    .filter(c => c.is_active)
    .reduce((sum, c) => sum + c.weight, 0);

  const openCeoAddModal = () => {
    setEditingCeoCriterion(null);
    setCeoFormData(defaultFormData);
    setCeoFormError('');
    setIsCeoModalOpen(true);
  };

  const openCeoEditModal = (criterion: DeptCriterion) => {
    setEditingCeoCriterion(criterion);
    setCeoFormData({
      title: criterion.title,
      description: criterion.description,
      weight: criterion.weight.toString(),
      is_active: criterion.is_active,
    });
    setCeoFormError('');
    setIsCeoModalOpen(true);
  };

  // ===== Directorate group CRUD (admin) =====

  const openDirGroupCreateModal = (directorateId: string) => {
    setDirGroupCrudDirectorateId(directorateId);
    setEditingDirGroup(null);
    const allEmps = employeesByDirectorate[directorateId] || [];
    const memMap = groupMembershipByDir[directorateId] || {};
    const unassigned = allEmps.filter(e => !memMap[e.id]).map(e => e.id);
    setDirGroupForm({ name: '', memberIds: new Set(unassigned) });
    setDirGroupError('');
    setIsDirGroupModalOpen(true);
  };

  const openDirGroupEditModal = (group: DirCriteriaGroup) => {
    setDirGroupCrudDirectorateId(group.directorate_id);
    setEditingDirGroup(group);
    const ids = (membersByGroup[group.id] || []).map(m => m.id);
    setDirGroupForm({ name: group.name, memberIds: new Set(ids) });
    setDirGroupError('');
    setIsDirGroupModalOpen(true);
  };

  const toggleDirGroupMember = (employeeId: string) => {
    setDirGroupForm(prev => {
      const next = new Set(prev.memberIds);
      if (next.has(employeeId)) next.delete(employeeId); else next.add(employeeId);
      return { ...prev, memberIds: next };
    });
  };

  const handleSaveDirGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setDirGroupError('');
    if (!dirGroupForm.name.trim()) { setDirGroupError('يرجى إدخال اسم المجموعة'); return; }
    if (!dirGroupCrudDirectorateId) { setDirGroupError('لم يتم تحديد الإدارة'); return; }
    setSavingDirGroup(true);
    try {
      let groupId = editingDirGroup?.id;
      if (editingDirGroup) {
        const { error } = await supabase
          .from('department_criteria_groups')
          .update({ name: dirGroupForm.name.trim() })
          .eq('id', editingDirGroup.id);
        if (error) { setDirGroupError(error.message); setSavingDirGroup(false); return; }
        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'تحديث مجموعة معايير الإدارة',
            entity_type: 'department_criteria_groups',
            entity_id: editingDirGroup.id,
            details: { name: dirGroupForm.name.trim(), directorate_id: dirGroupCrudDirectorateId },
          });
        }
      } else {
        const existing = groupsByDirectorate[dirGroupCrudDirectorateId] || [];
        const maxOrder = existing.length > 0 ? Math.max(...existing.map(g => g.order)) : 0;
        const { data, error } = await supabase
          .from('department_criteria_groups')
          .insert({
            directorate_id: dirGroupCrudDirectorateId,
            name: dirGroupForm.name.trim(),
            order: maxOrder + 1,
            is_default: false,
            created_by: user?.id || null,
          })
          .select().single();
        if (error || !data) { setDirGroupError(error?.message || 'فشل إنشاء المجموعة'); setSavingDirGroup(false); return; }
        groupId = data.id;
        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'إنشاء مجموعة معايير الإدارة',
            entity_type: 'department_criteria_groups',
            entity_id: data.id,
            details: { name: dirGroupForm.name.trim(), directorate_id: dirGroupCrudDirectorateId },
          });
        }
      }

      const desired = dirGroupForm.memberIds;
      const previously = new Set((membersByGroup[groupId!] || []).map(m => m.id));
      const toAdd = [...desired].filter(id => !previously.has(id));
      const toRemove = [...previously].filter(id => !desired.has(id));

      if (toRemove.length > 0) {
        await supabase
          .from('department_criteria_group_members')
          .delete()
          .eq('group_id', groupId!)
          .in('employee_id', toRemove);
      }
      if (toAdd.length > 0) {
        await supabase
          .from('department_criteria_group_members')
          .delete()
          .eq('directorate_id', dirGroupCrudDirectorateId)
          .in('employee_id', toAdd);
        await supabase
          .from('department_criteria_group_members')
          .insert(toAdd.map(eid => ({
            group_id: groupId!,
            directorate_id: dirGroupCrudDirectorateId,
            employee_id: eid,
          })));
      }

      if (user && (toAdd.length > 0 || toRemove.length > 0)) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'تحديث أعضاء مجموعة معايير الإدارة',
          entity_type: 'department_criteria_group_members',
          entity_id: groupId!,
          details: { added: toAdd, removed: toRemove, directorate_id: dirGroupCrudDirectorateId },
        });
      }

      setIsDirGroupModalOpen(false);
      setEditingDirGroup(null);
      fetchDepartmentsAndCriteria();
    } catch (err) {
      console.error(err);
      setDirGroupError('حدث خطأ أثناء الحفظ');
    } finally {
      setSavingDirGroup(false);
    }
  };

  const confirmDeleteDirGroup = (group: DirCriteriaGroup) => {
    setDirGroupDeleteTarget(group);
    setIsDirGroupDeleteOpen(true);
  };

  const handleDeleteDirGroup = async () => {
    if (!dirGroupDeleteTarget) return;
    setDeletingDirGroup(true);
    try {
      const { error } = await supabase
        .from('department_criteria_groups').delete().eq('id', dirGroupDeleteTarget.id);
      if (error) { setDirGroupError(error.message); return; }
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'حذف مجموعة معايير الإدارة',
          entity_type: 'department_criteria_groups',
          entity_id: dirGroupDeleteTarget.id,
          details: { name: dirGroupDeleteTarget.name, directorate_id: dirGroupDeleteTarget.directorate_id },
        });
      }
      setIsDirGroupDeleteOpen(false);
      setDirGroupDeleteTarget(null);
      fetchDepartmentsAndCriteria();
    } finally {
      setDeletingDirGroup(false);
    }
  };

  // ===== Directorate criterion CRUD (admin) =====

  const openDirCriterionAddModal = (group: DirCriteriaGroup) => {
    setDirCriterionGroupId(group.id);
    setDirCriterionDirectorateId(group.directorate_id);
    setEditingDirCriterion(null);
    setDirCriterionForm(defaultFormData);
    setDirCriterionError('');
    setIsDirCriterionModalOpen(true);
  };

  const openDirCriterionEditModal = (criterion: DeptCriterion) => {
    setDirCriterionGroupId(criterion.group_id || '');
    setDirCriterionDirectorateId(criterion.directorate_id || '');
    setEditingDirCriterion(criterion);
    setDirCriterionForm({
      title: criterion.title,
      description: criterion.description,
      weight: criterion.weight.toString(),
      is_active: criterion.is_active,
    });
    setDirCriterionError('');
    setIsDirCriterionModalOpen(true);
  };

  const handleSaveDirCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    setDirCriterionError('');
    const weight = parseFloat(dirCriterionForm.weight);
    if (!dirCriterionForm.title.trim()) { setDirCriterionError('يرجى إدخال عنوان المعيار'); return; }
    if (!dirCriterionForm.description.trim()) { setDirCriterionError('يرجى إدخال وصف المعيار'); return; }
    if (!weight || weight < 1 || weight > 100) { setDirCriterionError('يرجى إدخال وزن صحيح (1-100)'); return; }
    if (!dirCriterionGroupId) { setDirCriterionError('لم يتم تحديد المجموعة'); return; }

    if (dirCriterionForm.is_active) {
      const groupCriteria = (criteriaByGroup[dirCriterionGroupId] || []).filter(c => c.id !== editingDirCriterion?.id);
      const othersActive = groupCriteria.filter(c => c.is_active).reduce((s, c) => s + c.weight, 0);
      const projected = othersActive + weight;
      if (projected > specificWeightLimit) {
        setDirCriterionError(`لا يمكن تجاوز الحد المسموح (${specificWeightLimit}%) في هذه المجموعة. المجموع بعد الإضافة سيصبح ${projected}%.`);
        return;
      }
    }

    setSavingDirCriterion(true);
    try {
      if (editingDirCriterion) {
        const { error } = await supabase.from('department_criteria').update({
          title: dirCriterionForm.title.trim(),
          description: dirCriterionForm.description.trim(),
          weight,
          is_active: dirCriterionForm.is_active,
        }).eq('id', editingDirCriterion.id);
        if (error) { setDirCriterionError(error.message); setSavingDirCriterion(false); return; }
        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'تحديث معيار خاص بالإدارة',
            entity_type: 'department_criteria',
            entity_id: editingDirCriterion.id,
            details: { title: dirCriterionForm.title, weight, group_id: dirCriterionGroupId, directorate_id: dirCriterionDirectorateId },
          });
        }
      } else {
        const groupList = criteriaByGroup[dirCriterionGroupId] || [];
        const maxOrder = groupList.length > 0 ? Math.max(...groupList.map(c => c.order)) : 0;
        const { data, error } = await supabase.from('department_criteria').insert({
          directorate_id: dirCriterionDirectorateId,
          department_id: null,
          group_id: dirCriterionGroupId,
          title: dirCriterionForm.title.trim(),
          description: dirCriterionForm.description.trim(),
          weight,
          order: maxOrder + 1,
          is_active: dirCriterionForm.is_active,
          created_by: user?.id || null,
        }).select().single();
        if (error) { setDirCriterionError(error.message); setSavingDirCriterion(false); return; }
        if (user && data) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'إضافة معيار خاص بالإدارة',
            entity_type: 'department_criteria',
            entity_id: data.id,
            details: { title: dirCriterionForm.title, weight, group_id: dirCriterionGroupId, directorate_id: dirCriterionDirectorateId },
          });
        }
      }
      setIsDirCriterionModalOpen(false);
      setEditingDirCriterion(null);
      fetchDepartmentsAndCriteria();
    } finally {
      setSavingDirCriterion(false);
    }
  };

  const handleDirCriterionToggle = async (criterion: DeptCriterion) => {
    const newActive = !criterion.is_active;
    if (newActive) {
      const groupCriteria = (criteriaByGroup[criterion.group_id || ''] || []).filter(c => c.id !== criterion.id);
      const othersActive = groupCriteria.filter(c => c.is_active).reduce((s, c) => s + c.weight, 0);
      const projected = othersActive + criterion.weight;
      if (projected > specificWeightLimit) {
        alert(`لا يمكن تفعيل هذا المعيار — المجموع في هذه المجموعة سيصبح ${projected}% ويتجاوز ${specificWeightLimit}%.`);
        return;
      }
    }
    const { error } = await supabase.from('department_criteria')
      .update({ is_active: newActive }).eq('id', criterion.id);
    if (!error) {
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: newActive ? 'تفعيل معيار خاص بالإدارة' : 'تعطيل معيار خاص بالإدارة',
          entity_type: 'department_criteria',
          entity_id: criterion.id,
          details: { title: criterion.title, is_active: newActive },
        });
      }
      fetchDepartmentsAndCriteria();
    }
  };

  const handleDirCriterionReorder = async (criterion: DeptCriterion, direction: 'up' | 'down') => {
    const list = criteriaByGroup[criterion.group_id || ''] || [];
    const idx = list.findIndex(c => c.id === criterion.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const swap = list[swapIdx];
    await Promise.all([
      supabase.from('department_criteria').update({ order: swap.order }).eq('id', criterion.id),
      supabase.from('department_criteria').update({ order: criterion.order }).eq('id', swap.id),
    ]);
    fetchDepartmentsAndCriteria();
  };

  const confirmDeleteDirCriterion = (criterion: DeptCriterion) => {
    setDirCriterionDeleteTarget(criterion);
    setIsDirCriterionDeleteOpen(true);
  };

  const handleDeleteDirCriterion = async () => {
    if (!dirCriterionDeleteTarget) return;
    setDeletingDirCriterion(true);
    try {
      const { error } = await supabase.from('department_criteria')
        .delete().eq('id', dirCriterionDeleteTarget.id);
      if (!error) {
        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'حذف معيار خاص بالإدارة',
            entity_type: 'department_criteria',
            entity_id: dirCriterionDeleteTarget.id,
            details: { title: dirCriterionDeleteTarget.title, group_id: dirCriterionDeleteTarget.group_id },
          });
        }
        setIsDirCriterionDeleteOpen(false);
        setDirCriterionDeleteTarget(null);
        fetchDepartmentsAndCriteria();
      }
    } finally {
      setDeletingDirCriterion(false);
    }
  };

  const handleCeoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCeoFormError('');
    setCeoSaving(true);

    const weight = parseFloat(ceoFormData.weight);

    if (!ceoFormData.title.trim()) { setCeoFormError('يرجى إدخال عنوان المعيار'); setCeoSaving(false); return; }
    if (!ceoFormData.description.trim()) { setCeoFormError('يرجى إدخال وصف المعيار'); setCeoSaving(false); return; }
    if (!weight || weight < 1 || weight > 100) { setCeoFormError('يرجى إدخال وزن صحيح (1-100)'); setCeoSaving(false); return; }

    try {
      if (editingCeoCriterion) {
        const { error } = await supabase
          .from('department_criteria')
          .update({
            title: ceoFormData.title.trim(),
            description: ceoFormData.description.trim(),
            weight,
            is_active: ceoFormData.is_active,
          })
          .eq('id', editingCeoCriterion.id);

        if (error) { setCeoFormError(error.message); setCeoSaving(false); return; }

        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'تحديث معيار خاص بتقييم المديرين',
            entity_type: 'department_criteria',
            entity_id: editingCeoCriterion.id,
            details: { title: ceoFormData.title, weight },
          });
        }
      } else {
        const maxOrder = ceoCriteria.length > 0
          ? Math.max(...ceoCriteria.map(c => c.order))
          : 0;

        const { data, error } = await supabase
          .from('department_criteria')
          .insert({
            department_id: null,
            title: ceoFormData.title.trim(),
            description: ceoFormData.description.trim(),
            weight,
            order: maxOrder + 1,
            is_active: ceoFormData.is_active,
            created_by: user?.id || null,
          })
          .select()
          .single();

        if (error) { setCeoFormError(error.message); setCeoSaving(false); return; }

        if (user && data) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'إضافة معيار خاص بتقييم المديرين',
            entity_type: 'department_criteria',
            entity_id: data.id,
            details: { title: ceoFormData.title, weight },
          });
        }
      }

      setIsCeoModalOpen(false);
      setEditingCeoCriterion(null);
      fetchDepartmentsAndCriteria();
    } catch (error) {
      console.error('Error saving CEO criterion:', error);
      setCeoFormError('حدث خطأ أثناء الحفظ');
    } finally {
      setCeoSaving(false);
    }
  };

  const confirmCeoDelete = (criterion: DeptCriterion) => {
    setCeoDeleteTarget(criterion);
    setCeoDeleteError('');
    setIsCeoDeleteModalOpen(true);
  };

  const handleCeoDelete = async () => {
    if (!ceoDeleteTarget) return;
    setCeoDeleting(true);

    try {
      const { error } = await supabase
        .from('department_criteria')
        .delete()
        .eq('id', ceoDeleteTarget.id);

      if (error) { setCeoDeleteError('فشل حذف المعيار.'); setCeoDeleting(false); return; }

      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'حذف معيار خاص بتقييم المديرين',
          entity_type: 'department_criteria',
          entity_id: ceoDeleteTarget.id,
          details: { title: ceoDeleteTarget.title },
        });
      }

      setIsCeoDeleteModalOpen(false);
      setCeoDeleteTarget(null);
      fetchDepartmentsAndCriteria();
    } catch (error) {
      console.error('Error deleting CEO criterion:', error);
    } finally {
      setCeoDeleting(false);
    }
  };

  const handleCeoToggleActive = async (criterion: DeptCriterion) => {
    const newActive = !criterion.is_active;
    const { error } = await supabase
      .from('department_criteria')
      .update({ is_active: newActive })
      .eq('id', criterion.id);

    if (!error) {
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: newActive ? 'تفعيل معيار خاص بتقييم المديرين' : 'تعطيل معيار خاص بتقييم المديرين',
          entity_type: 'department_criteria',
          entity_id: criterion.id,
          details: { title: criterion.title, is_active: newActive },
        });
      }
      fetchDepartmentsAndCriteria();
    }
  };

  const handleCeoReorder = async (criterion: DeptCriterion, direction: 'up' | 'down') => {
    const currentIndex = ceoCriteria.findIndex(c => c.id === criterion.id);
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= ceoCriteria.length) return;

    const swapCriterion = ceoCriteria[swapIndex];
    await Promise.all([
      supabase.from('department_criteria').update({ order: swapCriterion.order }).eq('id', criterion.id),
      supabase.from('department_criteria').update({ order: criterion.order }).eq('id', swapCriterion.id),
    ]);
    fetchDepartmentsAndCriteria();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">جاري التحميل...</div>;
  }

  const activeCount = criteria.filter(c => c.is_active).length;
  const inactiveCount = criteria.filter(c => !c.is_active).length;

  const filteredDirs = selectedDirId === 'all' ? directorates : directorates.filter(d => d.id === selectedDirId);

  return (
    <div className="space-y-6">
      <div
        className="rounded-ds-xl p-8"
        style={{
          background: 'var(--sc-amber-grad)',
          border: '1px solid var(--sc-amber-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-amber-val)' }}>إدارة المعايير</h1>
        <p className="mt-2" style={{ color: 'var(--sc-amber-label)' }}>إدارة معايير التقييم العامة والخاصة بالإدارات</p>
      </div>

      <div className="flex gap-1 border-b border-ds-border">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'general'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-ds-faint hover:text-ds-muted'
          }`}
        >
          المعايير العامة ({generalWeightLimit}%)
        </button>
        <button
          onClick={() => setActiveTab('ceo')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'ceo'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-ds-faint hover:text-ds-muted'
          }`}
        >
          المعايير الخاصة بالإدارة العليا ({ceoCriteria.filter(c => c.is_active).reduce((s, c) => s + c.weight, 0)}%)
        </button>
        <button
          onClick={() => setActiveTab('departments')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'departments'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-ds-faint hover:text-ds-muted'
          }`}
        >
          المعايير الخاصة بالإدارات ({specificWeightLimit}%)
        </button>
        <button
          onClick={() => setActiveTab('supervisors')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'supervisors'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-ds-faint hover:text-ds-muted'
          }`}
        >
          المعايير الخاصة بالمشرفين ({supCriteria.filter(c => c.is_active).reduce((s, c) => s + c.weight, 0)}%)
        </button>
        <button
          onClick={() => setActiveTab('ceo-eval')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'ceo-eval'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-ds-faint hover:text-ds-muted'
          }`}
        >
          معايير تقييم الموظفين للرؤساء ({ceoEvalTotalWeight}%)
        </button>
      </div>

      {activeTab === 'general' && (<>
      <div className="flex items-center justify-end">
        <Button onClick={openAddModal} className="flex items-center gap-2">
          <span>إضافة معيار</span>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ds-muted mb-1">معايير نشطة</p>
                <p className="text-xl font-bold text-ds-text">{activeCount}</p>
              </div>
              <div className="bg-green-50 text-green-600 p-3 rounded-xl">
                <ClipboardList className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ds-muted mb-1">معايير معطلة</p>
                <p className="text-xl font-bold text-ds-text">{inactiveCount}</p>
              </div>
              <div className="bg-ds-overlay text-ds-faint p-3 rounded-xl">
                <EyeOff className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ds-muted mb-1">مجموع الأوزان (النشطة)</p>
                <p className={`text-xl font-bold ${totalWeight === generalWeightLimit ? 'text-green-600' : 'text-red-600'}`}>
                  {totalWeight}% / {generalWeightLimit}%
                </p>
              </div>
              <div className={`p-3 rounded-xl ${totalWeight === generalWeightLimit ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                <Scale className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {totalWeight !== generalWeightLimit && criteria.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-amber-800 text-sm">
            مجموع أوزان المعايير العامة النشطة يجب أن يساوي {generalWeightLimit}% (النسبة المخصصة من الإعدادات). المجموع الحالي: <span className="font-bold">{totalWeight}%</span>
          </p>
        </div>
      )}

      <Card>
        <CardBody className="p-0">
          {criteria.length === 0 ? (
            <EmptyState
              message="لا توجد معايير تقييم مضافة حاليًا"
              icon={<ClipboardList className="h-12 w-12 text-ds-faint" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"> </TableHead>
                  <TableHead>المعيار</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الترتيب</TableHead>
                  <TableHead>الوزن</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {criteria.map((criterion, index) => {
                  const isExpanded = expandedCriterionId === criterion.id;
                  const stop = (e: React.MouseEvent) => e.stopPropagation();
                  return (
                    <React.Fragment key={criterion.id}>
                      <TableRow
                        className={`${!criterion.is_active ? 'opacity-60 bg-ds-bg' : ''} ${isExpanded ? 'bg-blue-50/40' : ''}`}
                        onClick={() => setExpandedCriterionId(isExpanded ? null : criterion.id)}
                      >
                        <TableCell className="text-ds-faint">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <span className="font-bold text-ds-text">{criterion.title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-ds-faint text-sm max-w-xs truncate">{criterion.description}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={criterion.is_active ? 'success' : 'default'}>
                            {criterion.is_active ? 'نشط' : 'معطل'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1" onClick={stop}>
                            <button
                              onClick={() => handleReorder(criterion, 'up')}
                              disabled={index === 0}
                              className="p-1 rounded hover:bg-ds-overlay disabled:opacity-30 disabled:cursor-not-allowed text-ds-faint"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <span className="text-ds-faint text-sm font-mono w-6 text-center">{criterion.order}</span>
                            <button
                              onClick={() => handleReorder(criterion, 'down')}
                              disabled={index === criteria.length - 1}
                              className="p-1 rounded hover:bg-ds-overlay disabled:opacity-30 disabled:cursor-not-allowed text-ds-faint"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${criterion.weight}%` }}
                              />
                            </div>
                            <span className="font-bold text-blue-600">{criterion.weight}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2" onClick={stop}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditModal(criterion)}
                              className="flex items-center gap-1"
                            >
                              <Edit className="h-4 w-4" />
                              <span>تعديل</span>
                            </Button>
                            <div className="ml-auto" />
                            <Toggle
                              checked={criterion.is_active}
                              onChange={() => handleToggleActive(criterion)}
                              size="sm"
                            />
                            {criterion.score_count === 0 && (
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => confirmDelete(criterion)}
                                className="flex items-center gap-1"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-blue-50/40">
                          <TableCell colSpan={7} className="!whitespace-normal">
                            <div className="px-2 py-1">
                              <p className="text-xs font-semibold text-blue-700 mb-1">الوصف الكامل</p>
                              <p className="text-sm text-ds-muted leading-relaxed whitespace-pre-wrap">{criterion.description}</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      </>)}

      {activeTab === 'departments' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ds-muted mb-1">وزن المعايير الخاصة</p>
                    <p className="text-xl font-bold text-emerald-600">{specificWeightLimit}%</p>
                  </div>
                  <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
                    <Scale className="h-6 w-6" />
                  </div>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ds-muted mb-1">عدد الإدارات</p>
                    <p className="text-xl font-bold text-ds-text">{directorates.length}</p>
                  </div>
                  <div className="bg-ds-overlay text-ds-muted p-3 rounded-xl">
                    <Building2 className="h-6 w-6" />
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-ds-faint" />
            <label className="text-sm font-medium text-ds-muted">عرض المعايير الخاصة لـ:</label>
            <ModernSelect
              value={selectedDirId}
              onChange={setSelectedDirId}
              ariaLabel="تصفية الإدارة"
              className="min-w-[260px]"
              options={[
                { value: 'all', label: 'جميع الإدارات' },
                ...directorates.map(dir => ({ value: dir.id, label: dir.name })),
              ]}
            />
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
            <Shield className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <p className="text-emerald-800 text-sm">
              هذه المعايير يتم إنشاؤها وإدارتها بواسطة مديري الإدارات وتستخدم في تقييم الموظفين التابعين لهم.
            </p>
          </div>

          {filteredDirs.map(dir => {
            const dirGroups = groupsByDirectorate[dir.id] || [];
            return (
              <div key={dir.id} className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-xl font-bold text-ds-text">{dir.name}</h2>
                    <Badge variant="info" size="sm">{dirGroups.length} مجموعة</Badge>
                  </div>
                  <Button size="sm" onClick={() => openDirGroupCreateModal(dir.id)} className="flex items-center gap-1">
                    <Plus className="h-4 w-4" /><span>إضافة مجموعة</span>
                  </Button>
                </div>

                {dirGroups.length === 0 ? (
                  <Card>
                    <CardBody>
                      <p className="text-sm text-ds-faint text-center py-4">
                        لم يتم تكوين أي مجموعة معايير لهذه الإدارة بعد
                      </p>
                    </CardBody>
                  </Card>
                ) : (
                  dirGroups.map(group => {
                    const list = criteriaByGroup[group.id] || [];
                    const groupMembers = membersByGroup[group.id] || [];
                    const active = list.filter(c => c.is_active);
                    const total = active.reduce((s, c) => s + c.weight, 0);
                    return (
                      <Card key={group.id}>
                        <CardBody className="p-0">
                          <div className="px-6 py-4 border-b border-ds-border-subtle flex items-start justify-between gap-4 flex-wrap">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                <h3 className="text-lg font-bold text-ds-text">{group.name}</h3>
                                {group.is_default && <Badge variant="info" size="sm">افتراضية</Badge>}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-ds-muted">
                                <Shield className="h-4 w-4" />
                                {groupMembers.length === 0 ? (
                                  <span className="text-amber-600">لا يوجد موظفون مرتبطون</span>
                                ) : (
                                  <span>{groupMembers.length} موظف: {groupMembers.map(m => m.full_name).join('، ')}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={total === specificWeightLimit ? 'success' : 'warning'} size="sm">
                                المجموع: {total}% / {specificWeightLimit}%
                              </Badge>
                              <Badge variant="info" size="sm">{active.length} معيار نشط</Badge>
                              <Button size="sm" variant="outline" onClick={() => openDirGroupEditModal(group)} className="flex items-center gap-1">
                                <Edit className="h-4 w-4" /><span>تعديل</span>
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => openDirCriterionAddModal(group)} className="flex items-center gap-1">
                                <Plus className="h-4 w-4" /><span>إضافة معيار</span>
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => confirmDeleteDirGroup(group)} className="flex items-center gap-1">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {list.length === 0 ? (
                            <div className="p-6 text-center text-ds-faint text-sm">
                              لا توجد معايير في هذه المجموعة بعد
                            </div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>المعيار</TableHead>
                                  <TableHead>الوصف</TableHead>
                                  <TableHead>الحالة</TableHead>
                                  <TableHead>الترتيب</TableHead>
                                  <TableHead>الوزن</TableHead>
                                  <TableHead>الإجراءات</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {list.map((c, index) => {
                                  const isExpanded = expandedCriterionId === c.id;
                                  const stop = (e: React.MouseEvent) => e.stopPropagation();
                                  return (
                                    <React.Fragment key={c.id}>
                                      <TableRow
                                        className={`${!c.is_active ? 'opacity-60 bg-ds-bg' : ''} ${isExpanded ? 'bg-emerald-50/40' : ''}`}
                                        onClick={() => setExpandedCriterionId(isExpanded ? null : c.id)}
                                      >
                                        <TableCell>
                                          <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </div>
                                            <span className="font-bold text-ds-text">{c.title}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <p className="text-ds-faint text-sm max-w-xs truncate">{c.description}</p>
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant={c.is_active ? 'success' : 'default'}>
                                            {c.is_active ? 'نشط' : 'معطل'}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex items-center gap-1" onClick={stop}>
                                            <button onClick={() => handleDirCriterionReorder(c, 'up')} disabled={index === 0}
                                              className="p-1 rounded hover:bg-ds-overlay disabled:opacity-30 disabled:cursor-not-allowed text-ds-faint">
                                              <ArrowUp className="h-4 w-4" />
                                            </button>
                                            <span className="text-ds-faint text-sm font-mono w-6 text-center">{c.order}</span>
                                            <button onClick={() => handleDirCriterionReorder(c, 'down')} disabled={index === list.length - 1}
                                              className="p-1 rounded hover:bg-ds-overlay disabled:opacity-30 disabled:cursor-not-allowed text-ds-faint">
                                              <ArrowDown className="h-4 w-4" />
                                            </button>
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex items-center gap-2">
                                            <div className="w-16 bg-gray-200 rounded-full h-2">
                                              <div className="bg-emerald-500 h-2 rounded-full transition-all"
                                                style={{ width: `${(c.weight / specificWeightLimit) * 100}%` }} />
                                            </div>
                                            <span className="font-bold text-emerald-600">{c.weight}%</span>
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex items-center gap-2" onClick={stop}>
                                            <Button size="sm" variant="outline" onClick={() => openDirCriterionEditModal(c)} className="flex items-center gap-1">
                                              <Edit className="h-4 w-4" /><span>تعديل</span>
                                            </Button>
                                            <Toggle checked={c.is_active} onChange={() => handleDirCriterionToggle(c)} size="sm" />
                                            <Button size="sm" variant="danger" onClick={() => confirmDeleteDirCriterion(c)} className="flex items-center gap-1">
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                      {isExpanded && (
                                        <TableRow className="bg-emerald-50/40">
                                          <TableCell colSpan={6} className="!whitespace-normal">
                                            <div className="px-2 py-1">
                                              <p className="text-xs font-semibold text-emerald-700 mb-1">الوصف الكامل</p>
                                              <p className="text-sm text-ds-muted leading-relaxed whitespace-pre-wrap">{c.description}</p>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          )}
                        </CardBody>
                      </Card>
                    );
                  })
                )}
              </div>
            );
          })}
        </>
      )}

      {activeTab === 'ceo' && (
        <>
          <div className="flex items-center justify-end">
            <Button onClick={openCeoAddModal} className="flex items-center gap-2">
              <span>إضافة معيار</span>
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ds-muted mb-1">معايير نشطة</p>
                    <p className="text-xl font-bold text-ds-text">{ceoCriteria.filter(c => c.is_active).length}</p>
                  </div>
                  <div className="bg-green-50 text-green-600 p-3 rounded-xl">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ds-muted mb-1">معايير معطلة</p>
                    <p className="text-xl font-bold text-ds-text">{ceoCriteria.filter(c => !c.is_active).length}</p>
                  </div>
                  <div className="bg-ds-overlay text-ds-faint p-3 rounded-xl">
                    <EyeOff className="h-6 w-6" />
                  </div>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ds-muted mb-1">مجموع الأوزان (النشطة)</p>
                    <p className={`text-xl font-bold ${ceoTotalWeight === specificWeightLimit ? 'text-green-600' : 'text-red-600'}`}>
                      {ceoTotalWeight}% / {specificWeightLimit}%
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl ${ceoTotalWeight === specificWeightLimit ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    <Scale className="h-6 w-6" />
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {ceoTotalWeight !== specificWeightLimit && ceoCriteria.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <p className="text-amber-800 text-sm">
                مجموع أوزان المعايير الخاصة النشطة يجب أن يساوي {specificWeightLimit}% (النسبة المخصصة من الإعدادات). المجموع الحالي: <span className="font-bold">{ceoTotalWeight}%</span>
              </p>
            </div>
          )}

          <Card>
            <CardBody className="p-0">
              {ceoCriteria.length === 0 ? (
                <EmptyState
                  message="لا توجد معايير خاصة مضافة لتقييم المديرين حاليًا"
                  icon={<ClipboardList className="h-12 w-12 text-ds-faint" />}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"> </TableHead>
                      <TableHead>المعيار</TableHead>
                      <TableHead>الوصف</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الترتيب</TableHead>
                      <TableHead>الوزن</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ceoCriteria.map((criterion, index) => {
                      const isExpanded = expandedCriterionId === criterion.id;
                      const stop = (e: React.MouseEvent) => e.stopPropagation();
                      return (
                        <React.Fragment key={criterion.id}>
                          <TableRow
                            className={`${!criterion.is_active ? 'opacity-60 bg-ds-bg' : ''} ${isExpanded ? 'bg-purple-50/40' : ''}`}
                            onClick={() => setExpandedCriterionId(isExpanded ? null : criterion.id)}
                          >
                            <TableCell className="text-ds-faint">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <span className="font-bold text-ds-text">{criterion.title}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-ds-faint text-sm max-w-xs truncate">{criterion.description}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant={criterion.is_active ? 'success' : 'default'}>
                                {criterion.is_active ? 'نشط' : 'معطل'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1" onClick={stop}>
                                <button
                                  onClick={() => handleCeoReorder(criterion, 'up')}
                                  disabled={index === 0}
                                  className="p-1 rounded hover:bg-ds-overlay disabled:opacity-30 disabled:cursor-not-allowed text-ds-faint"
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </button>
                                <span className="text-ds-faint text-sm font-mono w-6 text-center">{criterion.order}</span>
                                <button
                                  onClick={() => handleCeoReorder(criterion, 'down')}
                                  disabled={index === ceoCriteria.length - 1}
                                  className="p-1 rounded hover:bg-ds-overlay disabled:opacity-30 disabled:cursor-not-allowed text-ds-faint"
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-purple-600 h-2 rounded-full transition-all"
                                    style={{ width: `${(criterion.weight / specificWeightLimit) * 100}%` }}
                                  />
                                </div>
                                <span className="font-bold text-purple-600">{criterion.weight}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2" onClick={stop}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openCeoEditModal(criterion)}
                                  className="flex items-center gap-1"
                                >
                                  <Edit className="h-4 w-4" />
                                  <span>تعديل</span>
                                </Button>
                                <Toggle
                                  checked={criterion.is_active}
                                  onChange={() => handleCeoToggleActive(criterion)}
                                  size="sm"
                                />
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => confirmCeoDelete(criterion)}
                                  className="flex items-center gap-1"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="bg-purple-50/40">
                              <TableCell colSpan={7} className="!whitespace-normal">
                                <div className="px-2 py-1">
                                  <p className="text-xs font-semibold text-purple-700 mb-1">الوصف الكامل</p>
                                  <p className="text-sm text-ds-muted leading-relaxed whitespace-pre-wrap">{criterion.description}</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {activeTab === 'supervisors' && (
        <>
          {supAssignments.length > 1 && (
            <ModernSelect
              value={selectedSupAssignment}
              onChange={setSelectedSupAssignment}
              ariaLabel="مهمة المشرف"
              className="min-w-[260px]"
              options={supAssignments.map(a => ({
                value: a.id,
                label: `${a.user?.full_name}${a.title ? ` — ${a.title}` : ''}`,
              }))}
            />
          )}
          {supAssignments.length === 1 && (
            <p className="text-sm text-ds-muted">
              المشرف: <span className="font-bold text-ds-text">{supAssignments[0].user?.full_name}</span>
              {supAssignments[0].title && <span> — {supAssignments[0].title}</span>}
            </p>
          )}

          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 flex items-center gap-3">
            <Shield className="h-5 w-5 text-teal-600 flex-shrink-0" />
            <p className="text-teal-800 text-sm">
              هذه المعايير يتم إنشاؤها وإدارتها بواسطة المشرفين وتستخدم في تقييم الموظفين التابعين لهم.
            </p>
          </div>

          {supAssignments.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  message="لا يوجد مشرفون مُعيَّنون حاليًا"
                  icon={<Shield className="h-12 w-12 text-ds-faint" />}
                />
              </CardBody>
            </Card>
          ) : supGroups.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  message="لم يقم المشرف بإنشاء أي مجموعة معايير بعد"
                  icon={<ClipboardList className="h-12 w-12 text-ds-faint" />}
                />
              </CardBody>
            </Card>
          ) : (
            supGroups.map(group => {
              const list = supCriteria.filter(c => c.group_id === group.id);
              const groupMembers = supGroupMembers.filter(m => m.group_id === group.id);
              const total = list.filter(c => c.is_active).reduce((s, c) => s + c.weight, 0);
              return (
                <Card key={group.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="w-3 h-3 rounded-full bg-teal-500" />
                        <h2 className="text-lg font-bold text-ds-text">{group.name}</h2>
                        {group.is_default && <Badge variant="info" size="sm">افتراضية</Badge>}
                        <span className="text-sm text-ds-muted">
                          {groupMembers.length === 0
                            ? 'بدون موظفين'
                            : `${groupMembers.length} موظف: ${groupMembers.map(m => m.employee?.full_name || '').join('، ')}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={total === specificWeightLimit ? 'success' : 'warning'} size="sm">
                          المجموع: {total}% / {specificWeightLimit}%
                        </Badge>
                        <Badge variant="info" size="sm">
                          {list.filter(c => c.is_active).length} معيار نشط
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardBody className="p-0">
                    {list.length === 0 ? (
                      <div className="p-6 text-center text-ds-faint text-sm">
                        لا توجد معايير في هذه المجموعة
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8"> </TableHead>
                            <TableHead>المعيار</TableHead>
                            <TableHead>الوصف</TableHead>
                            <TableHead>الحالة</TableHead>
                            <TableHead>الوزن</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {list.map(c => {
                            const isExpanded = expandedCriterionId === c.id;
                            return (
                              <React.Fragment key={c.id}>
                                <TableRow
                                  className={`${!c.is_active ? 'opacity-60 bg-ds-bg' : ''} ${isExpanded ? 'bg-teal-50/40' : ''}`}
                                  onClick={() => setExpandedCriterionId(isExpanded ? null : c.id)}
                                >
                                  <TableCell className="text-ds-faint">
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </TableCell>
                                  <TableCell>
                                    <span className="font-bold text-ds-text">{c.title}</span>
                                  </TableCell>
                                  <TableCell>
                                    <p className="text-ds-faint text-sm max-w-xs truncate">{c.description}</p>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={c.is_active ? 'success' : 'default'} size="sm">
                                      {c.is_active ? 'نشط' : 'معطل'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <span className="font-bold text-teal-600">{c.weight}%</span>
                                  </TableCell>
                                </TableRow>
                                {isExpanded && (
                                  <TableRow className="bg-teal-50/40">
                                    <TableCell colSpan={5} className="!whitespace-normal">
                                      <div className="px-2 py-1">
                                        <p className="text-xs font-semibold text-teal-700 mb-1">الوصف الكامل</p>
                                        <p className="text-sm text-ds-muted leading-relaxed whitespace-pre-wrap">{c.description}</p>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardBody>
                </Card>
              );
            })
          )}
        </>
      )}

      {activeTab === 'ceo-eval' && (
        <>
          <div className="flex items-center justify-end">
            <Button onClick={() => { setEditingCeoEvalCriterion(null); setCeoEvalFormData(defaultFormData); setCeoEvalFormError(''); setIsCeoEvalModalOpen(true); }} className="flex items-center gap-2">
              <span>إضافة معيار</span>
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
            <Shield className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <p className="text-amber-800 text-sm">
              هذه المعايير تُستخدم من قبل جميع الموظفين لتقييم أداء أعضاء الإدارة العليا بشكل ربعي ومجهول. يتم إنشاؤها وإدارتها بواسطة الموارد البشرية فقط.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ds-muted mb-1">معايير نشطة</p>
                    <p className="text-xl font-bold text-ds-text">{ceoEvalCriteria.filter(c => c.is_active).length}</p>
                  </div>
                  <div className="bg-green-50 text-green-600 p-3 rounded-xl"><ClipboardList className="h-6 w-6" /></div>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ds-muted mb-1">معايير معطلة</p>
                    <p className="text-xl font-bold text-ds-text">{ceoEvalCriteria.filter(c => !c.is_active).length}</p>
                  </div>
                  <div className="bg-ds-overlay text-ds-faint p-3 rounded-xl"><EyeOff className="h-6 w-6" /></div>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ds-muted mb-1">مجموع الأوزان (النشطة)</p>
                    <p className={`text-xl font-bold ${ceoEvalTotalWeight === 100 ? 'text-green-600' : 'text-red-600'}`}>
                      {ceoEvalTotalWeight}% / 100%
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl ${ceoEvalTotalWeight === 100 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    <Scale className="h-6 w-6" />
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {ceoEvalTotalWeight !== 100 && ceoEvalCriteria.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <p className="text-amber-800 text-sm">
                مجموع أوزان المعايير النشطة يجب أن يساوي 100%. المجموع الحالي: <span className="font-bold">{ceoEvalTotalWeight}%</span>
              </p>
            </div>
          )}

          <Card>
            <CardBody className="p-0">
              {ceoEvalCriteria.length === 0 ? (
                <EmptyState message="لا توجد معايير مضافة لتقييم الإدارة العليا" icon={<ClipboardList className="h-12 w-12 text-ds-faint" />} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"> </TableHead>
                      <TableHead>المعيار</TableHead>
                      <TableHead>الوصف</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الترتيب</TableHead>
                      <TableHead>الوزن</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ceoEvalCriteria.map((criterion, index) => {
                      const isExpanded = expandedCriterionId === criterion.id;
                      const stop = (e: React.MouseEvent) => e.stopPropagation();
                      return (
                        <React.Fragment key={criterion.id}>
                          <TableRow
                            className={`${!criterion.is_active ? 'opacity-60 bg-ds-bg' : ''} ${isExpanded ? 'bg-amber-50/40' : ''}`}
                            onClick={() => setExpandedCriterionId(isExpanded ? null : criterion.id)}
                          >
                            <TableCell className="text-ds-faint">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <span className="font-bold text-ds-text">{criterion.title}</span>
                              </div>
                            </TableCell>
                            <TableCell><p className="text-ds-faint text-sm max-w-xs truncate">{criterion.description}</p></TableCell>
                            <TableCell><Badge variant={criterion.is_active ? 'success' : 'default'}>{criterion.is_active ? 'نشط' : 'معطل'}</Badge></TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1" onClick={stop}>
                                <button onClick={() => handleCeoEvalReorder(criterion, 'up')} disabled={index === 0} className="p-1 rounded hover:bg-ds-overlay disabled:opacity-30 disabled:cursor-not-allowed text-ds-faint"><ArrowUp className="h-4 w-4" /></button>
                                <span className="text-ds-faint text-sm font-mono w-6 text-center">{criterion.order}</span>
                                <button onClick={() => handleCeoEvalReorder(criterion, 'down')} disabled={index === ceoEvalCriteria.length - 1} className="p-1 rounded hover:bg-ds-overlay disabled:opacity-30 disabled:cursor-not-allowed text-ds-faint"><ArrowDown className="h-4 w-4" /></button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-gray-200 rounded-full h-2"><div className="bg-amber-600 h-2 rounded-full transition-all" style={{ width: `${criterion.weight}%` }} /></div>
                                <span className="font-bold text-amber-600">{criterion.weight}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2" onClick={stop}>
                                <Button size="sm" variant="outline" onClick={() => { setEditingCeoEvalCriterion(criterion); setCeoEvalFormData({ title: criterion.title, description: criterion.description, weight: criterion.weight.toString(), is_active: criterion.is_active }); setCeoEvalFormError(''); setIsCeoEvalModalOpen(true); }} className="flex items-center gap-1"><Edit className="h-4 w-4" /><span>تعديل</span></Button>
                                <Toggle checked={criterion.is_active} onChange={() => handleCeoEvalToggleActive(criterion)} size="sm" />
                                <Button size="sm" variant="danger" onClick={() => { setCeoEvalDeleteTarget(criterion); setCeoEvalDeleteError(''); setIsCeoEvalDeleteModalOpen(true); }} className="flex items-center gap-1"><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="bg-amber-50/40">
                              <TableCell colSpan={7} className="!whitespace-normal">
                                <div className="px-2 py-1">
                                  <p className="text-xs font-semibold text-amber-700 mb-1">الوصف الكامل</p>
                                  <p className="text-sm text-ds-muted leading-relaxed whitespace-pre-wrap">{criterion.description}</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCriterion ? 'تعديل معيار التقييم' : 'إضافة معيار تقييم جديد'}
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {formError}
              </div>
            )}

            <Input
              label="عنوان المعيار"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="مثال: الأداء الوظيفي"
              required
            />

            <TextArea
              label="وصف المعيار"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="وصف مختصر لما يقيسه هذا المعيار"
              rows={3}
              required
            />

            <Input
              label="الوزن (%)"
              type="number"
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
              placeholder="مثال: 40"
              min={1}
              max={100}
              step={0.5}
              required
              helperText={`مجموع أوزان المعايير النشطة الحالي: ${totalWeight}% من ${generalWeightLimit}%`}
            />

            {editingCriterion && (
              <div className="flex items-center justify-between p-3 bg-ds-bg rounded-lg">
                <Toggle
                  checked={formData.is_active}
                  onChange={() => setFormData({ ...formData, is_active: !formData.is_active })}
                />
                <span className="text-sm font-medium text-ds-muted">
                  {formData.is_active ? 'المعيار نشط' : 'المعيار معطل'}
                </span>
              </div>
            )}
          </div>

          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" loading={saving}>
              {editingCriterion ? 'تحديث' : 'إضافة'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="تأكيد الحذف"
      >
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-ds-text text-lg font-medium mb-2">
            هل أنت متأكد من حذف هذا المعيار؟
          </p>
          <p className="text-ds-faint text-sm">
            سيتم حذف معيار{' '}
            <span className="font-bold text-ds-muted">
              {deleteTarget?.title}
            </span>{' '}
            نهائيًا.
          </p>
          {deleteError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm w-full">
              {deleteError}
            </div>
          )}
        </div>
        <ModalFooter className="justify-center">
          <Button type="button" variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
            إلغاء
          </Button>
          <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
            <span className="flex items-center gap-1">
              <Trash2 className="h-4 w-4" />
              <span>حذف المعيار</span>
            </span>
          </Button>
        </ModalFooter>
      </Modal>

      {/* CEO criteria modal */}
      <Modal
        isOpen={isCeoModalOpen}
        onClose={() => setIsCeoModalOpen(false)}
        title={editingCeoCriterion ? 'تعديل معيار تقييم المديرين' : 'إضافة معيار تقييم مديرين جديد'}
      >
        <form onSubmit={handleCeoSubmit}>
          <div className="space-y-4">
            {ceoFormError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {ceoFormError}
              </div>
            )}
            <Input
              label="عنوان المعيار"
              value={ceoFormData.title}
              onChange={(e) => setCeoFormData({ ...ceoFormData, title: e.target.value })}
              placeholder="مثال: القيادة الاستراتيجية"
              required
            />
            <TextArea
              label="وصف المعيار"
              value={ceoFormData.description}
              onChange={(e) => setCeoFormData({ ...ceoFormData, description: e.target.value })}
              placeholder="وصف مختصر لما يقيسه هذا المعيار"
              rows={3}
              required
            />
            <Input
              label="الوزن (%)"
              type="number"
              value={ceoFormData.weight}
              onChange={(e) => setCeoFormData({ ...ceoFormData, weight: e.target.value })}
              placeholder="مثال: 10"
              min={1}
              max={specificWeightLimit}
              step={0.5}
              required
              helperText={`مجموع أوزان المعايير الخاصة النشطة الحالي: ${ceoTotalWeight}% من ${specificWeightLimit}%`}
            />
            {editingCeoCriterion && (
              <div className="flex items-center justify-between p-3 bg-ds-bg rounded-lg">
                <Toggle
                  checked={ceoFormData.is_active}
                  onChange={() => setCeoFormData({ ...ceoFormData, is_active: !ceoFormData.is_active })}
                  size="sm"
                />
                <span className="text-sm font-medium text-ds-muted">
                  {ceoFormData.is_active ? 'المعيار نشط' : 'المعيار معطل'}
                </span>
              </div>
            )}
          </div>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsCeoModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" loading={ceoSaving}>
              {editingCeoCriterion ? 'تحديث' : 'إضافة'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* CEO criteria delete confirmation */}
      <Modal
        isOpen={isCeoDeleteModalOpen}
        onClose={() => setIsCeoDeleteModalOpen(false)}
        title="تأكيد الحذف"
      >
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-ds-text text-lg font-medium mb-2">هل أنت متأكد من حذف هذا المعيار؟</p>
          <p className="text-ds-faint text-sm">
            سيتم حذف معيار <span className="font-bold text-ds-muted">{ceoDeleteTarget?.title}</span> نهائيًا.
          </p>
          {ceoDeleteError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm w-full">
              {ceoDeleteError}
            </div>
          )}
        </div>
        <ModalFooter className="justify-center">
          <Button type="button" variant="secondary" onClick={() => setIsCeoDeleteModalOpen(false)}>
            إلغاء
          </Button>
          <Button type="button" variant="danger" onClick={handleCeoDelete} loading={ceoDeleting}>
            <span className="flex items-center gap-1">
              <Trash2 className="h-4 w-4" />
              <span>حذف المعيار</span>
            </span>
          </Button>
        </ModalFooter>
      </Modal>

      {/* CEO evaluation criteria modal (employees evaluating CEOs) */}
      <Modal
        isOpen={isCeoEvalModalOpen}
        onClose={() => setIsCeoEvalModalOpen(false)}
        title={editingCeoEvalCriterion ? 'تعديل معيار تقييم الإدارة العليا' : 'إضافة معيار تقييم الإدارة العليا'}
      >
        <form onSubmit={handleCeoEvalSubmit}>
          <div className="space-y-4">
            {ceoEvalFormError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {ceoEvalFormError}
              </div>
            )}
            <Input
              label="عنوان المعيار"
              value={ceoEvalFormData.title}
              onChange={(e) => setCeoEvalFormData({ ...ceoEvalFormData, title: e.target.value })}
              placeholder="مثال: التواصل مع الموظفين"
              required
            />
            <TextArea
              label="وصف المعيار"
              value={ceoEvalFormData.description}
              onChange={(e) => setCeoEvalFormData({ ...ceoEvalFormData, description: e.target.value })}
              placeholder="وصف مختصر لما يقيسه هذا المعيار"
              rows={3}
              required
            />
            <Input
              label="الوزن (%)"
              type="number"
              value={ceoEvalFormData.weight}
              onChange={(e) => setCeoEvalFormData({ ...ceoEvalFormData, weight: e.target.value })}
              placeholder="مثال: 20"
              min={1}
              max={100}
              step={0.5}
              required
              helperText={`مجموع أوزان المعايير النشطة الحالي: ${ceoEvalTotalWeight}% من 100%`}
            />
            {editingCeoEvalCriterion && (
              <div className="flex items-center justify-between p-3 bg-ds-bg rounded-lg">
                <Toggle
                  checked={ceoEvalFormData.is_active}
                  onChange={() => setCeoEvalFormData({ ...ceoEvalFormData, is_active: !ceoEvalFormData.is_active })}
                  size="sm"
                />
                <span className="text-sm font-medium text-ds-muted">
                  {ceoEvalFormData.is_active ? 'المعيار نشط' : 'المعيار معطل'}
                </span>
              </div>
            )}
          </div>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsCeoEvalModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" loading={ceoEvalSaving}>
              {editingCeoEvalCriterion ? 'تحديث' : 'إضافة'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* CEO evaluation criteria delete confirmation */}
      <Modal
        isOpen={isCeoEvalDeleteModalOpen}
        onClose={() => setIsCeoEvalDeleteModalOpen(false)}
        title="تأكيد الحذف"
      >
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-ds-text text-lg font-medium mb-2">هل أنت متأكد من حذف هذا المعيار؟</p>
          <p className="text-ds-faint text-sm">
            سيتم حذف معيار <span className="font-bold text-ds-muted">{ceoEvalDeleteTarget?.title}</span> نهائيًا.
          </p>
          {ceoEvalDeleteError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm w-full">
              {ceoEvalDeleteError}
            </div>
          )}
        </div>
        <ModalFooter className="justify-center">
          <Button type="button" variant="secondary" onClick={() => setIsCeoEvalDeleteModalOpen(false)}>
            إلغاء
          </Button>
          <Button type="button" variant="danger" onClick={handleCeoEvalDelete} loading={ceoEvalDeleting}>
            <span className="flex items-center gap-1">
              <Trash2 className="h-4 w-4" />
              <span>حذف المعيار</span>
            </span>
          </Button>
        </ModalFooter>
      </Modal>

      {/* Directorate group create/edit modal (admin) */}
      <Modal
        isOpen={isDirGroupModalOpen}
        onClose={() => setIsDirGroupModalOpen(false)}
        title={editingDirGroup ? 'تعديل مجموعة معايير الإدارة' : 'إضافة مجموعة معايير الإدارة'}
      >
        <form onSubmit={handleSaveDirGroup}>
          <div className="space-y-4">
            {dirGroupError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{dirGroupError}</div>
            )}
            <Input
              label="اسم المجموعة"
              value={dirGroupForm.name}
              onChange={e => setDirGroupForm({ ...dirGroupForm, name: e.target.value })}
              placeholder="مثال: فريق التصميم"
              required
            />
            <div>
              <label className="block text-sm font-medium text-ds-muted mb-2">
                الموظفون المشمولون
                <span className="text-xs text-ds-faint mr-2">— من موظفي هذه الإدارة</span>
              </label>
              <div className="border border-ds-border rounded-lg max-h-64 overflow-y-auto">
                {(employeesByDirectorate[dirGroupCrudDirectorateId] || []).length === 0 ? (
                  <p className="p-4 text-sm text-ds-faint text-center">لا يوجد موظفون في هذه الإدارة بعد</p>
                ) : (
                  (employeesByDirectorate[dirGroupCrudDirectorateId] || []).map(m => {
                    const checked = dirGroupForm.memberIds.has(m.id);
                    const memMap = groupMembershipByDir[dirGroupCrudDirectorateId] || {};
                    const otherGroupId = memMap[m.id];
                    const otherGroup = otherGroupId && otherGroupId !== editingDirGroup?.id
                      ? (groupsByDirectorate[dirGroupCrudDirectorateId] || []).find(g => g.id === otherGroupId)
                      : null;
                    return (
                      <label key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-ds-bg cursor-pointer border-b border-ds-border-subtle last:border-b-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDirGroupMember(m.id)}
                          className="rounded border-ds-border"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ds-text truncate">{m.full_name}</p>
                          <p className="text-xs text-ds-faint truncate">
                            {[m.job_title, m.department_name].filter(Boolean).join(' — ')}
                          </p>
                        </div>
                        {otherGroup && (
                          <Badge variant="warning" size="sm">حالياً في: {otherGroup.name}</Badge>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-ds-faint mt-1">
                إضافة موظف إلى هذه المجموعة سيخرجه من مجموعته السابقة (موظف واحد لمجموعة واحدة فقط لكل إدارة).
              </p>
            </div>
          </div>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsDirGroupModalOpen(false)}>إلغاء</Button>
            <Button type="submit" loading={savingDirGroup}>{editingDirGroup ? 'تحديث' : 'إنشاء'}</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Directorate group delete modal */}
      <Modal isOpen={isDirGroupDeleteOpen} onClose={() => setIsDirGroupDeleteOpen(false)} title="حذف المجموعة">
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-ds-text text-lg font-medium mb-2">هل أنت متأكد من حذف هذه المجموعة؟</p>
          <p className="text-ds-faint text-sm">
            سيتم حذف مجموعة <span className="font-bold text-ds-muted">{dirGroupDeleteTarget?.name}</span> وجميع معاييرها نهائياً.
            الموظفون المرتبطون بها سيصبحون غير مصنّفين.
          </p>
        </div>
        <ModalFooter className="justify-center">
          <Button type="button" variant="secondary" onClick={() => setIsDirGroupDeleteOpen(false)}>إلغاء</Button>
          <Button type="button" variant="danger" onClick={handleDeleteDirGroup} loading={deletingDirGroup}>
            <span className="flex items-center gap-1"><Trash2 className="h-4 w-4" /><span>حذف</span></span>
          </Button>
        </ModalFooter>
      </Modal>

      {/* Directorate criterion create/edit modal */}
      <Modal
        isOpen={isDirCriterionModalOpen}
        onClose={() => setIsDirCriterionModalOpen(false)}
        title={editingDirCriterion ? 'تعديل معيار خاص بالإدارة' : 'إضافة معيار خاص بالإدارة'}
      >
        <form onSubmit={handleSaveDirCriterion}>
          <div className="space-y-4">
            {dirCriterionError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{dirCriterionError}</div>
            )}
            <Input label="عنوان المعيار" value={dirCriterionForm.title}
              onChange={e => setDirCriterionForm({ ...dirCriterionForm, title: e.target.value })}
              placeholder="مثال: جودة العمل" required />
            <TextArea label="وصف المعيار" value={dirCriterionForm.description}
              onChange={e => setDirCriterionForm({ ...dirCriterionForm, description: e.target.value })}
              placeholder="وصف مختصر لما يقيسه هذا المعيار" rows={3} required />
            <Input label="الوزن (%)" type="number" value={dirCriterionForm.weight}
              onChange={e => setDirCriterionForm({ ...dirCriterionForm, weight: e.target.value })}
              placeholder="مثال: 10" min={1} max={specificWeightLimit} step={0.5} required />
            {editingDirCriterion && (
              <div className="flex items-center justify-between p-3 bg-ds-bg rounded-lg">
                <Toggle checked={dirCriterionForm.is_active} onChange={() => setDirCriterionForm({ ...dirCriterionForm, is_active: !dirCriterionForm.is_active })} />
                <span className="text-sm font-medium text-ds-muted">{dirCriterionForm.is_active ? 'المعيار نشط' : 'المعيار معطل'}</span>
              </div>
            )}
          </div>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsDirCriterionModalOpen(false)}>إلغاء</Button>
            <Button type="submit" loading={savingDirCriterion}>{editingDirCriterion ? 'تحديث' : 'إضافة'}</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Directorate criterion delete modal */}
      <Modal isOpen={isDirCriterionDeleteOpen} onClose={() => setIsDirCriterionDeleteOpen(false)} title="تأكيد الحذف">
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-ds-text text-lg font-medium mb-2">هل أنت متأكد من حذف هذا المعيار؟</p>
          <p className="text-ds-faint text-sm">
            سيتم حذف معيار <span className="font-bold text-ds-muted">{dirCriterionDeleteTarget?.title}</span> نهائياً.
          </p>
        </div>
        <ModalFooter className="justify-center">
          <Button type="button" variant="secondary" onClick={() => setIsDirCriterionDeleteOpen(false)}>إلغاء</Button>
          <Button type="button" variant="danger" onClick={handleDeleteDirCriterion} loading={deletingDirCriterion}>
            <span className="flex items-center gap-1"><Trash2 className="h-4 w-4" /><span>حذف المعيار</span></span>
          </Button>
        </ModalFooter>
      </Modal>

    </div>
  );
};
