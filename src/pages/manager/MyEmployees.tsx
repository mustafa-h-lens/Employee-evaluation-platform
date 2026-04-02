import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Users, Search, Mail, Phone, Briefcase, Calendar, FileCheck, FileClock, Clipboard as ClipboardEdit, Eye } from 'lucide-react';

interface Employee {
  id: string;
  employee_number: string;
  full_name: string;
  email: string;
  phone: string;
  job_title: string;
  hire_date: string;
  status: string;
  department_name?: string;
  evaluation_status?: string | null;
  final_score_5?: number | null;
  general_rating?: string | null;
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

interface MyEmployeesProps {
  onNavigate?: (path: string) => void;
}

export const MyEmployees: React.FC<MyEmployeesProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const fetchEmployees = useCallback(async () => {
    if (!user) return;
    try {
      const { data: emps, error } = await supabase
        .from('employees')
        .select('id, employee_number, full_name, email, phone, job_title, hire_date, status, department_id')
        .eq('manager_id', user.id)
        .order('full_name');

      if (error || !emps) {
        setLoading(false);
        return;
      }

      const deptIds = [...new Set(emps.map(e => e.department_id).filter(Boolean))];
      let deptMap = new Map<string, string>();
      if (deptIds.length > 0) {
        const { data: depts } = await supabase
          .from('departments')
          .select('id, name')
          .in('id', deptIds);
        deptMap = new Map(depts?.map(d => [d.id, d.name]) || []);
      }

      const { data: activePeriod } = await supabase
        .from('evaluation_periods')
        .select('id')
        .eq('status', 'نشطة')
        .maybeSingle();

      let evalMap = new Map<string, { status: string; final_score_5: number | null; general_rating: string | null }>();
      if (activePeriod) {
        const { data: evals } = await supabase
          .from('evaluations')
          .select('employee_id, status, final_score_5, general_rating')
          .eq('manager_id', user.id)
          .eq('period_id', activePeriod.id);

        if (evals) {
          evalMap = new Map(evals.map(ev => [ev.employee_id, { status: ev.status, final_score_5: ev.final_score_5, general_rating: ev.general_rating }]));
        }
      }

      const enriched: Employee[] = emps.map(emp => ({
        ...emp,
        department_name: deptMap.get(emp.department_id) || '-',
        evaluation_status: evalMap.get(emp.id)?.status || null,
        final_score_5: evalMap.get(emp.id)?.final_score_5 || null,
        general_rating: evalMap.get(emp.id)?.general_rating || null,
      }));

      setEmployees(enriched);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const filtered = employees.filter(emp =>
    emp.full_name.includes(searchQuery) ||
    emp.employee_number.includes(searchQuery) ||
    emp.job_title.includes(searchQuery) ||
    emp.email.includes(searchQuery)
  );

  const activeCount = employees.filter(e => e.status === 'active').length;
  const evaluatedCount = employees.filter(e => e.evaluation_status && e.evaluation_status !== 'مسودة').length;
  const pendingCount = employees.filter(e => !e.evaluation_status || e.evaluation_status === 'مسودة').length;

  if (loading) {
    return <div className="flex items-center justify-center h-64">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">موظفو القسم</h1>
        <p className="text-gray-600 mt-2">عرض وإدارة بيانات الموظفين التابعين لك</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">إجمالي الموظفين</p>
                <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
                <p className="text-xs text-gray-500 mt-1">{activeCount} نشط</p>
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
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="بحث بالاسم أو الرقم الوظيفي أو المسمى..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              message={searchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد موظفون تابعون لك حاليًا'}
              icon={<Users className="h-12 w-12 text-gray-400" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الموظف</TableHead>
                  <TableHead>الرقم الوظيفي</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>المسمى الوظيفي</TableHead>
                  <TableHead>التقييم الحالي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((emp) => (
                  <TableRow
                    key={emp.id}
                    onClick={() => setSelectedEmployee(selectedEmployee?.id === emp.id ? null : emp)}
                    className={selectedEmployee?.id === emp.id ? 'bg-blue-50' : ''}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                          {emp.full_name.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900">{emp.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-500 text-sm font-mono">{emp.employee_number}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-500 text-sm">{emp.email}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-600 text-sm">{emp.job_title}</span>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {selectedEmployee && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">تفاصيل الموظف</h2>
              <button
                onClick={() => setSelectedEmployee(null)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                إغلاق
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <DetailItem
                icon={<Users className="h-5 w-5" />}
                label="الاسم الكامل"
                value={selectedEmployee.full_name}
              />
              <DetailItem
                icon={<Briefcase className="h-5 w-5" />}
                label="المسمى الوظيفي"
                value={selectedEmployee.job_title}
              />
              <DetailItem
                icon={<Mail className="h-5 w-5" />}
                label="البريد الإلكتروني"
                value={selectedEmployee.email}
              />
              <DetailItem
                icon={<Phone className="h-5 w-5" />}
                label="رقم الهاتف"
                value={selectedEmployee.phone || '-'}
              />
              <DetailItem
                icon={<Calendar className="h-5 w-5" />}
                label="تاريخ التعيين"
                value={new Date(selectedEmployee.hire_date).toLocaleDateString('ar-SA')}
              />
            </div>

            {selectedEmployee.evaluation_status && selectedEmployee.evaluation_status !== 'مسودة' && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-3">نتيجة التقييم الحالي</h3>
                <div className="flex items-center gap-4">
                  {selectedEmployee.general_rating && (
                    <Badge variant={getRatingBadgeVariant(selectedEmployee.general_rating)} size="lg">
                      {selectedEmployee.general_rating}
                    </Badge>
                  )}
                  {selectedEmployee.final_score_5 && (
                    <span className="text-lg font-bold text-gray-900">
                      {selectedEmployee.final_score_5.toFixed(2)} / 5
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
};

const DetailItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="text-gray-400 mt-0.5">{icon}</div>
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  </div>
);
