import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Building2, Users, Calendar, FileCheck, FileClock } from 'lucide-react';

interface Stats {
  directoratesCount: number;
  employeesCount: number;
  activePeriod: string;
  completedEvaluations: number;
  pendingEvaluations: number;
}

const monthLabels: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
};

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats>({
    directoratesCount: 0,
    employeesCount: 0,
    activePeriod: '',
    completedEvaluations: 0,
    pendingEvaluations: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [
        { count: directoratesCount },
        { count: employeesCount },
        { data: activePeriodData },
        { count: completedCount },
        { count: pendingCount }
      ] = await Promise.all([
        supabase.from('directorates').select('*', { count: 'exact', head: true }),
        supabase.from('employees').select('*', { count: 'exact', head: true }),
        supabase.from('evaluation_periods').select('*').eq('status', 'نشطة').maybeSingle(),
        supabase.from('evaluations').select('*', { count: 'exact', head: true }).in('status', ['بانتظار الموافقة', 'موافقة', 'تم الإرسال', 'اطلع الموظف', 'مغلق']),
        supabase.from('evaluations').select('*', { count: 'exact', head: true }).eq('status', 'مسودة')
      ]);

      setStats({
        directoratesCount: directoratesCount || 0,
        employeesCount: employeesCount || 0,
        activePeriod: activePeriodData ? `${monthLabels[activePeriodData.month]} - ${activePeriodData.year}` : 'لا توجد فترة نشطة',
        completedEvaluations: completedCount || 0,
        pendingEvaluations: pendingCount || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: 'عدد الإدارات',         value: stats.directoratesCount,   icon: <Building2 className="h-5 w-5" />, scClass: 'sc-blue' },
    { title: 'عدد الموظفين',         value: stats.employeesCount,      icon: <Users className="h-5 w-5" />,     scClass: 'sc-green' },
    { title: 'التقييمات المكتملة',   value: stats.completedEvaluations, icon: <FileCheck className="h-5 w-5" />, scClass: 'sc-blue' },
    { title: 'التقييمات المعلقة',    value: stats.pendingEvaluations,  icon: <FileClock className="h-5 w-5" />, scClass: 'sc-amber' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-ds-faint">جاري التحميل...</div>
      </div>
    );
  }

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
        <p className="mt-2" style={{ color: 'var(--sc-blue-label)' }}>نظرة عامة على منصة التقييم الوظيفي</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <div className="stat-sub">فترة التقييم الحالية</div>
              <div className="stat-val" style={{ fontSize: '18px', letterSpacing: 0 }}>{stats.activePeriod}</div>
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
