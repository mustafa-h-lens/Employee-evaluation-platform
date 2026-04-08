import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { ClipboardList, Building2, Scale, Filter } from 'lucide-react';

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
  department_id: string;
  title: string;
  description: string;
  weight: number;
  order: number;
  is_active: boolean;
}

interface Department {
  id: string;
  name: string;
}

export const CriteriaOverview: React.FC = () => {
  const [generalCriteria, setGeneralCriteria] = useState<GeneralCriterion[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptCriteriaMap, setDeptCriteriaMap] = useState<Record<string, DeptCriterion[]>>({});
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [generalWeight, setGeneralWeight] = useState(50);
  const [specificWeight, setSpecificWeight] = useState(50);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [settingsRes, criteriaRes, deptsRes, deptCriteriaRes] = await Promise.all([
        supabase.from('evaluation_settings').select('*').limit(1).single(),
        supabase.from('evaluation_criteria').select('*').order('order'),
        supabase.from('departments').select('id, name').eq('status', 'active').order('name'),
        supabase.from('department_criteria').select('*').order('order'),
      ]);

      if (settingsRes.data) {
        setGeneralWeight(settingsRes.data.general_weight);
        setSpecificWeight(settingsRes.data.specific_weight);
      }

      setGeneralCriteria(criteriaRes.data || []);
      setDepartments((deptsRes.data as unknown as Department[]) || []);

      const map: Record<string, DeptCriterion[]> = {};
      (deptCriteriaRes.data || []).forEach((c: DeptCriterion) => {
        if (!map[c.department_id]) map[c.department_id] = [];
        map[c.department_id].push(c);
      });
      setDeptCriteriaMap(map);
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
  const filteredDepts = selectedDeptId === 'all' ? departments : departments.filter(d => d.id === selectedDeptId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">نظرة عامة على المعايير</h1>
        <p className="text-gray-600 mt-2">عرض المعايير العامة والخاصة لجميع الإدارات</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">وزن المعايير العامة</p>
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
                <p className="text-sm text-gray-600 mb-1">وزن المعايير الخاصة</p>
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
                <p className="text-sm text-gray-600 mb-1">عدد الإدارات</p>
                <p className="text-xl font-bold text-gray-900">{departments.length}</p>
              </div>
              <div className="bg-gray-100 text-gray-600 p-3 rounded-xl">
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
            <h2 className="text-lg font-bold text-gray-900">المعايير العامة ({generalWeight}%)</h2>
            <Badge variant={generalTotal === generalWeight ? 'success' : 'warning'} size="sm">
              المجموع: {generalTotal}%
            </Badge>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {generalCriteria.length === 0 ? (
            <EmptyState
              message="لا توجد معايير عامة"
              icon={<ClipboardList className="h-12 w-12 text-gray-400" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الوزن</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead>المعيار</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generalCriteria.map(c => (
                  <TableRow key={c.id} className={!c.is_active ? 'opacity-60 bg-gray-50' : ''}>
                    <TableCell>
                      <Badge variant={c.is_active ? 'success' : 'default'} size="sm">
                        {c.is_active ? 'نشط' : 'معطل'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-blue-600">{c.weight}%</span>
                    </TableCell>
                    <TableCell>
                      <p className="text-gray-500 text-sm max-w-xs truncate">{c.description}</p>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-gray-900">{c.title}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Department Filter */}
      <div className="flex items-center gap-3">
        <Filter className="h-5 w-5 text-gray-500" />
        <label className="text-sm font-medium text-gray-700">عرض المعايير الخاصة لـ:</label>
        <select
          value={selectedDeptId}
          onChange={(e) => setSelectedDeptId(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">جميع الإدارات</option>
          {departments.map(dept => (
            <option key={dept.id} value={dept.id}>{dept.name}</option>
          ))}
        </select>
      </div>

      {/* Specific Criteria Per Department */}
      {filteredDepts.map(dept => {
        const deptCriteria = deptCriteriaMap[dept.id] || [];
        const activeCriteria = deptCriteria.filter(c => c.is_active);
        const deptTotal = activeCriteria.reduce((s, c) => s + c.weight, 0);

        return (
          <Card key={dept.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{dept.name}</h2>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={deptTotal === specificWeight ? 'success' : 'warning'} size="sm">
                    المجموع: {deptTotal}% / {specificWeight}%
                  </Badge>
                  <Badge variant="info" size="sm">
                    {activeCriteria.length} معيار
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {deptCriteria.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">
                  لم يتم تحديد معايير خاصة لهذه الإدارة بعد
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الوزن</TableHead>
                      <TableHead>الوصف</TableHead>
                      <TableHead>المعيار</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deptCriteria.map(c => (
                      <TableRow key={c.id} className={!c.is_active ? 'opacity-60 bg-gray-50' : ''}>
                        <TableCell>
                          <Badge variant={c.is_active ? 'success' : 'default'} size="sm">
                            {c.is_active ? 'نشط' : 'معطل'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-emerald-600">{c.weight}%</span>
                        </TableCell>
                        <TableCell>
                          <p className="text-gray-500 text-sm max-w-xs truncate">{c.description}</p>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-gray-900">{c.title}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
};
