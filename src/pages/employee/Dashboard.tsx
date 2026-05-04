import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { FileText, TrendingUp, Target, Briefcase, Building2, UserCheck, Hash } from 'lucide-react';
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

    if (!data) { setEmployeeData(null); return; }

    // The legacy employees.department_id / directorate_id columns are often
    // stale; the source of truth is employee_directorates. Hydrate the
    // directorate/department on the employee record from there if missing.
    const { data: assignments } = await supabase
      .from('employee_directorates')
      .select(`
        is_primary,
        directorate:directorates(name),
        department:departments(name)
      `)
      .eq('employee_id', data.id)
      .order('is_primary', { ascending: false });

    const primary = (assignments || [])[0] as any;
    if (primary) {
      if (!data.directorate?.name && primary.directorate?.name) {
        data.directorate = { ...(data.directorate || {}), name: primary.directorate.name };
      }
      if (!data.department?.name && primary.department?.name) {
        data.department = { ...(data.department || {}), name: primary.department.name };
      }
      data.assignment_directorate_name = primary.directorate?.name || null;
      data.assignment_department_name = primary.department?.name || null;
    }

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

    // Co-director gate — mirror the MyEvaluations rule: a solo pending
    // submission from a directorate that has a secondary director must
    // wait for the partner before surfacing anywhere. Without this, the
    // dashboard would happily show a "latest evaluation" tile that
    // MyEvaluations is correctly hiding.
    const { data: coDirs } = await supabase
      .from('directorates')
      .select('id')
      .not('secondary_director_id', 'is', null);
    const coDirIds = new Set((coDirs || []).map((d: any) => d.id));

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

    // Apply the gate: a single pending row from a co-director directorate
    // is held until the partner submits, exactly as MyEvaluations does.
    if (rows.length === 1) {
      const r: any = rows[0];
      const isPending = r.status === 'تم الإرسال' || r.status === 'بانتظار الموافقة';
      if (isPending && r.directorate_id && coDirIds.has(r.directorate_id)) {
        return;
      }
    }

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
      <div
        className="rounded-ds-xl p-8"
        style={{
          background: 'var(--sc-blue-grad)',
          border: '1px solid var(--sc-blue-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-blue-val)' }}>لوحة التحكم</h1>
        <p className="mt-2" style={{ color: 'var(--sc-blue-label)' }}>مرحبًا {user?.full_name}</p>
      </div>

      {employeeData && (() => {
        const dirName = employeeData.assignment_directorate_name || employeeData.directorate?.name || '';
        const deptName = employeeData.assignment_department_name || employeeData.department?.name || '';
        const directorateLabel = dirName && deptName ? `${dirName} — ${deptName}` : (dirName || deptName || '—');

        const fields: { label: string; value: string; icon: React.ReactNode; sc: 'blue' | 'green' | 'amber' | 'purple' }[] = [
          { label: 'المسمى الوظيفي', value: employeeData.job_title || '—', icon: <Briefcase className="h-5 w-5" />, sc: 'blue' },
          { label: 'الإدارة',         value: directorateLabel,              icon: <Building2 className="h-5 w-5" />, sc: 'green' },
          { label: 'المدير المباشر',  value: resolveManagerLabel() || '—',  icon: <UserCheck className="h-5 w-5" />, sc: 'purple' },
          { label: 'رقم الموظف',      value: String(employeeData.employee_number ?? '—'), icon: <Hash className="h-5 w-5" />, sc: 'amber' },
        ];

        return (
          <div
            className="p-6 rounded-ds-lg"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-soft)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {fields.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-3 p-3 rounded-ds-md transition-all"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-card)';
                    (e.currentTarget as HTMLDivElement).style.borderColor = `var(--sc-${f.sc}-border)`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-subtle)';
                  }}
                >
                  <div
                    className="flex-shrink-0 flex items-center justify-center"
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: 'var(--radius-md)',
                      background: `var(--sc-${f.sc}-icon-bg)`,
                      border: `1px solid var(--sc-${f.sc}-icon-b)`,
                      color: `var(--sc-${f.sc}-icon-c)`,
                    }}
                  >
                    {f.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[10px] font-bold uppercase mb-0.5"
                      style={{ color: 'var(--text-muted)', letterSpacing: '0.5px' }}
                    >
                      {f.label}
                    </p>
                    <p
                      className="text-sm font-bold truncate"
                      style={{ color: 'var(--text-primary)' }}
                      title={f.value}
                    >
                      {f.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {latestEvaluation ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-ds-text">آخر تقييم</h2>
                  <p className="text-sm text-ds-faint mt-1">
                    من: <span className="font-medium text-ds-muted">{latestEvaluation.is_combined ? 'الإدارة العليا' : (latestEvaluation.manager?.full_name || '')}</span>
                  </p>
                </div>
                <Badge variant="info">
                  {monthLabels[latestEvaluation.period?.month || 1]} {latestEvaluation.period?.year}
                </Badge>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="stat-card sc-blue text-center">
                  <div className="stat-sub">الدرجة من 500</div>
                  <div className="stat-val">{latestEvaluation.final_score_500?.toFixed(0)}</div>
                </div>
                <div className="stat-card sc-green text-center">
                  <div className="stat-sub">التقييم من 5</div>
                  <div className="stat-val">{latestEvaluation.final_score_5?.toFixed(2)}</div>
                </div>
                <div className="stat-card sc-blue text-center">
                  <div className="stat-sub">النسبة المئوية</div>
                  <div className="stat-val">{latestEvaluation.percentage?.toFixed(1)}%</div>
                </div>
                <div className="stat-card sc-purple text-center flex flex-col items-center justify-center">
                  <div className="stat-sub mb-2">التقدير العام</div>
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
                  <h2 className="text-lg font-semibold text-ds-text">ملاحظات المدير المباشر</h2>
                </CardHeader>
                <CardBody>
                  <div className="space-y-4">
                    {(latestEvaluation.managers || [])
                      .filter((m: any) => m.note)
                      .map((m: any) => (
                        <div key={m.id} className="border-r-4 border-blue-400 pr-4">
                          <p className="text-sm font-semibold text-ds-info-text mb-1">{m.name}</p>
                          <p className="text-ds-muted leading-relaxed">{m.note}</p>
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
                  <h2 className="text-lg font-semibold text-ds-text">ملاحظات المدير المباشر</h2>
                </CardHeader>
                <CardBody>
                  <p className="text-ds-muted leading-relaxed">{latestEvaluation.manager_note}</p>
                </CardBody>
              </Card>
            )
          )}

          {developmentPlans.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-ds-text">خطة التطوير</h2>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  {developmentPlans.map((plan, index) => (
                    <div key={plan.id} className="p-4 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-start gap-3">
                        <div
                          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold"
                          style={{ background: 'var(--accent)', color: '#ffffff' }}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-ds-text mb-2">{plan.development_goal}</h3>
                          <p className="text-sm text-ds-muted mb-2">{plan.action_plan}</p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-ds-muted">
                              <span className="font-medium">المدة:</span> {plan.duration}
                            </span>
                            {plan.notes && (
                              <span className="text-ds-muted">
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
            <FileText className="h-16 w-16 text-ds-faint mx-auto mb-4" />
            <p className="text-ds-faint text-lg">لا يوجد تقييم متاح حاليًا</p>
            <p className="text-ds-faint text-sm mt-2">سيتم عرض التقييم هنا بمجرد إتمامه من قبل مديرك المباشر</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
