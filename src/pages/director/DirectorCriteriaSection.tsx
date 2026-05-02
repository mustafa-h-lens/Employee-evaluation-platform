import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
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
  ArrowUp,
  ArrowDown,
  Scale,
  GripVertical,
  Building2,
  ChevronDown,
  ChevronUp,
  Users,
  X,
} from 'lucide-react';
import { Toggle } from '../../components/ui/Toggle';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface DeptCriterion {
  id: string;
  directorate_id: string | null;
  department_id: string | null;
  group_id: string | null;
  title: string;
  description: string;
  weight: number;
  order: number;
  is_active: boolean;
  created_by: string | null;
}

interface CriteriaGroup {
  id: string;
  directorate_id: string;
  name: string;
  order: number;
  is_default: boolean;
  general_weight: number;
  specific_weight: number;
}

interface DirectorateMember {
  employee_id: string;
  full_name: string;
  job_title: string | null;
  department_name: string | null;
}

interface DirectorateOption {
  id: string;
  name: string;
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

interface Props {
  // If provided, the section locks to that directorate. Otherwise it shows
  // its own picker over the directorates the user can manage.
  directorateId?: string | null;
  // When true, the section renders its body without a collapse toggle —
  // suitable for use inside a tab panel.
  embedded?: boolean;
}

export const DirectorCriteriaSection: React.FC<Props> = ({ directorateId, embedded = false }) => {
  const { user } = useAuth();
  const toast = useToast();

  const [open, setOpen] = useState(embedded);
  const [loading, setLoading] = useState(true);
  const [specificWeightLimit, setSpecificWeightLimit] = useState(50);

  const [myDirectorates, setMyDirectorates] = useState<DirectorateOption[]>([]);
  const [internalDirectorate, setInternalDirectorate] = useState<string>('');

  const selectedDirectorate = directorateId || internalDirectorate;

  const [groups, setGroups] = useState<CriteriaGroup[]>([]);
  const [criteria, setCriteria] = useState<DeptCriterion[]>([]);
  const [members, setMembers] = useState<DirectorateMember[]>([]);
  const [groupMembership, setGroupMembership] = useState<Record<string, string>>({});

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CriteriaGroup | null>(null);
  const [groupForm, setGroupForm] = useState<{ name: string; memberIds: Set<string> }>({ name: '', memberIds: new Set() });
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupError, setGroupError] = useState('');

  const [deleteGroupTarget, setDeleteGroupTarget] = useState<CriteriaGroup | null>(null);
  const [isDeleteGroupModalOpen, setIsDeleteGroupModalOpen] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

  const [isCriterionModalOpen, setIsCriterionModalOpen] = useState(false);
  const [criterionGroupId, setCriterionGroupId] = useState<string>('');
  const [editingCriterion, setEditingCriterion] = useState<DeptCriterion | null>(null);
  const [criterionForm, setCriterionForm] = useState<FormData>(defaultFormData);
  const [savingCriterion, setSavingCriterion] = useState(false);
  const [criterionError, setCriterionError] = useState('');

  const [deleteCriterionTarget, setDeleteCriterionTarget] = useState<DeptCriterion | null>(null);
  const [isDeleteCriterionModalOpen, setIsDeleteCriterionModalOpen] = useState(false);
  const [deletingCriterion, setDeletingCriterion] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchDirectorates = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('directorates')
      .select('id, name')
      .or(`director_id.eq.${user.id},secondary_director_id.eq.${user.id}`)
      .order('name');
    const list = (data || []) as DirectorateOption[];
    setMyDirectorates(list);
    if (!directorateId && list.length > 0) {
      setInternalDirectorate(prev => prev || list[0].id);
    }
    if (list.length === 0) setLoading(false);
  }, [user, directorateId]);

  const fetchSettings = useCallback(async () => {
    const { data: period } = await supabase
      .from('evaluation_periods')
      .select('specific_weight')
      .eq('status', 'نشطة')
      .maybeSingle();
    if (period && period.specific_weight != null) {
      setSpecificWeightLimit(period.specific_weight);
      return;
    }
    const { data } = await supabase
      .from('evaluation_settings')
      .select('specific_weight')
      .limit(1)
      .maybeSingle();
    if (data) setSpecificWeightLimit(data.specific_weight);
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedDirectorate) return;
    setLoading(true);
    try {
      const [groupsRes, criteriaRes, employeesRes, membershipRes] = await Promise.all([
        supabase.from('department_criteria_groups').select('*')
          .eq('directorate_id', selectedDirectorate).order('order'),
        supabase.from('department_criteria').select('*')
          .eq('directorate_id', selectedDirectorate).order('order'),
        supabase.from('employees')
          .select('id, full_name, job_title, department:departments(name)')
          .eq('directorate_id', selectedDirectorate)
          .eq('status', 'active')
          .order('full_name'),
        supabase.from('department_criteria_group_members')
          .select('group_id, employee_id')
          .eq('directorate_id', selectedDirectorate),
      ]);
      setGroups((groupsRes.data || []) as CriteriaGroup[]);
      setCriteria((criteriaRes.data || []) as DeptCriterion[]);
      const ms = (employeesRes.data || []).map((r: any) => ({
        employee_id: r.id,
        full_name: r.full_name || 'موظف',
        job_title: r.job_title || null,
        department_name: r.department?.name || null,
      })) as DirectorateMember[];
      setMembers(ms);
      const map: Record<string, string> = {};
      (membershipRes.data || []).forEach((r: any) => { map[r.employee_id] = r.group_id; });
      setGroupMembership(map);
    } catch (e) {
      console.error('Error fetching directorate criteria:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedDirectorate]);

  useEffect(() => { fetchDirectorates(); fetchSettings(); }, [fetchDirectorates, fetchSettings]);
  useEffect(() => { if (selectedDirectorate && open) fetchData(); }, [selectedDirectorate, open, fetchData]);

  const criteriaByGroup = useMemo(() => {
    const map: Record<string, DeptCriterion[]> = {};
    criteria.forEach(c => {
      if (!c.group_id) return;
      (map[c.group_id] ||= []).push(c);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.order - b.order));
    return map;
  }, [criteria]);

  const membersByGroup = useMemo(() => {
    const map: Record<string, DirectorateMember[]> = {};
    members.forEach(m => {
      const gid = groupMembership[m.employee_id];
      if (!gid) return;
      (map[gid] ||= []).push(m);
    });
    return map;
  }, [members, groupMembership]);

  const unassignedMembers = useMemo(
    () => members.filter(m => !groupMembership[m.employee_id]),
    [members, groupMembership]
  );

  const totalActiveWeight = criteria.filter(c => c.is_active).reduce((s, c) => s + c.weight, 0);
  const activeCount = criteria.filter(c => c.is_active).length;

  const openCreateGroupModal = () => {
    setEditingGroup(null);
    setGroupForm({ name: '', memberIds: new Set(unassignedMembers.map(m => m.employee_id)) });
    setGroupError('');
    setIsGroupModalOpen(true);
  };

  const openEditGroupModal = (group: CriteriaGroup) => {
    setEditingGroup(group);
    const ids = (membersByGroup[group.id] || []).map(m => m.employee_id);
    setGroupForm({ name: group.name, memberIds: new Set(ids) });
    setGroupError('');
    setIsGroupModalOpen(true);
  };

  const toggleMemberInForm = (employeeId: string) => {
    setGroupForm(prev => {
      const next = new Set(prev.memberIds);
      if (next.has(employeeId)) next.delete(employeeId); else next.add(employeeId);
      return { ...prev, memberIds: next };
    });
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setGroupError('');
    if (!groupForm.name.trim()) { setGroupError('يرجى إدخال اسم المجموعة'); return; }
    setSavingGroup(true);
    try {
      let groupId = editingGroup?.id;
      if (editingGroup) {
        const { error } = await supabase
          .from('department_criteria_groups')
          .update({ name: groupForm.name.trim() })
          .eq('id', editingGroup.id);
        if (error) { setGroupError(error.message); setSavingGroup(false); return; }
        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'تحديث مجموعة معايير الإدارة',
            entity_type: 'department_criteria_groups',
            entity_id: editingGroup.id,
            details: { name: groupForm.name.trim(), directorate_id: selectedDirectorate },
          });
        }
      } else {
        const maxOrder = groups.length > 0 ? Math.max(...groups.map(g => g.order)) : 0;
        const { data, error } = await supabase
          .from('department_criteria_groups')
          .insert({
            directorate_id: selectedDirectorate,
            name: groupForm.name.trim(),
            order: maxOrder + 1,
            is_default: false,
            created_by: user?.id || null,
          })
          .select().single();
        if (error || !data) { setGroupError(error?.message || 'فشل إنشاء المجموعة'); setSavingGroup(false); return; }
        groupId = data.id;
        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'إنشاء مجموعة معايير الإدارة',
            entity_type: 'department_criteria_groups',
            entity_id: data.id,
            details: { name: groupForm.name.trim(), directorate_id: selectedDirectorate },
          });
        }
      }

      const desired = groupForm.memberIds;
      const previouslyInThisGroup = new Set((membersByGroup[groupId!] || []).map(m => m.employee_id));
      const toAdd = [...desired].filter(id => !previouslyInThisGroup.has(id));
      const toRemove = [...previouslyInThisGroup].filter(id => !desired.has(id));

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
          .eq('directorate_id', selectedDirectorate)
          .in('employee_id', toAdd);
        await supabase
          .from('department_criteria_group_members')
          .insert(toAdd.map(eid => ({
            group_id: groupId!,
            directorate_id: selectedDirectorate,
            employee_id: eid,
          })));
      }

      if (user && (toAdd.length > 0 || toRemove.length > 0)) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'تحديث أعضاء مجموعة معايير الإدارة',
          entity_type: 'department_criteria_group_members',
          entity_id: groupId!,
          details: { added: toAdd, removed: toRemove, directorate_id: selectedDirectorate },
        });
      }

      setIsGroupModalOpen(false);
      setEditingGroup(null);
      fetchData();
    } catch (e) {
      console.error(e);
      setGroupError('حدث خطأ أثناء الحفظ');
    } finally {
      setSavingGroup(false);
    }
  };

  const confirmDeleteGroup = (group: CriteriaGroup) => {
    setDeleteGroupTarget(group);
    setIsDeleteGroupModalOpen(true);
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupTarget) return;
    setDeletingGroup(true);
    try {
      const { error } = await supabase
        .from('department_criteria_groups').delete().eq('id', deleteGroupTarget.id);
      if (error) { toast.error(error.message); return; }
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'حذف مجموعة معايير الإدارة',
          entity_type: 'department_criteria_groups',
          entity_id: deleteGroupTarget.id,
          details: { name: deleteGroupTarget.name, directorate_id: selectedDirectorate },
        });
      }
      toast.success('تم حذف المجموعة');
      setIsDeleteGroupModalOpen(false);
      setDeleteGroupTarget(null);
      fetchData();
    } finally {
      setDeletingGroup(false);
    }
  };

  const openCreateCriterionModal = (groupId: string) => {
    setCriterionGroupId(groupId);
    setEditingCriterion(null);
    setCriterionForm(defaultFormData);
    setCriterionError('');
    setIsCriterionModalOpen(true);
  };

  const openEditCriterionModal = (criterion: DeptCriterion) => {
    setCriterionGroupId(criterion.group_id || '');
    setEditingCriterion(criterion);
    setCriterionForm({
      title: criterion.title,
      description: criterion.description,
      weight: criterion.weight.toString(),
      is_active: criterion.is_active,
    });
    setCriterionError('');
    setIsCriterionModalOpen(true);
  };

  const handleSaveCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    setCriterionError('');
    const weight = parseFloat(criterionForm.weight);
    if (!criterionForm.title.trim()) { setCriterionError('يرجى إدخال عنوان المعيار'); return; }
    if (!criterionForm.description.trim()) { setCriterionError('يرجى إدخال وصف المعيار'); return; }
    if (!weight || weight < 1 || weight > 100) { setCriterionError('يرجى إدخال وزن صحيح (1-100)'); return; }
    if (!criterionGroupId) { setCriterionError('لم يتم تحديد المجموعة'); return; }

    if (criterionForm.is_active) {
      const groupCriteria = (criteriaByGroup[criterionGroupId] || []).filter(c => c.id !== editingCriterion?.id);
      const othersActive = groupCriteria.filter(c => c.is_active).reduce((s, c) => s + c.weight, 0);
      const projected = othersActive + weight;
      const cap = groups.find(g => g.id === criterionGroupId)?.specific_weight ?? specificWeightLimit;
      if (projected > cap) {
        setCriterionError(`لا يمكن تجاوز الحد المسموح (${cap}%) في هذه المجموعة. المجموع بعد الإضافة سيصبح ${projected}%.`);
        return;
      }
    }

    setSavingCriterion(true);
    try {
      if (editingCriterion) {
        const { error } = await supabase.from('department_criteria').update({
          title: criterionForm.title.trim(),
          description: criterionForm.description.trim(),
          weight,
          is_active: criterionForm.is_active,
        }).eq('id', editingCriterion.id);
        if (error) { setCriterionError(error.message); return; }
        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'تحديث معيار خاص بالإدارة',
            entity_type: 'department_criteria',
            entity_id: editingCriterion.id,
            details: { title: criterionForm.title, weight, group_id: criterionGroupId, directorate_id: selectedDirectorate },
          });
        }
      } else {
        const groupList = criteriaByGroup[criterionGroupId] || [];
        const maxOrder = groupList.length > 0 ? Math.max(...groupList.map(c => c.order)) : 0;
        const { data, error } = await supabase.from('department_criteria').insert({
          directorate_id: selectedDirectorate,
          department_id: null,
          group_id: criterionGroupId,
          title: criterionForm.title.trim(),
          description: criterionForm.description.trim(),
          weight,
          order: maxOrder + 1,
          is_active: criterionForm.is_active,
          created_by: user?.id || null,
        }).select().single();
        if (error) { setCriterionError(error.message); return; }
        if (user && data) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'إضافة معيار خاص بالإدارة',
            entity_type: 'department_criteria',
            entity_id: data.id,
            details: { title: criterionForm.title, weight, group_id: criterionGroupId, directorate_id: selectedDirectorate },
          });
        }
      }
      setIsCriterionModalOpen(false);
      setEditingCriterion(null);
      fetchData();
    } finally {
      setSavingCriterion(false);
    }
  };

  const handleToggleCriterion = async (criterion: DeptCriterion) => {
    const newActive = !criterion.is_active;
    if (newActive) {
      const groupCriteria = (criteriaByGroup[criterion.group_id || ''] || []).filter(c => c.id !== criterion.id);
      const othersActive = groupCriteria.filter(c => c.is_active).reduce((s, c) => s + c.weight, 0);
      const projected = othersActive + criterion.weight;
      const cap = groups.find(g => g.id === criterion.group_id)?.specific_weight ?? specificWeightLimit;
      if (projected > cap) {
        toast.error(`لا يمكن تفعيل هذا المعيار — المجموع في هذه المجموعة سيصبح ${projected}% ويتجاوز الحد المسموح (${cap}%).`);
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
      fetchData();
    }
  };

  const handleReorderCriterion = async (criterion: DeptCriterion, direction: 'up' | 'down') => {
    const groupList = criteriaByGroup[criterion.group_id || ''] || [];
    const idx = groupList.findIndex(c => c.id === criterion.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= groupList.length) return;
    const swap = groupList[swapIdx];
    await Promise.all([
      supabase.from('department_criteria').update({ order: swap.order }).eq('id', criterion.id),
      supabase.from('department_criteria').update({ order: criterion.order }).eq('id', swap.id),
    ]);
    fetchData();
  };

  const confirmDeleteCriterion = (criterion: DeptCriterion) => {
    setDeleteCriterionTarget(criterion);
    setIsDeleteCriterionModalOpen(true);
  };

  const handleDeleteCriterion = async () => {
    if (!deleteCriterionTarget) return;
    setDeletingCriterion(true);
    try {
      const { error } = await supabase.from('department_criteria')
        .delete().eq('id', deleteCriterionTarget.id);
      if (!error) {
        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'حذف معيار خاص بالإدارة',
            entity_type: 'department_criteria',
            entity_id: deleteCriterionTarget.id,
            details: { title: deleteCriterionTarget.title, group_id: deleteCriterionTarget.group_id },
          });
        }
        setIsDeleteCriterionModalOpen(false);
        setDeleteCriterionTarget(null);
        fetchData();
      }
    } finally {
      setDeletingCriterion(false);
    }
  };

  if (myDirectorates.length === 0 && !loading) {
    return null;
  }

  const currentDirectorate = myDirectorates.find(d => d.id === selectedDirectorate);

  return (
    <Card>
      <CardBody className="p-0">
        {embedded ? (
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-ds-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ds-text">معايير الإدارة لتقييم الموظفين</h2>
                <p className="text-xs text-ds-muted mt-0.5">
                  {currentDirectorate ? <>إدارة <span className="font-semibold text-emerald-700">{currentDirectorate.name}</span> — مجموعات الموظفين والمعايير الخاصة بكل مجموعة</> : 'مجموعات الموظفين والمعايير الخاصة بكل مجموعة'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="info" size="sm">{groups.length} مجموعة</Badge>
              <Badge variant={activeCount > 0 ? 'success' : 'default'} size="sm">{activeCount} معيار نشط</Badge>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="w-full flex items-center justify-between gap-4 px-6 py-4 text-right hover:bg-ds-overlay/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ds-text">معايير الإدارة لتقييم الموظفين</h2>
                <p className="text-xs text-ds-muted mt-0.5">
                  {currentDirectorate ? <>إدارة <span className="font-semibold text-emerald-700">{currentDirectorate.name}</span> — مجموعات الموظفين والمعايير الخاصة بكل مجموعة</> : 'مجموعات الموظفين والمعايير الخاصة بكل مجموعة'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="info" size="sm">{groups.length} مجموعة</Badge>
              <Badge variant={activeCount > 0 ? 'success' : 'default'} size="sm">{activeCount} معيار نشط</Badge>
              {open ? <ChevronUp className="h-5 w-5 text-ds-faint" /> : <ChevronDown className="h-5 w-5 text-ds-faint" />}
            </div>
          </button>
        )}

        {open && (
          <div className="border-t border-ds-border-subtle p-6 space-y-4">
            {!directorateId && myDirectorates.length > 1 && (
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-ds-muted">الإدارة:</label>
                <ModernSelect
                  value={internalDirectorate}
                  onChange={setInternalDirectorate}
                  ariaLabel="الإدارة"
                  className="min-w-[220px]"
                  options={myDirectorates.map(d => ({ value: d.id, label: d.name }))}
                />
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-sm text-ds-muted flex items-center gap-2">
                <Scale className="h-4 w-4" />
                <span>كل مجموعة لها نسبتها الخاصة (يحددها قسم الموارد البشرية)</span>
              </div>
              <Button onClick={openCreateGroupModal} size="sm" className="flex items-center gap-2">
                <span>إضافة مجموعة</span>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8 text-ds-muted">جاري التحميل...</div>
            ) : (
              <>
                {unassignedMembers.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-amber-900 font-semibold text-sm mb-1">
                        يوجد {unassignedMembers.length} موظف غير مصنّف في أي مجموعة معايير
                      </p>
                      <p className="text-amber-800 text-sm">
                        لن يتم تقييم هؤلاء الموظفين بمعايير خاصة حتى تضيفهم إلى مجموعة. الموظفون غير المصنّفين:{' '}
                        <span className="font-medium">{unassignedMembers.map(m => m.full_name).join('، ')}</span>
                      </p>
                    </div>
                  </div>
                )}

                {groups.length === 0 && (
                  <EmptyState
                    message="لا توجد مجموعات معايير بعد. أنشئ مجموعة وحدّد الموظفين المشمولين بها."
                    icon={<ClipboardList className="h-10 w-10 text-ds-faint" />}
                  />
                )}

                {groups.map(group => {
                  const list = criteriaByGroup[group.id] || [];
                  const groupMembers = membersByGroup[group.id] || [];
                  const total = list.filter(c => c.is_active).reduce((s, c) => s + c.weight, 0);
                  return (
                    <div key={group.id} className="border border-ds-border-subtle rounded-lg overflow-hidden">
                      <div className="px-5 py-3 bg-ds-overlay/30 border-b border-ds-border-subtle flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <h3 className="text-base font-bold text-ds-text">{group.name}</h3>
                            {group.is_default && <Badge variant="info" size="sm">افتراضية</Badge>}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-ds-muted">
                            <Users className="h-4 w-4" />
                            {groupMembers.length === 0 ? (
                              <span className="text-amber-600">لا يوجد موظفون مرتبطون بهذه المجموعة</span>
                            ) : (
                              <span>{groupMembers.length} موظف: {groupMembers.map(m => m.full_name).join('، ')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={total === group.specific_weight ? 'success' : 'warning'} size="sm">
                            المجموع: {total}% / {group.specific_weight}%
                          </Badge>
                          <Badge variant="default" size="sm">
                            عامة {group.general_weight}% / خاصة {group.specific_weight}%
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => openEditGroupModal(group)} className="flex items-center gap-1">
                            <Edit className="h-4 w-4" /><span>تعديل</span>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openCreateCriterionModal(group.id)} className="flex items-center gap-1">
                            <Plus className="h-4 w-4" /><span>إضافة معيار</span>
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => confirmDeleteGroup(group)} className="flex items-center gap-1">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {list.length === 0 ? (
                        <div className="px-6 py-6 text-center text-ds-faint text-sm">
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
                            {list.map((criterion, index) => {
                              const isExpanded = expandedId === criterion.id;
                              const stop = (e: React.MouseEvent) => e.stopPropagation();
                              return (
                                <React.Fragment key={criterion.id}>
                                  <TableRow
                                    className={`${!criterion.is_active ? 'opacity-60 bg-ds-bg' : ''} ${isExpanded ? 'bg-emerald-50/40' : ''}`}
                                    onClick={() => setExpandedId(isExpanded ? null : criterion.id)}
                                  >
                                    <TableCell>
                                      <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
                                        <button onClick={() => handleReorderCriterion(criterion, 'up')} disabled={index === 0}
                                          className="p-1 rounded hover:bg-ds-overlay disabled:opacity-30 disabled:cursor-not-allowed text-ds-faint">
                                          <ArrowUp className="h-4 w-4" />
                                        </button>
                                        <span className="text-ds-faint text-sm font-mono w-6 text-center">{criterion.order}</span>
                                        <button onClick={() => handleReorderCriterion(criterion, 'down')} disabled={index === list.length - 1}
                                          className="p-1 rounded hover:bg-ds-overlay disabled:opacity-30 disabled:cursor-not-allowed text-ds-faint">
                                          <ArrowDown className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <div className="w-16 bg-gray-200 rounded-full h-2">
                                          <div className="bg-emerald-500 h-2 rounded-full transition-all"
                                            style={{ width: `${Math.min(100, (criterion.weight / Math.max(1, group.specific_weight)) * 100)}%` }} />
                                        </div>
                                        <span className="font-bold text-emerald-600">{criterion.weight}%</span>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2" onClick={stop}>
                                        <Button size="sm" variant="outline" onClick={() => openEditCriterionModal(criterion)} className="flex items-center gap-1">
                                          <Edit className="h-4 w-4" /><span>تعديل</span>
                                        </Button>
                                        <Toggle checked={criterion.is_active} onChange={() => handleToggleCriterion(criterion)} size="sm" />
                                        <Button size="sm" variant="danger" onClick={() => confirmDeleteCriterion(criterion)} className="flex items-center gap-1">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                  {isExpanded && (
                                    <tr className="bg-emerald-50/40 border-b border-emerald-100">
                                      <td colSpan={6} className="px-6 py-4">
                                        <div className="bg-ds-surface rounded-lg border border-emerald-100 p-4">
                                          <p className="text-xs font-semibold text-emerald-700 mb-1">الوصف الكامل</p>
                                          <p className="text-sm text-ds-muted leading-relaxed whitespace-pre-line">
                                            {criterion.description || <span className="text-ds-faint italic">لا يوجد وصف</span>}
                                          </p>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </CardBody>

      <Modal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        title={editingGroup ? 'تعديل المجموعة' : 'إضافة مجموعة جديدة'}
      >
        <form onSubmit={handleSaveGroup}>
          <div className="space-y-4">
            {groupError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{groupError}</div>
            )}
            <Input
              label="اسم المجموعة"
              value={groupForm.name}
              onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
              placeholder="مثال: فريق التصميم"
              required
            />
            <div>
              <label className="block text-sm font-medium text-ds-muted mb-2">
                الموظفون المشمولون
                <span className="text-xs text-ds-faint mr-2">— اختر من بين موظفي الإدارة</span>
              </label>
              <div className="border border-ds-border rounded-lg max-h-64 overflow-y-auto">
                {members.length === 0 && (
                  <p className="p-4 text-sm text-ds-faint text-center">لا يوجد موظفون في هذه الإدارة بعد</p>
                )}
                {members.map(m => {
                  const checked = groupForm.memberIds.has(m.employee_id);
                  const otherGroupId = groupMembership[m.employee_id];
                  const otherGroup = otherGroupId && otherGroupId !== editingGroup?.id ? groups.find(g => g.id === otherGroupId) : null;
                  return (
                    <label key={m.employee_id} className="flex items-center gap-3 px-3 py-2 hover:bg-ds-bg cursor-pointer border-b border-ds-border-subtle last:border-b-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMemberInForm(m.employee_id)}
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
                })}
              </div>
              <p className="text-xs text-ds-faint mt-1">
                إضافة موظف إلى هذه المجموعة سيخرجه من مجموعته السابقة (موظف واحد لمجموعة واحدة فقط لكل إدارة).
              </p>
            </div>
          </div>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsGroupModalOpen(false)}>إلغاء</Button>
            <Button type="submit" loading={savingGroup}>{editingGroup ? 'تحديث' : 'إنشاء'}</Button>
          </ModalFooter>
        </form>
      </Modal>

      <Modal isOpen={isDeleteGroupModalOpen} onClose={() => setIsDeleteGroupModalOpen(false)} title="حذف المجموعة">
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-ds-text text-lg font-medium mb-2">هل أنت متأكد من حذف هذه المجموعة؟</p>
          <p className="text-ds-faint text-sm">
            سيتم حذف مجموعة <span className="font-bold text-ds-muted">{deleteGroupTarget?.name}</span> وجميع معاييرها نهائياً.
            الموظفون المرتبطون بها سيصبحون غير مصنّفين، ولن يتم تقييمهم بمعايير خاصة حتى يتم إضافتهم إلى مجموعة أخرى.
          </p>
        </div>
        <ModalFooter className="justify-center">
          <Button type="button" variant="secondary" onClick={() => setIsDeleteGroupModalOpen(false)}>إلغاء</Button>
          <Button type="button" variant="danger" onClick={handleDeleteGroup} loading={deletingGroup}>
            <span className="flex items-center gap-1"><Trash2 className="h-4 w-4" /><span>حذف</span></span>
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={isCriterionModalOpen}
        onClose={() => setIsCriterionModalOpen(false)}
        title={editingCriterion ? 'تعديل معيار' : 'إضافة معيار جديد'}
      >
        <form onSubmit={handleSaveCriterion}>
          <div className="space-y-4">
            {criterionError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{criterionError}</div>
            )}
            <Input label="عنوان المعيار" value={criterionForm.title}
              onChange={e => setCriterionForm({ ...criterionForm, title: e.target.value })}
              placeholder="مثال: جودة العمل" required />
            <TextArea label="وصف المعيار" value={criterionForm.description}
              onChange={e => setCriterionForm({ ...criterionForm, description: e.target.value })}
              placeholder="وصف مختصر لما يقيسه هذا المعيار" rows={3} required />
            <Input label="الوزن (%)" type="number" value={criterionForm.weight}
              onChange={e => setCriterionForm({ ...criterionForm, weight: e.target.value })}
              placeholder="مثال: 10" min={1}
              max={groups.find(g => g.id === criterionGroupId)?.specific_weight ?? specificWeightLimit}
              step={0.5} required />
            {editingCriterion && (
              <div className="flex items-center justify-between p-3 bg-ds-bg rounded-lg">
                <Toggle checked={criterionForm.is_active} onChange={() => setCriterionForm({ ...criterionForm, is_active: !criterionForm.is_active })} />
                <span className="text-sm font-medium text-ds-muted">{criterionForm.is_active ? 'المعيار نشط' : 'المعيار معطل'}</span>
              </div>
            )}
          </div>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsCriterionModalOpen(false)}>إلغاء</Button>
            <Button type="submit" loading={savingCriterion}>{editingCriterion ? 'تحديث' : 'إضافة'}</Button>
          </ModalFooter>
        </form>
      </Modal>

      <Modal isOpen={isDeleteCriterionModalOpen} onClose={() => setIsDeleteCriterionModalOpen(false)} title="تأكيد الحذف">
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-ds-text text-lg font-medium mb-2">هل أنت متأكد من حذف هذا المعيار؟</p>
          <p className="text-ds-faint text-sm">
            سيتم حذف معيار <span className="font-bold text-ds-muted">{deleteCriterionTarget?.title}</span> نهائياً.
          </p>
        </div>
        <ModalFooter className="justify-center">
          <Button type="button" variant="secondary" onClick={() => setIsDeleteCriterionModalOpen(false)}>إلغاء</Button>
          <Button type="button" variant="danger" onClick={handleDeleteCriterion} loading={deletingCriterion}>
            <span className="flex items-center gap-1"><Trash2 className="h-4 w-4" /><span>حذف المعيار</span></span>
          </Button>
        </ModalFooter>
      </Modal>

      <span className="hidden"><GripVertical /><Scale /><X /><Building2 /><span>{totalActiveWeight}</span></span>
    </Card>
  );
};
