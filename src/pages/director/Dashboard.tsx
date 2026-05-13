import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Users, FileCheck, FileClock, TrendingUp, Calendar } from 'lucide-react';

const monthLabels: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
};

const ratingVariant = (rating: string): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
    'ممتاز': 'success',
    'جيد جدًا': 'info',
    'جيد': 'warning',
    'يحتاج تحسين': 'danger',
  };
  return map[rating] || 'default';
};

export const DirectorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    evaluated: 0,
    pending: 0,
  });
  const [latestEvaluation, setLatestEvaluation] = useState<{
    percentage: number;
    general_rating: string;
    period: { year: number; month: number } | null;
  } | null>(null);
  const [activePeriod, setActivePeriod] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Find directorate (check both primary and secondary director)
      const { data: directoratesData } = await supabase
        .from('directorates')
        .select('id')
        .or(`director_id.eq.${user.id},secondary_director_id.eq.${user.id}`);
      const directorate = directoratesData?.[0] || null;

      let totalEmployees = 0;
      let evaluated = 0;

      if (directorate) {
        // Count employees assigned to this directorate (junction table + legacy)
        const { data: assignmentData } = await supabase
          .from('employee_directorates')
          .select('employee_id')
          .eq('directorate_id', directorate.id);

        const { data: legacyEmps } = await supabase
          .from('employees')
          .select('id')
          .eq('directorate_id', directorate.id);

        const allEmpIds = [...new Set([
          ...(assignmentData || []).map((a: any) => a.employee_id),
          ...(legacyEmps || []).map((e: any) => e.id),
        ])];

        totalEmployees = allEmpIds.length;

        // Get active period
        const { data: period } = await supabase
          .from('evaluation_periods')
          .select('*')
          .eq('status', 'نشطة')
          .maybeSingle();

        setActivePeriod(period);

        if (period && totalEmployees > 0) {
          // Count evaluations for this period
          const { data: evals } = await supabase
            .from('evaluations')
            .select('id, status')
            .eq('manager_id', user.id)
            .eq('period_id', period.id)
            .in('status', ['بانتظار الموافقة', 'موافقة', 'تم الإرسال']);

          evaluated = evals?.length || 0;
        }
      }

      setStats({
        totalEmployees,
        evaluated,
        pending: totalEmployees - evaluated,
      });

      // Fetch latest approved evaluation received (CEO → director)
      const { data: latest } = await supabase
        .from('director_evaluations')
        .select('percentage, general_rating, period:evaluation_periods(year, month)')
        .eq('director_id', user.id)
        .eq('evaluation_type', 'ceo_director')
        .in('status', ['بانتظار الموافقة', 'موافقة', 'اطلع المدير', 'مغلق', 'مكتمل'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest) {
        setLatestEvaluation({
          percentage: latest.percentage,
          general_rating: latest.general_rating,
          period: latest.period as any,
        });
      }
    } catch (error) {
      console.error('Error fetching director dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading-placeholder" aria-hidden="true" />
    );
  }

  return (
    <div className="space-y-6">
      <div
        className="rounded-ds-xl p-5 lg:p-8"
        style={{
          background: 'var(--sc-blue-grad)',
          border: '1px solid var(--sc-blue-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-blue-val)' }}>
          مرحباً، {user?.full_name}
        </h1>
        <p className="mt-2" style={{ color: 'var(--sc-blue-label)' }}>لوحة تحكم مدير الإدارة</p>
      </div>

      {activePeriod && (
        <div
          className="p-5 rounded-ds-lg flex items-center justify-between"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-soft)',
            boxShadow: 'var(--shadow-card)',
            borderRight: '4px solid var(--accent)',
          }}
        >
          <div>
            <p className="text-xs font-bold uppercase mb-1" style={{ color: 'var(--text-muted)', letterSpacing: '0.5px' }}>فترة التقييم الحالية</p>
            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {monthLabels[activePeriod.month]} - {activePeriod.year}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase mb-1" style={{ color: 'var(--text-muted)', letterSpacing: '0.5px' }}>ينتهي في</p>
            <p className="font-bold" style={{ color: 'var(--accent)' }}>{new Date(activePeriod.end_date).toLocaleDateString('ar-SA')}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="stat-card sc-blue">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="stat-sub">الموظفون</div>
              <div className="stat-val">{stats.totalEmployees}</div>
            </div>
            <div className="stat-icon-box"><Users className="h-5 w-5" /></div>
          </div>
        </div>

        <div className="stat-card sc-green">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="stat-sub">تم تقييمهم</div>
              <div className="stat-val">{stats.evaluated}</div>
            </div>
            <div className="stat-icon-box"><FileCheck className="h-5 w-5" /></div>
          </div>
        </div>

        <div className="stat-card sc-amber">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="stat-sub">المتبقي</div>
              <div className="stat-val">{stats.pending}</div>
            </div>
            <div className="stat-icon-box"><FileClock className="h-5 w-5" /></div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-ds-text">نسبة الإنجاز</h2>
        </CardHeader>
        <CardBody>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ds-muted">التقدم الكلي</span>
              <span className="text-sm font-medium">
                {stats.totalEmployees > 0 ? Math.round((stats.evaluated / stats.totalEmployees) * 100) : 0}%
              </span>
            </div>
            <div className="w-full rounded-full h-4" style={{ background: 'var(--bg-overlay)' }}>
              <div
                className="h-4 rounded-full transition-all"
                style={{
                  width: `${stats.totalEmployees > 0 ? (stats.evaluated / stats.totalEmployees) * 100 : 0}%`,
                  background: 'var(--accent)',
                }}
              ></div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Latest CEO evaluation received */}
      {latestEvaluation && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-ds-text">آخر تقييم تلقيته</h2>
          </CardHeader>
          <CardBody>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="p-3 rounded-xl"
                  style={{ background: 'var(--success-bg)', color: 'var(--success-text)' }}
                >
                  <TrendingUp className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>
                    {latestEvaluation.percentage.toFixed(1)}%
                  </p>
                  <Badge variant={ratingVariant(latestEvaluation.general_rating)}>
                    {latestEvaluation.general_rating}
                  </Badge>
                </div>
              </div>
              {latestEvaluation.period && (
                <div className="flex items-center gap-2 text-ds-faint">
                  <Calendar className="h-5 w-5" />
                  <span>{monthLabels[latestEvaluation.period.month]} - {latestEvaluation.period.year}</span>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
