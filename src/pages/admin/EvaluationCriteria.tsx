import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, TextArea } from '../../components/ui/Input';
import { Modal, ModalFooter } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
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
  title: string;
  description: string;
  weight: number;
  order: number;
  is_active: boolean;
}

interface Directorate {
  id: string;
  name: string;
}

interface DepartmentLite {
  id: string;
  name: string;
  directorate_id: string;
}

interface SupervisorAssignment {
  id: string;
  title: string | null;
  user: { full_name: string } | null;
}

interface SupervisorCriterion {
  id: string;
  assignment_id: string;
  title: string;
  description: string;
  weight: number;
  order: number;
  is_active: boolean;
  created_by: string | null;
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
  const [allDepartments, setAllDepartments] = useState<DepartmentLite[]>([]);
  const [dirCriteriaMap, setDirCriteriaMap] = useState<Record<string, DeptCriterion[]>>({});
  const [deptCriteriaMap, setDeptCriteriaMap] = useState<Record<string, DeptCriterion[]>>({});
  const [selectedDirId, setSelectedDirId] = useState<string>('all');
  const [expandedCriterionId, setExpandedCriterionId] = useState<string | null>(null);
  const [ceoCriteria, setCeoCriteria] = useState<DeptCriterion[]>([]);

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
    const [dirsRes, deptsRes, dirCriteriaRes, deptCriteriaRes, ceoCriteriaRes] = await Promise.all([
      supabase.from('directorates').select('id, name').order('name'),
      supabase.from('departments').select('id, name, directorate_id').eq('status', 'active').order('name'),
      supabase.from('department_criteria').select('*').is('department_id', null).not('directorate_id', 'is', null).order('order'),
      supabase.from('department_criteria').select('*').not('department_id', 'is', null).order('order'),
      supabase.from('department_criteria').select('*').is('department_id', null).is('directorate_id', null).order('order'),
    ]);
    const dirsList = (dirsRes.data as unknown as Directorate[]) || [];
    setDirectorates(dirsList);
    setAllDepartments((deptsRes.data as unknown as DepartmentLite[]) || []);
    const dirMap: Record<string, DeptCriterion[]> = {};
    (dirCriteriaRes.data || []).forEach((c: any) => {
      if (!dirMap[c.directorate_id]) dirMap[c.directorate_id] = [];
      dirMap[c.directorate_id].push(c);
    });
    setDirCriteriaMap(dirMap);
    const deptMap: Record<string, DeptCriterion[]> = {};
    (deptCriteriaRes.data || []).forEach((c: any) => {
      if (!deptMap[c.department_id]) deptMap[c.department_id] = [];
      deptMap[c.department_id].push(c);
    });
    setDeptCriteriaMap(deptMap);
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
    if (!selectedSupAssignment) { setSupCriteria([]); return; }
    const { data } = await supabase
      .from('supervisor_criteria')
      .select('*')
      .eq('assignment_id', selectedSupAssignment)
      .order('order', { ascending: true });
    setSupCriteria((data || []) as SupervisorCriterion[]);
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

    const weight = parseInt(formData.weight);

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
    const weight = parseInt(ceoEvalFormData.weight);
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

  const handleCeoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCeoFormError('');
    setCeoSaving(true);

    const weight = parseInt(ceoFormData.weight);

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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">إدارة المعايير</h1>
        <p className="text-gray-600 mt-2">إدارة معايير التقييم العامة والخاصة بالإدارات</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'general'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          المعايير العامة ({generalWeightLimit}%)
        </button>
        <button
          onClick={() => setActiveTab('ceo')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'ceo'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          المعايير الخاصة بالإدارة العليا ({ceoCriteria.filter(c => c.is_active).reduce((s, c) => s + c.weight, 0)}%)
        </button>
        <button
          onClick={() => setActiveTab('departments')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'departments'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          المعايير الخاصة بالإدارات ({specificWeightLimit}%)
        </button>
        <button
          onClick={() => setActiveTab('supervisors')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'supervisors'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          المعايير الخاصة بالمشرفين ({supCriteria.filter(c => c.is_active).reduce((s, c) => s + c.weight, 0)}%)
        </button>
        <button
          onClick={() => setActiveTab('ceo-eval')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'ceo-eval'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
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
                <p className="text-sm text-gray-600 mb-1">معايير نشطة</p>
                <p className="text-xl font-bold text-gray-900">{activeCount}</p>
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
                <p className="text-sm text-gray-600 mb-1">معايير معطلة</p>
                <p className="text-xl font-bold text-gray-900">{inactiveCount}</p>
              </div>
              <div className="bg-gray-100 text-gray-500 p-3 rounded-xl">
                <EyeOff className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">مجموع الأوزان (النشطة)</p>
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
              icon={<ClipboardList className="h-12 w-12 text-gray-400" />}
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
                        className={`${!criterion.is_active ? 'opacity-60 bg-gray-50' : ''} ${isExpanded ? 'bg-blue-50/40' : ''}`}
                        onClick={() => setExpandedCriterionId(isExpanded ? null : criterion.id)}
                      >
                        <TableCell className="text-gray-400">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <span className="font-bold text-gray-900">{criterion.title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-gray-500 text-sm max-w-xs truncate">{criterion.description}</p>
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
                              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <span className="text-gray-400 text-sm font-mono w-6 text-center">{criterion.order}</span>
                            <button
                              onClick={() => handleReorder(criterion, 'down')}
                              disabled={index === criteria.length - 1}
                              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500"
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
                              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{criterion.description}</p>
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
                    <p className="text-sm text-gray-600 mb-1">وزن المعايير الخاصة</p>
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
                    <p className="text-sm text-gray-600 mb-1">عدد الإدارات</p>
                    <p className="text-xl font-bold text-gray-900">{directorates.length}</p>
                  </div>
                  <div className="bg-gray-100 text-gray-600 p-3 rounded-xl">
                    <Building2 className="h-6 w-6" />
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-gray-500" />
            <label className="text-sm font-medium text-gray-700">عرض المعايير الخاصة لـ:</label>
            <select
              value={selectedDirId}
              onChange={(e) => setSelectedDirId(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">جميع الإدارات</option>
              {directorates.map(dir => (
                <option key={dir.id} value={dir.id}>{dir.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
            <Shield className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <p className="text-emerald-800 text-sm">
              هذه المعايير يتم إنشاؤها وإدارتها بواسطة مديري الإدارات وتستخدم في تقييم الموظفين التابعين لهم.
            </p>
          </div>

          {filteredDirs.flatMap(dir => {
            const dirDepts = allDepartments.filter(d => d.directorate_id === dir.id);
            // For each directorate, emit one card per department (multi-dept) or a single
            // directorate-level card (single/no-dept). Each card has its own weight cap.
            const groups: Array<{ key: string; title: string; subtitle?: string; list: DeptCriterion[] }> =
              dirDepts.length >= 2
                ? dirDepts.map(dep => ({
                    key: `dep-${dep.id}`,
                    title: dir.name,
                    subtitle: dep.name,
                    list: deptCriteriaMap[dep.id] || [],
                  }))
                : [{
                    key: `dir-${dir.id}`,
                    title: dir.name,
                    list: dirCriteriaMap[dir.id] || [],
                  }];

            return groups.map(group => {
              const active = group.list.filter(c => c.is_active);
              const total = active.reduce((s, c) => s + c.weight, 0);
              return (
                <Card key={group.key}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <div>
                          <h2 className="text-lg font-bold text-gray-900">{group.title}</h2>
                          {group.subtitle && (
                            <p className="text-sm text-gray-500 mt-0.5">قسم: {group.subtitle}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={total === specificWeightLimit ? 'success' : 'warning'} size="sm">
                          المجموع: {total}% / {specificWeightLimit}%
                        </Badge>
                        <Badge variant="info" size="sm">
                          {active.length} معيار
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardBody className="p-0">
                    {group.list.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-sm">
                        لم يتم تحديد معايير خاصة لهذا القسم بعد
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
                          {group.list.map(c => {
                            const isExpanded = expandedCriterionId === c.id;
                            return (
                              <React.Fragment key={c.id}>
                                <TableRow
                                  className={!c.is_active ? 'opacity-60 bg-gray-50' : ''}
                                  onClick={() => setExpandedCriterionId(isExpanded ? null : c.id)}
                                >
                                  <TableCell className="text-gray-400">
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </TableCell>
                                  <TableCell>
                                    <span className="font-bold text-gray-900">{c.title}</span>
                                  </TableCell>
                                  <TableCell>
                                    <p className="text-gray-500 text-sm max-w-xs truncate">{c.description}</p>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={c.is_active ? 'success' : 'default'} size="sm">
                                      {c.is_active ? 'نشط' : 'معطل'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <span className="font-bold text-emerald-600">{c.weight}%</span>
                                  </TableCell>
                                </TableRow>
                                {isExpanded && (
                                  <TableRow className="bg-emerald-50/40">
                                    <TableCell colSpan={5} className="!whitespace-normal">
                                      <div className="px-2 py-1">
                                        <p className="text-xs font-semibold text-emerald-700 mb-1">الوصف الكامل</p>
                                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{c.description}</p>
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
            });
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
                    <p className="text-sm text-gray-600 mb-1">معايير نشطة</p>
                    <p className="text-xl font-bold text-gray-900">{ceoCriteria.filter(c => c.is_active).length}</p>
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
                    <p className="text-sm text-gray-600 mb-1">معايير معطلة</p>
                    <p className="text-xl font-bold text-gray-900">{ceoCriteria.filter(c => !c.is_active).length}</p>
                  </div>
                  <div className="bg-gray-100 text-gray-500 p-3 rounded-xl">
                    <EyeOff className="h-6 w-6" />
                  </div>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">مجموع الأوزان (النشطة)</p>
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
                  icon={<ClipboardList className="h-12 w-12 text-gray-400" />}
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
                            className={`${!criterion.is_active ? 'opacity-60 bg-gray-50' : ''} ${isExpanded ? 'bg-purple-50/40' : ''}`}
                            onClick={() => setExpandedCriterionId(isExpanded ? null : criterion.id)}
                          >
                            <TableCell className="text-gray-400">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <span className="font-bold text-gray-900">{criterion.title}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-gray-500 text-sm max-w-xs truncate">{criterion.description}</p>
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
                                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500"
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </button>
                                <span className="text-gray-400 text-sm font-mono w-6 text-center">{criterion.order}</span>
                                <button
                                  onClick={() => handleCeoReorder(criterion, 'down')}
                                  disabled={index === ceoCriteria.length - 1}
                                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500"
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
                                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{criterion.description}</p>
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
            <select
              value={selectedSupAssignment}
              onChange={(e) => setSelectedSupAssignment(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
            >
              {supAssignments.map(a => (
                <option key={a.id} value={a.id}>
                  {a.user?.full_name}{a.title ? ` — ${a.title}` : ''}
                </option>
              ))}
            </select>
          )}
          {supAssignments.length === 1 && (
            <p className="text-sm text-gray-600">
              المشرف: <span className="font-bold text-gray-900">{supAssignments[0].user?.full_name}</span>
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
                  icon={<Shield className="h-12 w-12 text-gray-400" />}
                />
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-teal-500" />
                  <h2 className="text-lg font-bold text-gray-900">المعايير الخاصة بالمشرفين</h2>
                  <Badge variant="info" size="sm">
                    {supCriteria.filter(c => c.is_active).length} معيار نشط
                  </Badge>
                </div>
              </CardHeader>
              <CardBody className="p-0">
                {supCriteria.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">
                    لم يتم تحديد معايير خاصة لهذا المشرف بعد
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
                      {supCriteria.map(c => {
                        const isExpanded = expandedCriterionId === c.id;
                        return (
                          <React.Fragment key={c.id}>
                            <TableRow
                              className={`${!c.is_active ? 'opacity-60 bg-gray-50' : ''} ${isExpanded ? 'bg-teal-50/40' : ''}`}
                              onClick={() => setExpandedCriterionId(isExpanded ? null : c.id)}
                            >
                              <TableCell className="text-gray-400">
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </TableCell>
                              <TableCell>
                                <span className="font-bold text-gray-900">{c.title}</span>
                              </TableCell>
                              <TableCell>
                                <p className="text-gray-500 text-sm max-w-xs truncate">{c.description}</p>
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
                                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{c.description}</p>
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
                    <p className="text-sm text-gray-600 mb-1">معايير نشطة</p>
                    <p className="text-xl font-bold text-gray-900">{ceoEvalCriteria.filter(c => c.is_active).length}</p>
                  </div>
                  <div className="bg-green-50 text-green-600 p-3 rounded-xl"><ClipboardList className="h-6 w-6" /></div>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">معايير معطلة</p>
                    <p className="text-xl font-bold text-gray-900">{ceoEvalCriteria.filter(c => !c.is_active).length}</p>
                  </div>
                  <div className="bg-gray-100 text-gray-500 p-3 rounded-xl"><EyeOff className="h-6 w-6" /></div>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">مجموع الأوزان (النشطة)</p>
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
                <EmptyState message="لا توجد معايير مضافة لتقييم الإدارة العليا" icon={<ClipboardList className="h-12 w-12 text-gray-400" />} />
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
                            className={`${!criterion.is_active ? 'opacity-60 bg-gray-50' : ''} ${isExpanded ? 'bg-amber-50/40' : ''}`}
                            onClick={() => setExpandedCriterionId(isExpanded ? null : criterion.id)}
                          >
                            <TableCell className="text-gray-400">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <span className="font-bold text-gray-900">{criterion.title}</span>
                              </div>
                            </TableCell>
                            <TableCell><p className="text-gray-500 text-sm max-w-xs truncate">{criterion.description}</p></TableCell>
                            <TableCell><Badge variant={criterion.is_active ? 'success' : 'default'}>{criterion.is_active ? 'نشط' : 'معطل'}</Badge></TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1" onClick={stop}>
                                <button onClick={() => handleCeoEvalReorder(criterion, 'up')} disabled={index === 0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500"><ArrowUp className="h-4 w-4" /></button>
                                <span className="text-gray-400 text-sm font-mono w-6 text-center">{criterion.order}</span>
                                <button onClick={() => handleCeoEvalReorder(criterion, 'down')} disabled={index === ceoEvalCriteria.length - 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500"><ArrowDown className="h-4 w-4" /></button>
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
                                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{criterion.description}</p>
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
              required
              helperText={`مجموع أوزان المعايير النشطة الحالي: ${totalWeight}% من ${generalWeightLimit}%`}
            />

            {editingCriterion && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <Toggle
                  checked={formData.is_active}
                  onChange={() => setFormData({ ...formData, is_active: !formData.is_active })}
                />
                <span className="text-sm font-medium text-gray-700">
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
          <p className="text-gray-900 text-lg font-medium mb-2">
            هل أنت متأكد من حذف هذا المعيار؟
          </p>
          <p className="text-gray-500 text-sm">
            سيتم حذف معيار{' '}
            <span className="font-bold text-gray-700">
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
              required
              helperText={`مجموع أوزان المعايير الخاصة النشطة الحالي: ${ceoTotalWeight}% من ${specificWeightLimit}%`}
            />
            {editingCeoCriterion && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <Toggle
                  checked={ceoFormData.is_active}
                  onChange={() => setCeoFormData({ ...ceoFormData, is_active: !ceoFormData.is_active })}
                  size="sm"
                />
                <span className="text-sm font-medium text-gray-700">
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
          <p className="text-gray-900 text-lg font-medium mb-2">هل أنت متأكد من حذف هذا المعيار؟</p>
          <p className="text-gray-500 text-sm">
            سيتم حذف معيار <span className="font-bold text-gray-700">{ceoDeleteTarget?.title}</span> نهائيًا.
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
              required
              helperText={`مجموع أوزان المعايير النشطة الحالي: ${ceoEvalTotalWeight}% من 100%`}
            />
            {editingCeoEvalCriterion && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <Toggle
                  checked={ceoEvalFormData.is_active}
                  onChange={() => setCeoEvalFormData({ ...ceoEvalFormData, is_active: !ceoEvalFormData.is_active })}
                  size="sm"
                />
                <span className="text-sm font-medium text-gray-700">
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
          <p className="text-gray-900 text-lg font-medium mb-2">هل أنت متأكد من حذف هذا المعيار؟</p>
          <p className="text-gray-500 text-sm">
            سيتم حذف معيار <span className="font-bold text-gray-700">{ceoEvalDeleteTarget?.title}</span> نهائيًا.
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

    </div>
  );
};
