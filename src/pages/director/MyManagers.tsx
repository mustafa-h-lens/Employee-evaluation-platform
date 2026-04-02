import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Users, Search, Mail, Briefcase, FileCheck, FileClock, Clipboard as ClipboardEdit, Eye, Calendar } from 'lucide-react';

interface Manager {
  id: string;
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

interface MyManagersProps {
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

export const MyManagers: React.FC<MyManagersProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [allPeriods, setAllPeriods] = useState<PeriodOption[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');

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

  const fetchManagers = useCallback(async () => {
    if (!user || !selectedPeriodId) return;
    try {
      setLoading(true);
      // Find the directorate where this user is the director
      const { data: directorate } = await supabase
        .from('directorates')
        .select('id')
        .eq('director_id', user.id)
        .maybeSingle();

      if (!directorate) {
        setLoading(false);
        return;
      }

      // Find departments under this directorate
      const { data: departments } = await supabase
        .from('departments')
        .select('id, name, manager_id')
        .eq('directorate_id', directorate.id);

      if (!departments || departments.length === 0) {
        setLoading(false);
        return;
      }

      // Get manager user info
      const managerIds = departments.map(d => d.manager_id).filter(Boolean);
      if (managerIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, email, job_title')
        .in('id', managerIds);

      let evalMap = new Map<string, { status: string; general_rating: string | null; percentage: number | null }>();
      const { data: evals } = await supabase
        .from('director_evaluations')
        .select('director_id, status, general_rating, percentage')
        .eq('evaluator_id', user.id)
        .eq('period_id', selectedPeriodId)
        .eq('evaluation_type', 'director_manager');

      if (evals) {
        evalMap = new Map(evals.map(ev => [ev.director_id, {
          status: ev.status,
          general_rating: ev.general_rating,
          percentage: ev.percentage,
        }]));
      }

      // Fetch employee_number from employees table via user_id
      const { data: empRecords } = await supabase
        .from('employees')
        .select('user_id, employee_number')
        .in('user_id', managerIds);
      const empNumMap = new Map((empRecords || []).map(e => [e.user_id, e.employee_number]));

      const deptMap = new Map(departments.map(d => [d.manager_id, d.name]));

      const enriched: Manager[] = (users || []).map(u => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        job_title: u.job_title || '',
        department_name: deptMap.get(u.id) || '-',
        employee_number: empNumMap.get(u.id) || '',
        evaluation_status: evalMap.get(u.id)?.status || null,
        general_rating: evalMap.get(u.id)?.general_rating || null,
        percentage: evalMap.get(u.id)?.percentage || null,
      }));

      setManagers(enriched);
    } catch (error) {
      console.error('Error fetching managers:', error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedPeriodId]);

  useEffect(() => {
    if (selectedPeriodId) fetchManagers();
  }, [selectedPeriodId, fetchManagers]);

  const filtered = managers.filter(m =>
    m.full_name.includes(searchQuery) ||
    m.email.includes(searchQuery) ||
    m.department_name.includes(searchQuery) ||
    m.job_title.includes(searchQuery)
  );

  const evaluatedCount = managers.filter(m => m.evaluation_status && m.evaluation_status !== 'مسودة').length;
  const pendingCount = managers.filter(m => !m.evaluation_status || m.evaluation_status === 'مسودة').length;

  if (loading) {
    return <div className="flex items-center justify-center h-64">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">مدراء الأقسام</h1>
        <p className="text-gray-600 mt-2">عرض وإدارة تقييمات مدراء الأقسام التابعين لإدارتك</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">إجمالي المدراء</p>
                <p className="text-2xl font-bold text-gray-900">{managers.length}</p>
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
                placeholder="بحث بالاسم أو البريد أو القسم..."
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
              message={searchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد مدراء أقسام تابعون لإدارتك حاليًا'}
              icon={<Users className="h-12 w-12 text-gray-400" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المدير</TableHead>
                  <TableHead>الرقم الوظيفي</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>القسم</TableHead>
                  <TableHead>التقييم الحالي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((mgr) => (
                  <TableRow key={mgr.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                          {mgr.full_name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">{mgr.full_name}</span>
                          {mgr.job_title && (
                            <p className="text-xs text-gray-500">{mgr.job_title}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-500 text-sm font-mono">{mgr.employee_number || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-500 text-sm">{mgr.email}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-600 text-sm">{mgr.department_name}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {mgr.evaluation_status && mgr.evaluation_status !== 'مسودة' && mgr.general_rating ? (
                          <Badge variant={getRatingBadgeVariant(mgr.general_rating)} size="sm">
                            {mgr.general_rating}
                          </Badge>
                        ) : (
                          <Badge variant={getEvalStatusVariant(mgr.evaluation_status)} size="sm">
                            {getEvalStatusLabel(mgr.evaluation_status)}
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
    </div>
  );
};
