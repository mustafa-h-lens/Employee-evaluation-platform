import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
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
  ArrowUp,
  ArrowDown,
  Scale,
  GripVertical,
  Shield,
  ChevronDown,
  ChevronUp,
  Users,
  X,
} from 'lucide-react';
import { Toggle } from '../../components/ui/Toggle';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

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

interface CriteriaGroup {
  id: string;
  assignment_id: string;
  name: string;
  order: number;
  is_default: boolean;
}

interface AssignmentMember {
  employee_id: string;
  full_name: string;
  job_title: string | null;
}

interface Assignment {
  id: string;
  title: string | null;
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

export const SupervisorCriteria: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [specificWeightLimit, setSpecificWeightLimit] = useState(50);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>('');

  const [groups, setGroups] = useState<CriteriaGroup[]>([]);
  const [criteria, setCriteria] = useState<SupervisorCriterion[]>([]);
  const [members, setMembers] = useState<AssignmentMember[]>([]);
  const [groupMembership, setGroupMembership] = useState<Record<string, string>>({}); // employee_id -> group_id

  // Group create / rename / delete
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CriteriaGroup | null>(null);
  const [groupForm, setGroupForm] = useState<{ name: string; memberIds: Set<string> }>({ name: '', memberIds: new Set() });
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupError, setGroupError] = useState('');

  const [deleteGroupTarget, setDeleteGroupTarget] = useState<CriteriaGroup | null>(null);
  const [isDeleteGroupModalOpen, setIsDeleteGroupModalOpen] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

  // Criterion add / edit / delete
  const [isCriterionModalOpen, setIsCriterionModalOpen] = useState(false);
  const [criterionGroupId, setCriterionGroupId] = useState<string>('');
  const [editingCriterion, setEditingCriterion] = useState<SupervisorCriterion | null>(null);
  const [criterionForm, setCriterionForm] = useState<FormData>(defaultFormData);
  const [savingCriterion, setSavingCriterion] = useState(false);
  const [criterionError, setCriterionError] = useState('');

  const [deleteCriterionTarget, setDeleteCriterionTarget] = useState<SupervisorCriterion | null>(null);
  const [isDeleteCriterionModalOpen, setIsDeleteCriterionModalOpen] = useState(false);
  const [deletingCriterion, setDeletingCriterion] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('supervisor_assignments')
      .select('id, title')
      .eq('user_id', user.id)
      .eq('status', 'active');
    const list = (data || []) as Assignment[];
    setAssignments(list);
    if (list.length > 0 && !selectedAssignment) setSelectedAssignment(list[0].id);
    if (list.length === 0) setLoading(false);
  }, [user, selectedAssignment]);

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
    if (!selectedAssignment) return;
    setLoading(true);
    try {
      const [groupsRes, criteriaRes, memberRes, membershipRes] = await Promise.all([
        supabase.from('supervisor_criteria_groups').select('*')
          .eq('assignment_id', selectedAssignment).order('order'),
        supabase.from('supervisor_criteria').select('*')
          .eq('assignment_id', selectedAssignment).order('order'),
        supabase.from('supervisor_assignment_members')
          .select('employee_id, employee:employees(id, full_name, job_title)')
          .eq('assignment_id', selectedAssignment),
        supabase.from('supervisor_criteria_group_members')
          .select('group_id, employee_id')
          .eq('assignment_id', selectedAssignment),
      ]);
      setGroups((groupsRes.data || []) as CriteriaGroup[]);
      setCriteria((criteriaRes.data || []) as SupervisorCriterion[]);
      const ms = (memberRes.data || []).map((r: any) => ({
        employee_id: r.employee_id,
        full_name: r.employee?.full_name || 'موظف',
        job_title: r.employee?.job_title || null,
      })) as AssignmentMember[];
      setMembers(ms);
      const map: Record<string, string> = {};
      (membershipRes.data || []).forEach((r: any) => { map[r.employee_id] = r.group_id; });
      setGroupMembership(map);
    } catch (e) {
      console.error('Error fetching supervisor criteria:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedAssignment]);

  useEffect(() => { fetchAssignments(); fetchSettings(); }, [fetchAssignments, fetchSettings]);
  useEffect(() => { if (selectedAssignment) fetchData(); }, [selectedAssignment, fetchData]);

  const criteriaByGroup = useMemo(() => {
    const map: Record<string, SupervisorCriterion[]> = {};
    criteria.forEach(c => {
      if (!c.group_id) return;
      (map[c.group_id] ||= []).push(c);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.order - b.order));
    return map;
  }, [criteria]);

  const membersByGroup = useMemo(() => {
    const map: Record<string, AssignmentMember[]> = {};
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

  // ===== Group operations =====

  const openCreateGroupModal = () => {
    setEditingGroup(null);
    // Pre-select unassigned members so the supervisor isn't forced to pick again
    setGroupForm({ name: '', memberIds: new Set(unassignedMembers.map(m => m.employee_id)) });
    setGroupError('');
    setIsGroupModalOpen(true);
  };

  const openEditGroupModal = (group: CriteriaGroup) => {
    setEditingGroup(group);
    const ids = (membersByGroup[group.id] || []).map(m => m.employee_id);
    // Allow adding currently-unassigned members in the same edit
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
          .from('supervisor_criteria_groups')
          .update({ name: groupForm.name.trim() })
          .eq('id', editingGroup.id);
        if (error) { setGroupError(error.message); setSavingGroup(false); return; }
        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'تحديث مجموعة معايير مشرف',
            entity_type: 'supervisor_criteria_groups',
            entity_id: editingGroup.id,
            details: { name: groupForm.name.trim(), assignment_id: selectedAssignment },
          });
        }
      } else {
        const maxOrder = groups.length > 0 ? Math.max(...groups.map(g => g.order)) : 0;
        const { data, error } = await supabase
          .from('supervisor_criteria_groups')
          .insert({
            assignment_id: selectedAssignment,
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
            action: 'إنشاء مجموعة معايير مشرف',
            entity_type: 'supervisor_criteria_groups',
            entity_id: data.id,
            details: { name: groupForm.name.trim(), assignment_id: selectedAssignment },
          });
        }
      }

      // Diff member set: each toggled employee must move from old group → new (or unassigned).
      const desired = groupForm.memberIds;
      const previouslyInThisGroup = new Set((membersByGroup[groupId!] || []).map(m => m.employee_id));

      const toAdd = [...desired].filter(id => !previouslyInThisGroup.has(id));
      const toRemove = [...previouslyInThisGroup].filter(id => !desired.has(id));

      // Remove first (frees up the unique key for any moves)
      if (toRemove.length > 0) {
        await supabase
          .from('supervisor_criteria_group_members')
          .delete()
          .eq('group_id', groupId!)
          .in('employee_id', toRemove);
      }
      // Detach added employees from any other group of this assignment, then insert.
      if (toAdd.length > 0) {
        await supabase
          .from('supervisor_criteria_group_members')
          .delete()
          .eq('assignment_id', selectedAssignment)
          .in('employee_id', toAdd);
        await supabase
          .from('supervisor_criteria_group_members')
          .insert(toAdd.map(eid => ({
            group_id: groupId!,
            assignment_id: selectedAssignment,
            employee_id: eid,
          })));
      }

      if (user && (toAdd.length > 0 || toRemove.length > 0)) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'تحديث أعضاء مجموعة معايير مشرف',
          entity_type: 'supervisor_criteria_group_members',
          entity_id: groupId!,
          details: { added: toAdd, removed: toRemove, assignment_id: selectedAssignment },
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
      // Members are unassigned automatically (group_members rows cascade-delete);
      // criteria belonging to the group also cascade-delete via FK.
      const { error } = await supabase
        .from('supervisor_criteria_groups').delete().eq('id', deleteGroupTarget.id);
      if (error) { toast.error(error.message); return; }
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'حذف مجموعة معايير مشرف',
          entity_type: 'supervisor_criteria_groups',
          entity_id: deleteGroupTarget.id,
          details: { name: deleteGroupTarget.name, assignment_id: selectedAssignment },
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

  // ===== Criterion operations =====

  const openCreateCriterionModal = (groupId: string) => {
    setCriterionGroupId(groupId);
    setEditingCriterion(null);
    setCriterionForm(defaultFormData);
    setCriterionError('');
    setIsCriterionModalOpen(true);
  };

  const openEditCriterionModal = (criterion: SupervisorCriterion) => {
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
    const weight = parseInt(criterionForm.weight);
    if (!criterionForm.title.trim()) { setCriterionError('يرجى إدخال عنوان المعيار'); return; }
    if (!criterionForm.description.trim()) { setCriterionError('يرجى إدخال وصف المعيار'); return; }
    if (!weight || weight < 1 || weight > 100) { setCriterionError('يرجى إدخال وزن صحيح (1-100)'); return; }
    if (!criterionGroupId) { setCriterionError('لم يتم تحديد المجموعة'); return; }

    if (criterionForm.is_active) {
      const groupCriteria = (criteriaByGroup[criterionGroupId] || []).filter(c => c.id !== editingCriterion?.id);
      const othersActive = groupCriteria.filter(c => c.is_active).reduce((s, c) => s + c.weight, 0);
      const projected = othersActive + weight;
      if (projected > specificWeightLimit) {
        setCriterionError(`لا يمكن تجاوز الحد المسموح (${specificWeightLimit}%) في هذه المجموعة. المجموع بعد الإضافة سيصبح ${projected}%.`);
        return;
      }
    }

    setSavingCriterion(true);
    try {
      if (editingCriterion) {
        const { error } = await supabase.from('supervisor_criteria').update({
          title: criterionForm.title.trim(),
          description: criterionForm.description.trim(),
          weight,
          is_active: criterionForm.is_active,
        }).eq('id', editingCriterion.id);
        if (error) { setCriterionError(error.message); return; }
        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'تحديث معيار خاص بالمشرف',
            entity_type: 'supervisor_criteria',
            entity_id: editingCriterion.id,
            details: { title: criterionForm.title, weight, group_id: criterionGroupId, assignment_id: selectedAssignment },
          });
        }
      } else {
        const groupList = criteriaByGroup[criterionGroupId] || [];
        const maxOrder = groupList.length > 0 ? Math.max(...groupList.map(c => c.order)) : 0;
        const { data, error } = await supabase.from('supervisor_criteria').insert({
          assignment_id: selectedAssignment,
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
            action: 'إضافة معيار خاص بالمشرف',
            entity_type: 'supervisor_criteria',
            entity_id: data.id,
            details: { title: criterionForm.title, weight, group_id: criterionGroupId, assignment_id: selectedAssignment },
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

  const handleToggleCriterion = async (criterion: SupervisorCriterion) => {
    const newActive = !criterion.is_active;
    if (newActive) {
      const groupCriteria = (criteriaByGroup[criterion.group_id || ''] || []).filter(c => c.id !== criterion.id);
      const othersActive = groupCriteria.filter(c => c.is_active).reduce((s, c) => s + c.weight, 0);
      const projected = othersActive + criterion.weight;
      if (projected > specificWeightLimit) {
        toast.error(`لا يمكن تفعيل هذا المعيار — المجموع في هذه المجموعة سيصبح ${projected}% ويتجاوز الحد المسموح (${specificWeightLimit}%).`);
        return;
      }
    }
    const { error } = await supabase.from('supervisor_criteria')
      .update({ is_active: newActive }).eq('id', criterion.id);
    if (!error) {
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: newActive ? 'تفعيل معيار مشرف' : 'تعطيل معيار مشرف',
          entity_type: 'supervisor_criteria',
          entity_id: criterion.id,
          details: { title: criterion.title, is_active: newActive },
        });
      }
      fetchData();
    }
  };

  const handleReorderCriterion = async (criterion: SupervisorCriterion, direction: 'up' | 'down') => {
    const groupList = criteriaByGroup[criterion.group_id || ''] || [];
    const idx = groupList.findIndex(c => c.id === criterion.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= groupList.length) return;
    const swap = groupList[swapIdx];
    await Promise.all([
      supabase.from('supervisor_criteria').update({ order: swap.order }).eq('id', criterion.id),
      supabase.from('supervisor_criteria').update({ order: criterion.order }).eq('id', swap.id),
    ]);
    fetchData();
  };

  const confirmDeleteCriterion = (criterion: SupervisorCriterion) => {
    setDeleteCriterionTarget(criterion);
    setIsDeleteCriterionModalOpen(true);
  };

  const handleDeleteCriterion = async () => {
    if (!deleteCriterionTarget) return;
    setDeletingCriterion(true);
    try {
      const { error } = await supabase.from('supervisor_criteria')
        .delete().eq('id', deleteCriterionTarget.id);
      if (!error) {
        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'حذف معيار خاص بالمشرف',
            entity_type: 'supervisor_criteria',
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

  if (loading) return <div className="flex items-center justify-center h-64">جاري التحميل...</div>;

  if (assignments.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">المعايير الخاصة بالمشرف</h1>
        <Card>
          <CardBody>
            <EmptyState message="لا توجد مهام إشراف نشطة حالياً" icon={<Shield className="h-12 w-12 text-gray-400" />} />
          </CardBody>
        </Card>
      </div>
    );
  }

  const currentAssignment = assignments.find(a => a.id === selectedAssignment);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">المعايير الخاصة بالمشرف</h1>
          <p className="text-gray-600 mt-2">
            معايير التقييم الخاصة بمهمة الإشراف
            {currentAssignment && (
              <span className="font-semibold text-orange-700"> — {currentAssignment.title || 'مهمة إشراف'}</span>
            )}
            {' '}(النسبة المخصصة لكل مجموعة: {specificWeightLimit}% من إجمالي التقييم)
          </p>
        </div>
        <Button onClick={openCreateGroupModal} className="flex items-center gap-2">
          <span>إضافة مجموعة</span>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Assignment selector if multiple */}
      {assignments.length > 1 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">مهمة الإشراف:</label>
          <select
            value={selectedAssignment}
            onChange={e => setSelectedAssignment(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            {assignments.map(a => (
              <option key={a.id} value={a.id}>{a.title || 'مهمة إشراف'}</option>
            ))}
          </select>
        </div>
      )}

      {/* Unassigned employees alert */}
      {unassignedMembers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
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

      {/* Empty state when no groups */}
      {groups.length === 0 && (
        <Card>
          <CardBody>
            <EmptyState
              message="لا توجد مجموعات معايير بعد. أنشئ مجموعة وحدّد الموظفين المشمولين بها."
              icon={<ClipboardList className="h-12 w-12 text-gray-400" />}
            />
          </CardBody>
        </Card>
      )}

      {/* Groups list */}
      {groups.map(group => {
        const list = criteriaByGroup[group.id] || [];
        const groupMembers = membersByGroup[group.id] || [];
        const total = list.filter(c => c.is_active).reduce((s, c) => s + c.weight, 0);
        return (
          <Card key={group.id}>
            <CardBody className="p-0">
              <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <h2 className="text-lg font-bold text-gray-900">{group.name}</h2>
                    {group.is_default && (
                      <Badge variant="info" size="sm">افتراضية</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="h-4 w-4" />
                    {groupMembers.length === 0 ? (
                      <span className="text-amber-600">لا يوجد موظفون مرتبطون بهذه المجموعة</span>
                    ) : (
                      <span>{groupMembers.length} موظف: {groupMembers.map(m => m.full_name).join('، ')}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={total === specificWeightLimit ? 'success' : 'warning'} size="sm">
                    المجموع: {total}% / {specificWeightLimit}%
                  </Badge>
                  <Badge variant="info" size="sm">
                    {list.filter(c => c.is_active).length} معيار نشط
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
                <div className="px-6 py-8 text-center text-gray-500 text-sm">
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
                            className={`${!criterion.is_active ? 'opacity-60 bg-gray-50' : ''} ${isExpanded ? 'bg-orange-50/40' : ''}`}
                            onClick={() => setExpandedId(isExpanded ? null : criterion.id)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
                                <button onClick={() => handleReorderCriterion(criterion, 'up')} disabled={index === 0}
                                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500">
                                  <ArrowUp className="h-4 w-4" />
                                </button>
                                <span className="text-gray-400 text-sm font-mono w-6 text-center">{criterion.order}</span>
                                <button onClick={() => handleReorderCriterion(criterion, 'down')} disabled={index === list.length - 1}
                                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500">
                                  <ArrowDown className="h-4 w-4" />
                                </button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-gray-200 rounded-full h-2">
                                  <div className="bg-orange-500 h-2 rounded-full transition-all"
                                    style={{ width: `${(criterion.weight / specificWeightLimit) * 100}%` }} />
                                </div>
                                <span className="font-bold text-orange-600">{criterion.weight}%</span>
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
                            <tr className="bg-orange-50/40 border-b border-orange-100">
                              <td colSpan={6} className="px-6 py-4">
                                <div className="bg-white rounded-lg border border-orange-100 p-4">
                                  <p className="text-xs font-semibold text-orange-700 mb-1">الوصف الكامل</p>
                                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                                    {criterion.description || <span className="text-gray-400 italic">لا يوجد وصف</span>}
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
            </CardBody>
          </Card>
        );
      })}

      {/* Group create/edit modal */}
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
              placeholder="مثال: فريق التصوير"
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الموظفون المشمولون
                <span className="text-xs text-gray-500 mr-2">— اختر من بين موظفي مهمة الإشراف</span>
              </label>
              <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                {members.length === 0 && (
                  <p className="p-4 text-sm text-gray-500 text-center">لا يوجد موظفون في هذه المهمة بعد</p>
                )}
                {members.map(m => {
                  const checked = groupForm.memberIds.has(m.employee_id);
                  const otherGroupId = groupMembership[m.employee_id];
                  const otherGroup = otherGroupId && otherGroupId !== editingGroup?.id ? groups.find(g => g.id === otherGroupId) : null;
                  return (
                    <label key={m.employee_id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMemberInForm(m.employee_id)}
                        className="rounded border-gray-300"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.full_name}</p>
                        {m.job_title && <p className="text-xs text-gray-500 truncate">{m.job_title}</p>}
                      </div>
                      {otherGroup && (
                        <Badge variant="warning" size="sm">حالياً في: {otherGroup.name}</Badge>
                      )}
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                إضافة موظف إلى هذه المجموعة سيخرجه من مجموعته السابقة (موظف واحد لمجموعة واحدة فقط لكل مهمة).
              </p>
            </div>
          </div>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsGroupModalOpen(false)}>إلغاء</Button>
            <Button type="submit" loading={savingGroup}>{editingGroup ? 'تحديث' : 'إنشاء'}</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Group delete modal */}
      <Modal isOpen={isDeleteGroupModalOpen} onClose={() => setIsDeleteGroupModalOpen(false)} title="حذف المجموعة">
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-gray-900 text-lg font-medium mb-2">هل أنت متأكد من حذف هذه المجموعة؟</p>
          <p className="text-gray-500 text-sm">
            سيتم حذف مجموعة <span className="font-bold text-gray-700">{deleteGroupTarget?.name}</span> وجميع معاييرها نهائياً.
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

      {/* Criterion add/edit modal */}
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
              placeholder="مثال: 10" min={1} max={specificWeightLimit} required />
            {editingCriterion && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <Toggle checked={criterionForm.is_active} onChange={() => setCriterionForm({ ...criterionForm, is_active: !criterionForm.is_active })} />
                <span className="text-sm font-medium text-gray-700">{criterionForm.is_active ? 'المعيار نشط' : 'المعيار معطل'}</span>
              </div>
            )}
          </div>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsCriterionModalOpen(false)}>إلغاء</Button>
            <Button type="submit" loading={savingCriterion}>{editingCriterion ? 'تحديث' : 'إضافة'}</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Criterion delete modal */}
      <Modal isOpen={isDeleteCriterionModalOpen} onClose={() => setIsDeleteCriterionModalOpen(false)} title="تأكيد الحذف">
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-gray-900 text-lg font-medium mb-2">هل أنت متأكد من حذف هذا المعيار؟</p>
          <p className="text-gray-500 text-sm">
            سيتم حذف معيار <span className="font-bold text-gray-700">{deleteCriterionTarget?.title}</span> نهائياً.
          </p>
        </div>
        <ModalFooter className="justify-center">
          <Button type="button" variant="secondary" onClick={() => setIsDeleteCriterionModalOpen(false)}>إلغاء</Button>
          <Button type="button" variant="danger" onClick={handleDeleteCriterion} loading={deletingCriterion}>
            <span className="flex items-center gap-1"><Trash2 className="h-4 w-4" /><span>حذف المعيار</span></span>
          </Button>
        </ModalFooter>
      </Modal>

      {/* Suppress unused-variable noise */}
      <span className="hidden"><GripVertical /><Scale /><X /></span>
    </div>
  );
};
