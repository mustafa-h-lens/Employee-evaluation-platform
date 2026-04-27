import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { ClipboardList, Building2, Scale, Filter, ChevronDown, ChevronUp } from 'lucide-react';
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

interface Department {
  id: string;
  name: string;
  directorate_id: string;
}

export const CriteriaOverview: React.FC = () => {
  const [generalCriteria, setGeneralCriteria] = useState<GeneralCriterion[]>([]);
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [dirCriteriaMap, setDirCriteriaMap] = useState<Record<string, DeptCriterion[]>>({});
  const [deptCriteriaMap, setDeptCriteriaMap] = useState<Record<string, DeptCriterion[]>>({});
  const [selectedDirId, setSelectedDirId] = useState<string>('all');
  const [generalWeight, setGeneralWeight] = useState(50);
  const [specificWeight, setSpecificWeight] = useState(50);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [settingsRes, criteriaRes, dirsRes, deptsRes, deptCriteriaRes] = await Promise.all([
        supabase.from('evaluation_settings').select('*').limit(1).single(),
        supabase.from('evaluation_criteria').select('*').order('order'),
        supabase.from('directorates').select('id, name').order('name'),
        supabase.from('departments').select('id, name, directorate_id').eq('status', 'active').order('name'),
        supabase.from('department_criteria').select('*').order('order'),
      ]);

      if (settingsRes.data) {
        setGeneralWeight(settingsRes.data.general_weight);
        setSpecificWeight(settingsRes.data.specific_weight);
      }

      setGeneralCriteria(criteriaRes.data || []);
      setDirectorates((dirsRes.data as unknown as Directorate[]) || []);
      setDepartments((deptsRes.data as unknown as Department[]) || []);

      const dirMap: Record<string, DeptCriterion[]> = {};
      const deptMap: Record<string, DeptCriterion[]> = {};
      (deptCriteriaRes.data || []).forEach((c: DeptCriterion) => {
        if (c.department_id) {
          (deptMap[c.department_id] ||= []).push(c);
        } else if (c.directorate_id) {
          (dirMap[c.directorate_id] ||= []).push(c);
        }
      });
      setDirCriteriaMap(dirMap);
      setDeptCriteriaMap(deptMap);
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

      {/* Specific Criteria — per department for multi-dept directorates, per directorate otherwise */}
      {filteredDirs.flatMap(dir => {
        const dirDepts = departments.filter(d => d.directorate_id === dir.id);
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
                      <h2 className="text-lg font-bold text-ds-text">{group.title}</h2>
                      {group.subtitle && (
                        <p className="text-sm text-ds-faint mt-0.5">قسم: {group.subtitle}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={total === specificWeight ? 'success' : 'warning'} size="sm">
                      المجموع: {total}% / {specificWeight}%
                    </Badge>
                    <Badge variant="info" size="sm">
                      {active.length} معيار
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardBody className="p-0">
                {group.list.length === 0 ? (
                  <div className="p-6 text-center text-ds-faint text-sm">
                    لم يتم تحديد معايير خاصة بعد
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
                      {group.list.map(c => {
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
        });
      })}
    </div>
  );
};
