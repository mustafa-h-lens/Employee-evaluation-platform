import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Users, FileCheck, FileClock, Target } from 'lucide-react';

const monthLabels: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
};

export const ManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    evaluated: 0,
    pending: 0
  });
  const [pendingEmployees, setPendingEmployees] = useState<any[]>([]);
  const [activePeriod, setActivePeriod] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchPendingEmployees();
      fetchActivePeriod();
    }
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;

    const { count: totalCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('manager_id', user.id);

    const { count: evaluatedCount } = await supabase
      .from('evaluations')
      .select('*', { count: 'exact', head: true })
      .eq('manager_id', user.id)
      .in('status', ['بانتظار الموافقة', 'موافقة', 'تم الإرسال', 'اطلع الموظف', 'مغلق']);

    setStats({
      totalEmployees: totalCount || 0,
      evaluated: evaluatedCount || 0,
      pending: (totalCount || 0) - (evaluatedCount || 0)
    });
  };

  const fetchPendingEmployees = async () => {
    if (!user) return;

    const { data: employees } = await supabase
      .from('employees')
      .select('id, full_name, job_title')
      .eq('manager_id', user.id)
      .limit(5);

    if (employees) {
      const employeesWithEvalStatus = await Promise.all(
        employees.map(async (emp) => {
          const { data: evaluation } = await supabase
            .from('evaluations')
            .select('status')
            .eq('employee_id', emp.id)
            .maybeSingle();

          return {
            ...emp,
            hasEvaluation: !!evaluation,
            evaluationStatus: evaluation?.status
          };
        })
      );

      setPendingEmployees(employeesWithEvalStatus.filter(e => !e.hasEvaluation || e.evaluationStatus === 'مسودة'));
    }
  };

  const fetchActivePeriod = async () => {
    const { data } = await supabase
      .from('evaluation_periods')
      .select('*')
      .eq('status', 'نشطة')
      .maybeSingle();

    setActivePeriod(data);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">لوحة تحكم المدير</h1>
        <p className="text-gray-600 mt-2">متابعة تقييمات موظفي القسم</p>
      </div>

      {activePeriod && (
        <Card>
          <CardBody className="bg-blue-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">فترة التقييم الحالية</p>
                <p className="text-lg font-bold text-blue-900">
                  {monthLabels[activePeriod.month]} - {activePeriod.year}
                </p>
              </div>
              <div className="text-left">
                <p className="text-sm text-blue-600">ينتهي في</p>
                <p className="font-medium text-blue-900">{new Date(activePeriod.end_date).toLocaleDateString('ar-SA')}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">عدد موظفي القسم</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalEmployees}</p>
              </div>
              <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
                <Users className="h-8 w-8" />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">تم تقييمهم</p>
                <p className="text-3xl font-bold text-green-600">{stats.evaluated}</p>
              </div>
              <div className="bg-green-50 text-green-600 p-3 rounded-xl">
                <FileCheck className="h-8 w-8" />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">المتبقي</p>
                <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
              </div>
              <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
                <FileClock className="h-8 w-8" />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {stats.pending > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">الموظفون الذين لم يتم تقييمهم</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {pendingEmployees.map((employee) => (
                <div key={employee.id} className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div>
                    <p className="font-medium text-gray-900">{employee.full_name}</p>
                    <p className="text-sm text-gray-600">{employee.job_title}</p>
                  </div>
                  <Button size="sm">ابدأ التقييم</Button>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">نسبة الإنجاز</h2>
        </CardHeader>
        <CardBody>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">التقدم الكلي</span>
              <span className="text-sm font-medium">
                {stats.totalEmployees > 0 ? Math.round((stats.evaluated / stats.totalEmployees) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all"
                style={{
                  width: `${stats.totalEmployees > 0 ? (stats.evaluated / stats.totalEmployees) * 100 : 0}%`
                }}
              ></div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
