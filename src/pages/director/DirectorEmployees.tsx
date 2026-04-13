import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Users, Search, Mail, Briefcase, FileCheck, FileClock, Clipboard as ClipboardEdit, Eye, Calendar, AlertTriangle } from 'lucide-react';

interface EmployeeInfo {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  job_title: string;
  department_name: string;
  employee_number?: string;
  evaluation_status?: string | null;
  general_rating?: string | null;
  percentage?: number | null;
}

const getRatingBadgeVariant = (rating: string | null): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
  if (!rating) return 'default';
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
    'ممتاز': 'success',
    'جيد جدًا': 'info',
    'جيد': 'warning',
    'يحتاج تحسين': 'danger',
  };
  return map[rating] || 'default';
};

const getEvalStatusLabel = (status: string | null): string => {
  if (!status || status === 'مسودة') return 'بانتظار التقييم';
  if (status === 'بانتظار الموافقة') return 'بانتظار اعتماد التقييم';
  if (status === 'موافقة' || status === 'اطلع الموظف' || status === 'مغلق') return 'تم اعتماد التقييم';
  if (status === 'مرفوض') return 'مرفوض';
  return status;
};

const getEvalStatusVariant = (status: string | null): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
  if (!status || status === 'مسودة') return 'default';
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
    'بانتظار الموافقة': 'warning',
    'موافقة': 'success',
    'اطلع الموظف': 'success',
    'مغلق': 'success',
    'مرفوض': 'danger',
  };
  return map[status] || 'default';
};

interface DirectorEmployeesProps {
  onNavigate?: (path: string) => void;
}

interface PeriodOption {
  id: string;
  year: number;
  month: number;
  status: string;
}

const monthLabels: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
};

export const DirectorEmployees: React.FC<DirectorEmployeesProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [allPeriods, setAllPeriods] = useState<PeriodOption[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [hasSpecificCriteria, setHasSpecificCriteria] = useState(false);

  // Fetch periods once
  useEffect(() => {
    const fetchPeriods = async () => {
      const { data: periods } = await supabase
        .from('evaluation_periods')
        .select('id, year, month, status')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      setAllPeriods(periods || []);
      const active = (periods || []).find(p => p.status === 'نشطة');
      if (active) setSelectedPeriodId(active.id);
      else if (periods && periods.length > 0) setSelectedPeriodId(periods[0].id);
    };
    fetchPeriods();
  }, []);

  // Check if director has specific criteria (skip if general weight is 100%)
  useEffect(() => {
    const checkCriteria = async () => {
      if (!user) return;
      const [{ data }, { data: weightSettings }] = await Promise.all([
        supabase
          .from('department_criteria')
          .select('id')
          .is('department_id', null)
          .eq('created_by', user.id)
          .eq('is_active', true)
          .limit(1),
        supabase
          .from('evaluation_settings')
          .select('specific_weight')
          .limit(1)
          .single(),
      ]);
      const noSpecificNeeded = weightSettings?.specific_weight === 0;
      setHasSpecificCriteria(noSpecificNeeded || !!(data && data.length > 0));
    };
    checkCriteria();
  }, [user]);

  const fetchEmployees = useCallback(async () => {
    if (!user || !selectedPeriodId) return;
    try {
      setLoading(true);

      // Find directorate (check both primary and secondary director)
      const { data: directorates } = await supabase
        .from('directorates')
        .select('id, name')
        .or(`director_id.eq.${user.id},secondary_director_id.eq.${user.id}`);

      const directorate = directorates?.[0];
      if (!directorate) {
        setLoading(false);
        return;
      }

      // Find employees assigned to this directorate (via junction table)
      const { data: assignmentData } = await supabase
        .from('employee_directorates')
        .select('employee_id')
        .eq('directorate_id', directorate.id);

      const assignedEmpIds = (assignmentData || []).map(a => a.employee_id);

      // Also get employees with legacy directorate_id (backward compat)
      const { data: legacyEmps } = await supabase
        .from('employees')
        .select('id')
        .eq('directorate_id', directorate.id);

      const allEmpIds = [...new Set([...assignedEmpIds, ...(legacyEmps || []).map(e => e.id)])];

      if (allEmpIds.length === 0) {
        setEmployees([]);
        setLoading(false);
        return;
      }

      const { data: empData } = await supabase
        .from('employees')
        .select('id, user_id, full_name, email, job_title, employee_number, directorate_id')
        .in('id', allEmpIds)
        .order('full_name');

      if (!empData || empData.length === 0) {
        setEmployees([]);
        setLoading(false);
        return;
      }

      // Get eval statuses
      const empIds = empData.map(e => e.id);
      const { data: evals } = await supabase
        .from('evaluations')
        .select('employee_id, status, general_rating, percentage')
        .eq('manager_id', user.id)
        .eq('period_id', selectedPeriodId)
        .in('employee_id', empIds);

      const evalMap = new Map<string, { status: string; general_rating: string | null; percentage: number | null }>();
      if (evals) {
        evals.forEach(ev => {
          evalMap.set(ev.employee_id, {
            status: ev.status,
            general_rating: ev.general_rating,
            percentage: ev.percentage,
          });
        });
      }

      const enriched: EmployeeInfo[] = empData.map(emp => ({
        id: emp.id,
        user_id: emp.user_id,
        full_name: emp.full_name,
        email: emp.email,
        job_title: emp.job_title || '',
        department_name: directorate.name,
        employee_number: emp.employee_number || '',
        evaluation_status: evalMap.get(emp.id)?.status || null,
        general_rating: evalMap.get(emp.id)?.general_rating || null,
        percentage: evalMap.get(emp.id)?.percentage || null,
      }));

      setEmployees(enriched);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedPeriodId]);

  useEffect(() => {
    if (selectedPeriodId) fetchEmployees();
  }, [selectedPeriodId, fetchEmployees]);

  const filtered = employees.filter(m =>
    m.full_name.includes(searchQuery) ||
    m.email.includes(searchQuery) ||
    m.department_name.includes(searchQuery) ||
    m.job_title.includes(searchQuery)
  );

  const evaluatedCount = employees.filter(m => m.evaluation_status && m.evaluation_status !== 'مسودة').length;
  const pendingCount = employees.filter(m => !m.evaluation_status || m.evaluation_status === 'مسودة').length;

  if (loading) {
    return <div className="flex items-center justify-center h-64">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">الموظفون</h1>
        <p className="text-gray-600 mt-2">عرض وتقييم الموظفين التابعين لإدارتك</p>
      </div>

      {!hasSpecificCriteria && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            لم يتم إعداد معايير التقييم بعد. يرجى إضافة معايير التقييم أولاً قبل البدء بتقييم الموظفين.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">إجمالي الموظفين</p>
                <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
              </div>
              <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">تم تقييمهم</p>
                <p className="text-2xl font-bold text-green-600">{evaluatedCount}</p>
              </div>
              <div className="bg-green-50 text-green-600 p-3 rounded-xl">
                <FileCheck className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">بانتظار التقييم</p>
                <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              </div>
              <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
                <FileClock className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="بحث بالاسم أو البريد أو الإدارة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {allPeriods.map(p => (
                  <option key={p.id} value={p.id}>
                    {monthLabels[p.month]} {p.year} {p.status === 'نشطة' ? '(نشطة)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              message={searchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد موظفون تابعون لإدارتك حاليًا'}
              icon={<Users className="h-12 w-12 text-gray-400" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الموظف</TableHead>
                  <TableHead>الرقم الوظيفي</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>الإدارة</TableHead>
                  <TableHead>التقييم الحالي</TableHead>
                  <TableHead>إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((emp) => {
                  const isPending = !emp.evaluation_status || emp.evaluation_status === 'مسودة';
                  const isEvalDisabled = isPending && !hasSpecificCriteria;

                  return (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                            {emp.full_name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">{emp.full_name}</span>
                            {emp.job_title && (
                              <p className="text-xs text-gray-500">{emp.job_title}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-500 text-sm font-mono">{emp.employee_number || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-500 text-sm">{emp.email}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 text-sm">{emp.department_name}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {emp.evaluation_status && emp.evaluation_status !== 'مسودة' && emp.general_rating ? (
                            <Badge variant={getRatingBadgeVariant(emp.general_rating)} size="sm">
                              {emp.general_rating}
                            </Badge>
                          ) : (
                            <Badge variant={getEvalStatusVariant(emp.evaluation_status)} size="sm">
                              {getEvalStatusLabel(emp.evaluation_status)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => onNavigate?.(`/director-evaluate?employee=${emp.id}`)}
                          disabled={isEvalDisabled}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            isEvalDisabled
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : isPending
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {isPending ? (
                            <>
                              <ClipboardEdit className="h-4 w-4" />
                              تقييم
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4" />
                              عرض
                            </>
                          )}
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
