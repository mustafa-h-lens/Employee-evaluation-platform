import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { FileText, TrendingUp, Target } from 'lucide-react';
import { percentageToRating } from '../../lib/scoring';

const monthLabels: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
};

export const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const [latestEvaluation, setLatestEvaluation] = useState<any>(null);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [developmentPlans, setDevelopmentPlans] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchEmployeeData();
      fetchLatestEvaluation();
    }
  }, [user]);

  const fetchEmployeeData = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('employees')
      .select(`
        *,
        department:departments(name, manager:users!departments_manager_id_fkey(full_name)),
        directorate:directorates(
          name,
          director:users!directorates_director_id_fkey(full_name),
          secondary_director:users!directorates_secondary_director_id_fkey(full_name)
        ),
        manager:users!employees_manager_id_fkey(full_name)
      `)
      .eq('user_id', user.id)
      .maybeSingle();

    setEmployeeData(data);
  };

  const resolveManagerLabel = (): string => {
    if (!employeeData) return '';
    // 1) Explicit direct manager
    if (employeeData.manager?.full_name) return employeeData.manager.full_name;
    // 2) Department manager
    if (employeeData.department?.manager?.full_name) return employeeData.department.manager.full_name;
    // 3) Directorate director(s) — primary + secondary if present
    const names = [
      employeeData.directorate?.director?.full_name,
      employeeData.directorate?.secondary_director?.full_name,
    ].filter(Boolean);
    return names.join(' و ');
  };

  const fetchLatestEvaluation = async () => {
    if (!user) return;

    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!employee) return;

    // Find the most recent period that has any visible evaluation, then load
    // ALL evaluations for that period (one per director). When there are two
    // directors, we combine them into a single "الإدارة العليا" card.
    const { data: latestRow } = await supabase
      .from('evaluations')
      .select('period_id')
      .eq('employee_id', employee.id)
      .in('status', ['موافقة', 'تم الإرسال', 'اطلع الموظف', 'مغلق'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestRow) return;

    const { data: rows } = await supabase
      .from('evaluations')
      .select(`
        *,
        period:evaluation_periods(year, month),
        manager:users!evaluations_manager_id_fkey(full_name)
      `)
      .eq('employee_id', employee.id)
      .eq('period_id', latestRow.period_id)
      .in('status', ['موافقة', 'تم الإرسال', 'اطلع الموظف', 'مغلق']);

    if (!rows || rows.length === 0) return;

    let combined: any;
    if (rows.length === 1) {
      combined = rows[0];
    } else {
      const avg = (key: string) =>
        rows.reduce((s, r: any) => s + (r[key] || 0), 0) / rows.length;
      const percentage = avg('percentage');
      combined = {
        ...rows[0],
        final_score_500: avg('final_score_500'),
        final_score_5: avg('final_score_5'),
        percentage,
        general_rating: percentageToRating(percentage),
        manager_note: null,
        is_combined: true,
        managers: rows.map((r: any) => ({
          id: r.id,
          name: r.manager?.full_name || '',
          note: r.manager_note || '',
        })),
      };
    }

    setLatestEvaluation(combined);

    // Load development plans tied to any of the underlying rows.
    const evalIds = rows.map((r: any) => r.id);
    const { data: devPlans } = await supabase
      .from('development_plans')
      .select('*')
      .in('evaluation_id', evalIds)
      .order('item_order');
    setDevelopmentPlans(devPlans || []);

    // Mark approved-but-not-yet-viewed rows as viewed. Never promote an
    // unapproved "تم الإرسال" — that previously bypassed CEO approval and
    // mislabelled pending evaluations as "تم اعتماد التقييم".
    const unseen = rows.filter((r: any) => r.status === 'موافقة').map((r: any) => r.id);
    if (unseen.length > 0) {
      await supabase
        .from('evaluations')
        .update({
          status: 'اطلع الموظف',
          viewed_by_employee_at: new Date().toISOString(),
        })
        .in('id', unseen);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">لوحة التحكم</h1>
        <p className="text-gray-600 mt-2">مرحبًا {user?.full_name}</p>
      </div>

      {employeeData && (
        <Card>
          <CardBody className="bg-blue-50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-blue-600">المسمى الوظيفي</p>
                <p className="font-semibold text-blue-900">{employeeData.job_title}</p>
              </div>
              <div>
                <p className="text-sm text-blue-600">الإدارة</p>
                <p className="font-semibold text-blue-900">{employeeData.department?.name}</p>
              </div>
              <div>
                <p className="text-sm text-blue-600">المدير المباشر</p>
                <p className="font-semibold text-blue-900">{resolveManagerLabel() || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-blue-600">رقم الموظف</p>
                <p className="font-semibold text-blue-900">{employeeData.employee_number}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {latestEvaluation ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">آخر تقييم</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    من: <span className="font-medium text-gray-700">{latestEvaluation.is_combined ? 'الإدارة العليا' : (latestEvaluation.manager?.full_name || '')}</span>
                  </p>
                </div>
                <Badge variant="info">
                  {monthLabels[latestEvaluation.period?.month || 1]} {latestEvaluation.period?.year}
                </Badge>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600 mb-2">الدرجة من 500</p>
                  <p className="text-4xl font-bold text-blue-600">{latestEvaluation.final_score_500?.toFixed(0)}</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-600 mb-2">التقييم من 5</p>
                  <p className="text-4xl font-bold text-green-600">{latestEvaluation.final_score_5?.toFixed(2)}</p>
                </div>
                <div className="text-center p-4 bg-indigo-50 rounded-lg">
                  <p className="text-sm text-indigo-600 mb-2">النسبة المئوية</p>
                  <p className="text-4xl font-bold text-indigo-600">{latestEvaluation.percentage?.toFixed(1)}%</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-600 mb-2">التقدير العام</p>
                  <Badge
                    variant={
                      latestEvaluation.percentage >= 90 ? 'success' :
                      latestEvaluation.percentage >= 70 ? 'info' : 'warning'
                    }
                    size="lg"
                  >
                    {latestEvaluation.general_rating}
                  </Badge>
                </div>
              </div>
            </CardBody>
          </Card>

          {latestEvaluation.is_combined ? (
            (latestEvaluation.managers || []).some((m: any) => m.note) && (
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900">ملاحظات المدير المباشر</h2>
                </CardHeader>
                <CardBody>
                  <div className="space-y-4">
                    {(latestEvaluation.managers || [])
                      .filter((m: any) => m.note)
                      .map((m: any) => (
                        <div key={m.id} className="border-r-4 border-blue-400 pr-4">
                          <p className="text-sm font-semibold text-blue-700 mb-1">{m.name}</p>
                          <p className="text-gray-700 leading-relaxed">{m.note}</p>
                        </div>
                      ))}
                  </div>
                </CardBody>
              </Card>
            )
          ) : (
            latestEvaluation.manager_note && (
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900">ملاحظات المدير المباشر</h2>
                </CardHeader>
                <CardBody>
                  <p className="text-gray-700 leading-relaxed">{latestEvaluation.manager_note}</p>
                </CardBody>
              </Card>
            )
          )}

          {developmentPlans.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">خطة التطوير</h2>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  {developmentPlans.map((plan, index) => (
                    <div key={plan.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-2">{plan.development_goal}</h3>
                          <p className="text-sm text-gray-700 mb-2">{plan.action_plan}</p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-gray-600">
                              <span className="font-medium">المدة:</span> {plan.duration}
                            </span>
                            {plan.notes && (
                              <span className="text-gray-600">
                                <span className="font-medium">ملاحظات:</span> {plan.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardBody className="text-center py-12">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">لا يوجد تقييم متاح حاليًا</p>
            <p className="text-gray-400 text-sm mt-2">سيتم عرض التقييم هنا بمجرد إتمامه من قبل مديرك المباشر</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
