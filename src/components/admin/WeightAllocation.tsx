import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Card, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Building2, Shield, Crown, Save, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { invalidateWeightsCache } from '../../lib/weights';

interface DirectorateRow {
  id: string;
  name: string;
}

interface SupervisorAssignmentRow {
  id: string;
  title: string | null;
  user: { full_name: string } | null;
}

interface GroupRow {
  id: string;
  name: string;
  is_default: boolean;
  general_weight: number;
  specific_weight: number;
  parent_id: string;       // directorate_id or assignment_id
  member_count: number;
}

interface PendingChange {
  general: number;
  specific: number;
}

const balance = (val: number): number => Math.max(0, Math.min(100, val));

type Section = 'directorates' | 'supervisors' | 'high';

export const WeightAllocation: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);

  const [directorates, setDirectorates] = useState<DirectorateRow[]>([]);
  const [dirGroups, setDirGroups] = useState<Record<string, GroupRow[]>>({});

  const [assignments, setAssignments] = useState<SupervisorAssignmentRow[]>([]);
  const [supGroups, setSupGroups] = useState<Record<string, GroupRow[]>>({});

  const [highMgmt, setHighMgmt] = useState<{ id: string; general: number; specific: number } | null>(null);

  const [pending, setPending] = useState<Record<string, PendingChange>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<Section | null>(null);
  const [expandedDir, setExpandedDir] = useState<Set<string>>(new Set());
  const [expandedAssignment, setExpandedAssignment] = useState<Set<string>>(new Set());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dirs, dirGrps, dirMems, sups, supGrps, supMems, hm] = await Promise.all([
        supabase.from('directorates').select('id, name').order('name'),
        supabase.from('department_criteria_groups')
          .select('id, name, is_default, general_weight, specific_weight, directorate_id')
          .order('order'),
        supabase.from('department_criteria_group_members').select('group_id'),
        supabase.from('supervisor_assignments')
          .select('id, title, user:users!supervisor_assignments_user_id_fkey(full_name)')
          .eq('status', 'active'),
        supabase.from('supervisor_criteria_groups')
          .select('id, name, is_default, general_weight, specific_weight, assignment_id')
          .order('order'),
        supabase.from('supervisor_criteria_group_members').select('group_id'),
        supabase.from('high_management_weight_settings')
          .select('id, general_weight, specific_weight').limit(1).maybeSingle(),
      ]);

      setDirectorates((dirs.data as unknown as DirectorateRow[]) || []);
      setAssignments(((sups.data || []) as any[]).map(a => ({
        id: a.id, title: a.title, user: a.user
          ? (Array.isArray(a.user) ? (a.user[0] as { full_name: string } | null) : (a.user as { full_name: string }))
          : null,
      })));

      const dirMembersByGroup: Record<string, number> = {};
      (dirMems.data || []).forEach((m: any) => { dirMembersByGroup[m.group_id] = (dirMembersByGroup[m.group_id] || 0) + 1; });
      const supMembersByGroup: Record<string, number> = {};
      (supMems.data || []).forEach((m: any) => { supMembersByGroup[m.group_id] = (supMembersByGroup[m.group_id] || 0) + 1; });

      const dgMap: Record<string, GroupRow[]> = {};
      (dirGrps.data || []).forEach((g: any) => {
        const row: GroupRow = {
          id: g.id, name: g.name, is_default: g.is_default,
          general_weight: g.general_weight, specific_weight: g.specific_weight,
          parent_id: g.directorate_id, member_count: dirMembersByGroup[g.id] || 0,
        };
        (dgMap[g.directorate_id] ||= []).push(row);
      });
      setDirGroups(dgMap);

      const sgMap: Record<string, GroupRow[]> = {};
      (supGrps.data || []).forEach((g: any) => {
        const row: GroupRow = {
          id: g.id, name: g.name, is_default: g.is_default,
          general_weight: g.general_weight, specific_weight: g.specific_weight,
          parent_id: g.assignment_id, member_count: supMembersByGroup[g.id] || 0,
        };
        (sgMap[g.assignment_id] ||= []).push(row);
      });
      setSupGroups(sgMap);

      if (hm.data) setHighMgmt({ id: hm.data.id, general: hm.data.general_weight, specific: hm.data.specific_weight });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleChange = (id: string, baseGen: number, baseSpec: number, field: 'general' | 'specific', value: number) => {
    const v = balance(value);
    const next: PendingChange = field === 'general'
      ? { general: v, specific: balance(100 - v) }
      : { general: balance(100 - v), specific: v };
    setPending(prev => ({ ...prev, [id]: next }));
    // Reset to no-pending when matches stored
    if (next.general === baseGen && next.specific === baseSpec) {
      setPending(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  const saveGroup = async (table: 'department_criteria_groups' | 'supervisor_criteria_groups',
                          group: GroupRow,
                          parentLabel: string) => {
    const change = pending[group.id];
    if (!change) return;
    setSavingId(group.id);
    try {
      const { error } = await supabase.from(table)
        .update({ general_weight: change.general, specific_weight: change.specific })
        .eq('id', group.id);
      if (error) { toast.error(error.message); return; }
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'تحديث أوزان مجموعة معايير',
          entity_type: table,
          entity_id: group.id,
          details: {
            name: group.name,
            parent: parentLabel,
            from: { general: group.general_weight, specific: group.specific_weight },
            to: { general: change.general, specific: change.specific },
          },
        });
      }
      toast.success(`تم تحديث أوزان "${group.name}"`);
      invalidateWeightsCache();
      setPending(prev => { const c = { ...prev }; delete c[group.id]; return c; });
      fetchAll();
    } finally {
      setSavingId(null);
    }
  };

  const saveHighMgmt = async () => {
    if (!highMgmt) return;
    const change = pending[highMgmt.id];
    if (!change) return;
    setSavingId(highMgmt.id);
    try {
      const { error } = await supabase.from('high_management_weight_settings')
        .update({ general_weight: change.general, specific_weight: change.specific })
        .eq('id', highMgmt.id);
      if (error) { toast.error(error.message); return; }
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'تحديث أوزان الإدارة العليا',
          entity_type: 'high_management_weight_settings',
          entity_id: highMgmt.id,
          details: {
            from: { general: highMgmt.general, specific: highMgmt.specific },
            to: { general: change.general, specific: change.specific },
          },
        });
      }
      toast.success('تم تحديث أوزان الإدارة العليا');
      invalidateWeightsCache();
      setPending(prev => { const c = { ...prev }; delete c[highMgmt.id]; return c; });
      fetchAll();
    } finally {
      setSavingId(null);
    }
  };

  const toggleDir = (id: string) => {
    setExpandedDir(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAssignment = (id: string) => {
    setExpandedAssignment(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loading) return <div className="flex items-center justify-center py-8 text-ds-faint">جاري التحميل...</div>;

  const renderRow = (
    group: GroupRow,
    table: 'department_criteria_groups' | 'supervisor_criteria_groups',
    parentLabel: string,
  ) => {
    const change = pending[group.id];
    const gen = change?.general ?? group.general_weight;
    const spec = change?.specific ?? group.specific_weight;
    const dirty = !!change;
    return (
      <div key={group.id}
        className={`border rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap ${dirty ? 'border-ds-warning-border bg-ds-warning-bg/40' : 'border-ds-border-subtle bg-ds-bg'}`}>
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-medium text-ds-text">{group.name}</span>
          {group.is_default && <Badge variant="info" size="sm">افتراضية</Badge>}
          <Badge variant="default" size="sm">{group.member_count} موظف</Badge>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-xs text-blue-600 font-medium">عامة</span>
            <input
              type="number" min={0} max={100} value={gen}
              onChange={e => handleChange(group.id, group.general_weight, group.specific_weight, 'general', parseInt(e.target.value) || 0)}
              className="w-16 text-center text-sm font-bold text-blue-600 border border-ds-info-border rounded-lg px-2 py-1"
            />
            <span className="text-blue-600 text-xs">%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-emerald-600 font-medium">خاصة</span>
            <input
              type="number" min={0} max={100} value={spec}
              onChange={e => handleChange(group.id, group.general_weight, group.specific_weight, 'specific', parseInt(e.target.value) || 0)}
              className="w-16 text-center text-sm font-bold text-emerald-600 border border-ds-success-border rounded-lg px-2 py-1"
            />
            <span className="text-emerald-600 text-xs">%</span>
          </div>
          <Button
            size="sm" variant={dirty ? 'primary' : 'outline'}
            disabled={!dirty}
            loading={savingId === group.id}
            onClick={() => saveGroup(table, group, parentLabel)}
            className="flex items-center gap-1"
          >
            <Save className="h-3.5 w-3.5" />
            <span>حفظ</span>
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-ds-info-bg border border-ds-info-border rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-ds-info-text leading-relaxed">
          توزيع الأوزان الجديد يطبَّق على التقييمات الجديدة وعلى المسودات عند إعادة الحفظ. التقييمات المرسلة سابقاً تظل بنتائجها الحالية.
        </p>
      </div>

      {/* Block A: Directorates */}
      <Card>
        <CardBody className="p-0">
          <button
            type="button"
            onClick={() => setOpenSection(openSection === 'directorates' ? null : 'directorates')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-ds-bg transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-ds-success-bg text-ds-success rounded-lg flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="text-right">
                <h3 className="font-semibold text-ds-text">أوزان الإدارات</h3>
                <p className="text-xs text-ds-faint">{directorates.length} إدارة — توزيع لكل مجموعة معايير</p>
              </div>
            </div>
            {openSection === 'directorates' ? <ChevronUp className="h-4 w-4 text-ds-faint" /> : <ChevronDown className="h-4 w-4 text-ds-faint" />}
          </button>
          {openSection === 'directorates' && (
            <div className="border-t border-ds-border-subtle px-5 py-4 space-y-3">
              {directorates.length === 0 && <p className="text-sm text-ds-faint text-center py-4">لا توجد إدارات</p>}
              {directorates.map(dir => {
                const groups = dirGroups[dir.id] || [];
                const isOpen = expandedDir.has(dir.id);
                return (
                  <div key={dir.id} className="border border-ds-border rounded-lg">
                    <button
                      type="button"
                      onClick={() => toggleDir(dir.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-ds-bg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ds-text">{dir.name}</span>
                        <Badge variant="default" size="sm">{groups.length} مجموعة</Badge>
                      </div>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-ds-faint" /> : <ChevronDown className="h-4 w-4 text-ds-faint" />}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 space-y-2">
                        {groups.length === 0 ? (
                          <p className="text-xs text-ds-faint text-center py-2">لا توجد مجموعات</p>
                        ) : groups.map(g => renderRow(g, 'department_criteria_groups', dir.name))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Block B: Supervisors */}
      <Card>
        <CardBody className="p-0">
          <button
            type="button"
            onClick={() => setOpenSection(openSection === 'supervisors' ? null : 'supervisors')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-ds-bg transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-ds-warning-bg text-ds-warning rounded-lg flex items-center justify-center">
                <Shield className="h-4 w-4" />
              </div>
              <div className="text-right">
                <h3 className="font-semibold text-ds-text">أوزان المشرفين</h3>
                <p className="text-xs text-ds-faint">{assignments.length} مهمة إشراف نشطة — توزيع لكل مجموعة</p>
              </div>
            </div>
            {openSection === 'supervisors' ? <ChevronUp className="h-4 w-4 text-ds-faint" /> : <ChevronDown className="h-4 w-4 text-ds-faint" />}
          </button>
          {openSection === 'supervisors' && (
            <div className="border-t border-ds-border-subtle px-5 py-4 space-y-3">
              {assignments.length === 0 && <p className="text-sm text-ds-faint text-center py-4">لا توجد مهام إشراف نشطة</p>}
              {assignments.map(a => {
                const groups = supGroups[a.id] || [];
                const isOpen = expandedAssignment.has(a.id);
                const label = `${a.user?.full_name || '—'}${a.title ? ` · ${a.title}` : ''}`;
                return (
                  <div key={a.id} className="border border-ds-border rounded-lg">
                    <button
                      type="button"
                      onClick={() => toggleAssignment(a.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-ds-bg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ds-text">{label}</span>
                        <Badge variant="default" size="sm">{groups.length} مجموعة</Badge>
                      </div>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-ds-faint" /> : <ChevronDown className="h-4 w-4 text-ds-faint" />}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 space-y-2">
                        {groups.length === 0 ? (
                          <p className="text-xs text-ds-faint text-center py-2">لا توجد مجموعات</p>
                        ) : groups.map(g => renderRow(g, 'supervisor_criteria_groups', label))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Block C: High Management */}
      <Card>
        <CardBody className="p-0">
          <button
            type="button"
            onClick={() => setOpenSection(openSection === 'high' ? null : 'high')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-ds-bg transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-ds-purple-bg text-ds-purple rounded-lg flex items-center justify-center">
                <Crown className="h-4 w-4" />
              </div>
              <div className="text-right">
                <h3 className="font-semibold text-ds-text">أوزان الإدارة العليا</h3>
                <p className="text-xs text-ds-faint">تقييم المدراء من الإدارة العليا</p>
              </div>
            </div>
            {openSection === 'high' ? <ChevronUp className="h-4 w-4 text-ds-faint" /> : <ChevronDown className="h-4 w-4 text-ds-faint" />}
          </button>
          {openSection === 'high' && highMgmt && (
            <div className="border-t border-ds-border-subtle px-5 py-4">
              {(() => {
                const change = pending[highMgmt.id];
                const gen = change?.general ?? highMgmt.general;
                const spec = change?.specific ?? highMgmt.specific;
                const dirty = !!change;
                return (
                  <div className={`border rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap ${dirty ? 'border-ds-warning-border bg-ds-warning-bg/40' : 'border-ds-border-subtle bg-ds-bg'}`}>
                    <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="font-medium text-ds-text">الإدارة العليا</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-blue-600 font-medium">عامة</span>
                        <input
                          type="number" min={0} max={100} value={gen}
                          onChange={e => handleChange(highMgmt.id, highMgmt.general, highMgmt.specific, 'general', parseInt(e.target.value) || 0)}
                          className="w-16 text-center text-sm font-bold text-blue-600 border border-ds-info-border rounded-lg px-2 py-1"
                        />
                        <span className="text-blue-600 text-xs">%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-emerald-600 font-medium">خاصة</span>
                        <input
                          type="number" min={0} max={100} value={spec}
                          onChange={e => handleChange(highMgmt.id, highMgmt.general, highMgmt.specific, 'specific', parseInt(e.target.value) || 0)}
                          className="w-16 text-center text-sm font-bold text-emerald-600 border border-ds-success-border rounded-lg px-2 py-1"
                        />
                        <span className="text-emerald-600 text-xs">%</span>
                      </div>
                      <Button
                        size="sm" variant={dirty ? 'primary' : 'outline'}
                        disabled={!dirty}
                        loading={savingId === highMgmt.id}
                        onClick={saveHighMgmt}
                        className="flex items-center gap-1"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>حفظ</span>
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
