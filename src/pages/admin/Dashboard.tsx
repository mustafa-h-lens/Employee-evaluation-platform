import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Building2, Users, Calendar, FileCheck, FileClock } from 'lucide-react';

interface Stats {
  departmentsCount: number;
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
    departmentsCount: 0,
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
        { count: departmentsCount },
        { count: employeesCount },
        { data: activePeriodData },
        { count: completedCount },
        { count: pendingCount }
      ] = await Promise.all([
        supabase.from('departments').select('*', { count: 'exact', head: true }),
        supabase.from('employees').select('*', { count: 'exact', head: true }),
        supabase.from('evaluation_periods').select('*').eq('status', 'نشطة').maybeSingle(),
        supabase.from('evaluations').select('*', { count: 'exact', head: true }).in('status', ['بانتظار الموافقة', 'موافقة', 'تم الإرسال', 'اطلع الموظف', 'مغلق']),
        supabase.from('evaluations').select('*', { count: 'exact', head: true }).eq('status', 'مسودة')
      ]);

      setStats({
        departmentsCount: departmentsCount || 0,
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
    {
      title: 'عدد الإدارات',
      value: stats.departmentsCount,
      icon: <Building2 className="h-8 w-8" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'عدد الموظفين',
      value: stats.employeesCount,
      icon: <Users className="h-8 w-8" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'التقييمات المكتملة',
      value: stats.completedEvaluations,
      icon: <FileCheck className="h-8 w-8" />,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50'
    },
    {
      title: 'التقييمات المعلقة',
      value: stats.pendingEvaluations,
      icon: <FileClock className="h-8 w-8" />,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">لوحة التحكم</h1>
        <p className="text-gray-600 mt-2">نظرة عامة على منصة التقييم الوظيفي</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`${stat.bgColor} ${stat.color} p-3 rounded-xl`}>
                  {stat.icon}
                </div>
              </div>
            </CardBody>
          </Card>
        ))}

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">فترة التقييم الحالية</p>
                <p className="text-lg font-bold text-gray-900">{stats.activePeriod}</p>
              </div>
              <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl">
                <Calendar className="h-8 w-8" />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">التقييمات الأخيرة</h2>
          </CardHeader>
          <CardBody>
            <RecentEvaluations />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">إحصائيات الأداء</h2>
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
    return <p className="text-gray-500 text-center py-4">لا توجد تقييمات حديثة</p>;
  }

  return (
    <div className="space-y-3">
      {evaluations.map((evaluation) => (
        <div key={evaluation.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <p className="font-medium text-gray-900">{evaluation.employee?.full_name}</p>
            <p className="text-sm text-gray-600">{evaluation.department?.name}</p>
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
    return <p className="text-gray-500 text-center py-4">لا توجد بيانات متاحة</p>;
  }

  return (
    <div className="space-y-3">
      {stats.map((stat) => (
        <div key={stat.rating}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-900">{stat.rating}</span>
            <span className="text-sm text-gray-600">{stat.count} تقييم</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${(stat.count / total) * 100}%` }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
};
