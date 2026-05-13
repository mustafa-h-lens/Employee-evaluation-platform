import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Building2, Users, Calendar, FileCheck, FileClock } from 'lucide-react';

interface Stats {
  directoratesCount: number;
  employeesCount: number;
  activePeriodsCount: number;
  completedEvaluations: number;
  pendingApprovals: number;
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats>({
    directoratesCount: 0,
    employeesCount: 0,
    activePeriodsCount: 0,
    completedEvaluations: 0,
    pendingApprovals: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // "بانتظار التعميد" mirrors the three pending sources surfaced on
      // /ceo-approvals: employee evaluations, CEO→director evaluations,
      // and supervisor evaluations — each with its own pending statuses.
      const [
        { count: directoratesCount },
        { count: employeesCount },
        { count: activePeriodsCount },
        { count: completedCount },
        { count: empPending },
        { count: dirPending },
        { count: supPending }
      ] = await Promise.all([
        supabase.from('directorates').select('*', { count: 'exact', head: true }),
        supabase.from('employees').select('*', { count: 'exact', head: true }),
        supabase.from('evaluation_periods').select('*', { count: 'exact', head: true }).eq('status', 'نشطة'),
        supabase.from('evaluations').select('*', { count: 'exact', head: true }).in('status', ['موافقة', 'اطلع الموظف', 'مغلق']),
        supabase.from('evaluations').select('*', { count: 'exact', head: true }).in('status', ['تم الإرسال', 'بانتظار الموافقة']),
        supabase.from('director_evaluations').select('*', { count: 'exact', head: true }).eq('evaluation_type', 'ceo_director').eq('status', 'بانتظار الموافقة'),
        supabase.from('supervisor_evaluations').select('*', { count: 'exact', head: true }).eq('status', 'تم الإرسال')
      ]);

      setStats({
        directoratesCount: directoratesCount || 0,
        employeesCount: employeesCount || 0,
        activePeriodsCount: activePeriodsCount || 0,
        completedEvaluations: completedCount || 0,
        pendingApprovals: (empPending || 0) + (dirPending || 0) + (supPending || 0)
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: 'عدد الإدارات',         value: stats.directoratesCount,    icon: <Building2 className="h-5 w-5" />,      scClass: 'sc-blue' },
    { title: 'عدد الموظفين',         value: stats.employeesCount,       icon: <Users className="h-5 w-5" />,          scClass: 'sc-green' },
    { title: 'التقييمات المكتملة',   value: stats.completedEvaluations, icon: <FileCheck className="h-5 w-5" />,      scClass: 'sc-blue' },
    { title: 'بانتظار التعميد',      value: stats.pendingApprovals,     icon: <FileClock className="h-5 w-5" />,      scClass: 'sc-amber' }
  ];

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
        <h1 className="text-2xl lg:text-3xl font-bold" style={{ color: 'var(--sc-blue-val)' }}>لوحة التحكم</h1>
        <p className="mt-2 text-sm lg:text-base" style={{ color: 'var(--sc-blue-label)' }}>نظرة عامة على منصة التقييم الوظيفي</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className={`stat-card ${stat.scClass}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="stat-sub">{stat.title}</div>
                <div className="stat-val">{stat.value}</div>
              </div>
              <div className="stat-icon-box">{stat.icon}</div>
            </div>
          </div>
        ))}

        <div className="stat-card sc-purple">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="stat-sub">الفترات النشطة</div>
              <div className="stat-val">{stats.activePeriodsCount}</div>
            </div>
            <div className="stat-icon-box"><Calendar className="h-5 w-5" /></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-ds-text">التقييمات الأخيرة</h2>
          </CardHeader>
          <CardBody>
            <RecentEvaluations />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-ds-text">إحصائيات الأداء</h2>
          </CardHeader>
          <CardBody>
            <PerformanceStats />
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

const RecentEvaluations: React.FC = () => {
  const [evaluations, setEvaluations] = useState<any[]>([]);

  useEffect(() => {
    fetchRecentEvaluations();
  }, []);

  const fetchRecentEvaluations = async () => {
    const { data } = await supabase
      .from('evaluations')
      .select(`
        id,
        status,
        percentage,
        created_at,
        employee:employees(full_name),
        department:departments(name)
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    setEvaluations(data || []);
  };

  if (evaluations.length === 0) {
    return <p className="text-ds-faint text-center py-4">لا توجد تقييمات حديثة</p>;
  }

  return (
    <div className="space-y-3">
      {evaluations.map((evaluation) => (
        <div key={evaluation.id} className="flex items-center justify-between p-3 bg-ds-bg rounded-lg">
          <div className="flex-1">
            <p className="font-medium text-ds-text">{evaluation.employee?.full_name}</p>
            <p className="text-sm text-ds-muted">{evaluation.department?.name}</p>
          </div>
          <Badge variant={evaluation.status === 'مسودة' ? 'default' : 'success'}>
            {evaluation.status}
          </Badge>
        </div>
      ))}
    </div>
  );
};

const PerformanceStats: React.FC = () => {
  const [stats, setStats] = useState<any[]>([]);

  useEffect(() => {
    fetchPerformanceStats();
  }, []);

  const fetchPerformanceStats = async () => {
    const { data } = await supabase
      .from('evaluations')
      .select('general_rating')
      .not('general_rating', 'is', null);

    const ratings = data || [];
    const ratingCounts: Record<string, number> = {
      'ممتاز': 0,
      'جيد جدًا': 0,
      'جيد': 0,
      'يحتاج تحسين': 0
    };

    ratings.forEach((r) => {
      if (r.general_rating && ratingCounts.hasOwnProperty(r.general_rating)) {
        ratingCounts[r.general_rating]++;
      }
    });

    const statsArray = Object.entries(ratingCounts).map(([rating, count]) => ({
      rating,
      count
    }));

    setStats(statsArray);
  };

  const total = stats.reduce((sum, s) => sum + s.count, 0);

  if (total === 0) {
    return <p className="text-ds-faint text-center py-4">لا توجد بيانات متاحة</p>;
  }

  return (
    <div className="space-y-3">
      {stats.map((stat) => (
        <div key={stat.rating}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-ds-text">{stat.rating}</span>
            <span className="text-sm text-ds-muted">{stat.count} تقييم</span>
          </div>
          <div className="w-full rounded-full h-2" style={{ background: 'var(--bg-overlay)' }}>
            <div
              className="h-2 rounded-full"
              style={{ width: `${(stat.count / total) * 100}%`, background: 'var(--accent)' }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
};
