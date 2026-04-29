import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { ClipboardList, Building2, Scale, Filter, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { ModernSelect } from '../../components/ui/ModernSelect';

interface GeneralCriterion {
  id: string;
  title: string;
  description: string;
  weight: number;
  order: number;
  is_active: boolean;
}

interface DeptCriterion {
  id: string;
  group_id: string | null;
  title: string;
  description: string;
  weight: number;
  order: number;
  is_active: boolean;
}

interface CriteriaGroup {
  id: string;
  directorate_id: string;
  name: string;
  order: number;
  is_default: boolean;
  member_names: string[];
}

interface Directorate {
  id: string;
  name: string;
}

export const CriteriaOverview: React.FC = () => {
  const [generalCriteria, setGeneralCriteria] = useState<GeneralCriterion[]>([]);
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [groupsByDirectorate, setGroupsByDirectorate] = useState<Record<string, CriteriaGroup[]>>({});
  const [criteriaByGroup, setCriteriaByGroup] = useState<Record<string, DeptCriterion[]>>({});
  const [selectedDirId, setSelectedDirId] = useState<string>('all');
  const [generalWeight, setGeneralWeight] = useState(50);
  const [specificWeight, setSpecificWeight] = useState(50);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [settingsRes, criteriaRes, dirsRes, groupsRes, deptCriteriaRes, membershipRes, employeesRes] = await Promise.all([
        supabase.from('evaluation_settings').select('*').limit(1).single(),
        supabase.from('evaluation_criteria').select('*').order('order'),
        supabase.from('directorates').select('id, name').order('name'),
        supabase.from('department_criteria_groups').select('*').order('order'),
        supabase.from('department_criteria').select('id, group_id, title, description, weight, order, is_active').order('order'),
        supabase.from('department_criteria_group_members').select('group_id, employee_id'),
        supabase.from('employees').select('id, full_name'),
      ]);

      if (settingsRes.data) {
        setGeneralWeight(settingsRes.data.general_weight);
        setSpecificWeight(settingsRes.data.specific_weight);
      }

      setGeneralCriteria(criteriaRes.data || []);
      setDirectorates((dirsRes.data as unknown as Directorate[]) || []);

      const empNameMap = new Map<string, string>(
        (employeesRes.data || []).map((e: any) => [e.id as string, (e.full_name as string) || 'موظف'])
      );
      const memberNamesByGroup: Record<string, string[]> = {};
      (membershipRes.data || []).forEach((row: any) => {
        const name = empNameMap.get(row.employee_id);
        if (!name) return;
        (memberNamesByGroup[row.group_id] ||= []).push(name);
      });

      const dirMap: Record<string, CriteriaGroup[]> = {};
      (groupsRes.data || []).forEach((g: any) => {
        const enriched: CriteriaGroup = {
          id: g.id,
          directorate_id: g.directorate_id,
          name: g.name,
          order: g.order,
          is_default: g.is_default,
          member_names: memberNamesByGroup[g.id] || [],
        };
        (dirMap[g.directorate_id] ||= []).push(enriched);
      });
      Object.values(dirMap).forEach(arr => arr.sort((a, b) => a.order - b.order));
      setGroupsByDirectorate(dirMap);

      const cMap: Record<string, DeptCriterion[]> = {};
      (deptCriteriaRes.data || []).forEach((c: any) => {
        if (!c.group_id) return;
        (cMap[c.group_id] ||= []).push(c as DeptCriterion);
      });
      Object.values(cMap).forEach(arr => arr.sort((a, b) => a.order - b.order));
      setCriteriaByGroup(cMap);
    } catch (error) {
      console.error('Error fetching criteria overview:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return <div className="flex items-center justify-center h-64">جاري التحميل...</div>;
  }

  const generalTotal = generalCriteria.filter(c => c.is_active).reduce((s, c) => s + c.weight, 0);
  const filteredDirs = selectedDirId === 'all' ? directorates : directorates.filter(d => d.id === selectedDirId);

  return (
    <div className="space-y-6">
      <div
        className="rounded-ds-xl p-8"
        style={{
          background: 'var(--sc-green-grad)',
          border: '1px solid var(--sc-green-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-green-val)' }}>نظرة عامة على المعايير</h1>
        <p className="mt-2" style={{ color: 'var(--sc-green-label)' }}>عرض المعايير العامة والخاصة لجميع الإدارات</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ds-muted mb-1">وزن المعايير العامة</p>
                <p className="text-xl font-bold text-blue-600">{generalWeight}%</p>
              </div>
              <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
                <Scale className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ds-muted mb-1">وزن المعايير الخاصة</p>
                <p className="text-xl font-bold text-emerald-600">{specificWeight}%</p>
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

      {/* General Criteria Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <h2 className="text-lg font-bold text-ds-text">المعايير العامة ({generalWeight}%)</h2>
            <Badge variant={generalTotal === generalWeight ? 'success' : 'warning'} size="sm">
              المجموع: {generalTotal}%
            </Badge>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {generalCriteria.length === 0 ? (
            <EmptyState
              message="لا توجد معايير عامة"
              icon={<ClipboardList className="h-12 w-12 text-ds-faint" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"> </TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الوزن</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead>المعيار</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generalCriteria.map(c => {
                  const isExpanded = expandedId === c.id;
                  return (
                    <React.Fragment key={c.id}>
                      <TableRow
                        className={`${!c.is_active ? 'opacity-60 bg-ds-bg' : ''} ${isExpanded ? 'bg-blue-50/40' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      >
                        <TableCell className="text-ds-faint">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.is_active ? 'success' : 'default'} size="sm">
                            {c.is_active ? 'نشط' : 'معطل'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-blue-600">{c.weight}%</span>
                        </TableCell>
                        <TableCell>
                          <p className="text-ds-faint text-sm max-w-xs truncate">{c.description}</p>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-ds-text">{c.title}</span>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-blue-50/40">
                          <TableCell colSpan={5} className="!whitespace-normal">
                            <div className="px-2 py-1">
                              <p className="text-xs font-semibold text-blue-700 mb-1">الوصف الكامل</p>
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

      {/* Directorate Filter */}
      <div className="flex items-center gap-3">
        <Filter className="h-5 w-5 text-ds-faint" />
        <label className="text-sm font-medium text-ds-muted">عرض المعايير الخاصة لـ:</label>
        <ModernSelect
          value={selectedDirId}
          onChange={setSelectedDirId}
          ariaLabel="تصفية بالإدارة"
          className="min-w-[260px]"
          options={[
            { value: 'all', label: 'جميع الإدارات' },
            ...directorates.map(dir => ({ value: dir.id, label: dir.name })),
          ]}
        />
      </div>

      {/* Specific criteria per directorate, broken down by group */}
      {filteredDirs.map(dir => {
        const dirGroups = groupsByDirectorate[dir.id] || [];
        return (
          <div key={dir.id} className="space-y-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-emerald-600" />
              <h2 className="text-xl font-bold text-ds-text">{dir.name}</h2>
              <Badge variant="info" size="sm">{dirGroups.length} مجموعة</Badge>
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
                const active = list.filter(c => c.is_active);
                const total = active.reduce((s, c) => s + c.weight, 0);
                return (
                  <Card key={group.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <h3 className="text-lg font-bold text-ds-text">{group.name}</h3>
                            {group.is_default && (
                              <Badge variant="info" size="sm">افتراضية</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-ds-muted">
                            <Users className="h-4 w-4" />
                            {group.member_names.length === 0 ? (
                              <span className="text-amber-600">لا يوجد موظفون مرتبطون</span>
                            ) : (
                              <span>{group.member_names.length} موظف: {group.member_names.join('، ')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={total === specificWeight ? 'success' : 'warning'} size="sm">
                            المجموع: {total}% / {specificWeight}%
                          </Badge>
                          <Badge variant="info" size="sm">{active.length} معيار</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardBody className="p-0">
                      {list.length === 0 ? (
                        <div className="p-6 text-center text-ds-faint text-sm">
                          لم يتم تحديد معايير في هذه المجموعة بعد
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-8"> </TableHead>
                              <TableHead>الحالة</TableHead>
                              <TableHead>الوزن</TableHead>
                              <TableHead>الوصف</TableHead>
                              <TableHead>المعيار</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {list.map(c => {
                              const isExpanded = expandedId === c.id;
                              return (
                                <React.Fragment key={c.id}>
                                  <TableRow
                                    className={`${!c.is_active ? 'opacity-60 bg-ds-bg' : ''} ${isExpanded ? 'bg-emerald-50/40' : ''}`}
                                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                                  >
                                    <TableCell className="text-ds-faint">
                                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={c.is_active ? 'success' : 'default'} size="sm">
                                        {c.is_active ? 'نشط' : 'معطل'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <span className="font-bold text-emerald-600">{c.weight}%</span>
                                    </TableCell>
                                    <TableCell>
                                      <p className="text-ds-faint text-sm max-w-xs truncate">{c.description}</p>
                                    </TableCell>
                                    <TableCell>
                                      <span className="font-bold text-ds-text">{c.title}</span>
                                    </TableCell>
                                  </TableRow>
                                  {isExpanded && (
                                    <TableRow className="bg-emerald-50/40">
                                      <TableCell colSpan={5} className="!whitespace-normal">
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
    </div>
  );
};
