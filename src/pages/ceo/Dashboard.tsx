import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Building2, UserCog, Calendar, FileCheck, FileClock, Crown, ClipboardCheck } from 'lucide-react';

interface Stats {
  directorsCount: number;
  directoratesCount: number;
  completedEvaluations: number;
  pendingEvaluations: number;
  pendingApprovals: number;
  activePeriodsCount: number;
}

interface CeoDashboardProps {
  onNavigate?: (path: string) => void;
}

export const CeoDashboard: React.FC<CeoDashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<Stats>({
    directorsCount: 0,
    directoratesCount: 0,
    completedEvaluations: 0,
    pendingEvaluations: 0,
    pendingApprovals: 0,
    activePeriodsCount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // The "بانتظار التعميد" count must mirror what /ceo-approvals shows
      // across its three tabs, each table using its own pending statuses:
      //   * evaluations           — ['تم الإرسال', 'بانتظار الموافقة']
      //   * director_evaluations  — ['بانتظار الموافقة']  (type='ceo_director')
      //   * supervisor_evaluations— ['تم الإرسال']
      const [
        { count: directorsCount },
        { count: directoratesCount },
        { count: activePeriodsCount },
        { count: completedCount },
        { count: pendingCount },
        { count: empPendingApprovals },
        { count: dirPendingApprovals },
        { count: supPendingApprovals }
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'director'),
        supabase.from('directorates').select('*', { count: 'exact', head: true }),
        supabase.from('evaluation_periods').select('*', { count: 'exact', head: true }).eq('status', 'نشطة'),
        supabase.from('director_evaluations').select('*', { count: 'exact', head: true }).in('status', ['موافقة', 'اطلع المدير', 'مغلق']),
        supabase.from('director_evaluations').select('*', { count: 'exact', head: true }).in('status', ['مسودة', 'مرفوض']),
        supabase.from('evaluations').select('*', { count: 'exact', head: true }).in('status', ['تم الإرسال', 'بانتظار الموافقة']),
        supabase.from('director_evaluations').select('*', { count: 'exact', head: true }).eq('evaluation_type', 'ceo_director').eq('status', 'بانتظار الموافقة'),
        supabase.from('supervisor_evaluations').select('*', { count: 'exact', head: true }).eq('status', 'تم الإرسال')
      ]);

      const pendingApprovalCount = (empPendingApprovals || 0) + (dirPendingApprovals || 0) + (supPendingApprovals || 0);

      setStats({
        directorsCount: directorsCount || 0,
        directoratesCount: directoratesCount || 0,
        activePeriodsCount: activePeriodsCount || 0,
        completedEvaluations: completedCount || 0,
        pendingEvaluations: pendingCount || 0,
        pendingApprovals: pendingApprovalCount
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: 'عدد مديري الإدارات', value: stats.directorsCount,       icon: <UserCog className="h-5 w-5" />,        scClass: 'sc-purple', path: '/ceo-directors' },
    { title: 'عدد الإدارات',        value: stats.directoratesCount,    icon: <Building2 className="h-5 w-5" />,      scClass: 'sc-blue',   path: '/ceo-org-structure' },
    { title: 'التقييمات المكتملة',  value: stats.completedEvaluations, icon: <FileCheck className="h-5 w-5" />,      scClass: 'sc-green',  path: '/ceo-all-evaluations' },
    { title: 'التقييمات المعلقة',   value: stats.pendingEvaluations,   icon: <FileClock className="h-5 w-5" />,      scClass: 'sc-amber',  path: '/ceo-evaluations' },
    { title: 'بانتظار التعميد',     value: stats.pendingApprovals,     icon: <ClipboardCheck className="h-5 w-5" />, scClass: 'sc-amber',  path: '/ceo-approvals' }
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
        className="rounded-ds-xl p-8 flex items-center gap-4"
        style={{
          background: 'var(--sc-amber-grad)',
          border: '1px solid var(--sc-amber-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div
          className="p-3 rounded-xl flex items-center justify-center"
          style={{
            background: 'var(--sc-amber-icon-bg)',
            border: '1px solid var(--sc-amber-icon-b)',
            color: 'var(--sc-amber-icon-c)',
          }}
        >
          <Crown className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-amber-val)' }}>لوحة تحكم الإدارة العليا</h1>
          <p className="mt-1" style={{ color: 'var(--sc-amber-label)' }}>نظرة عامة على تقييمات مديري الإدارات</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => {
          const clickable = !!onNavigate && !!stat.path;
          return (
            <div
              key={index}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? () => onNavigate!(stat.path) : undefined}
              onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate!(stat.path); } } : undefined}
              className={`stat-card ${stat.scClass} ${clickable ? 'cursor-pointer hover:-translate-y-0.5 transition-transform' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="stat-sub">{stat.title}</div>
                  <div className="stat-val">{stat.value}</div>
                </div>
                <div className="stat-icon-box">{stat.icon}</div>
              </div>
            </div>
          );
        })}

        <div
          role={onNavigate ? 'button' : undefined}
          tabIndex={onNavigate ? 0 : undefined}
          onClick={onNavigate ? () => onNavigate('/ceo-reports') : undefined}
          onKeyDown={onNavigate ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('/ceo-reports'); } } : undefined}
          className={`stat-card sc-purple ${onNavigate ? 'cursor-pointer hover:-translate-y-0.5 transition-transform' : ''}`}
        >
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
            <h2 className="text-lg font-semibold text-ds-text">تقييمات المديرين الأخيرة</h2>
          </CardHeader>
          <CardBody>
            <RecentDirectorEvaluations />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-ds-text">إحصائيات أداء المديرين</h2>
          </CardHeader>
          <CardBody>
            <DirectorPerformanceStats />
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

const RecentDirectorEvaluations: React.FC = () => {
  const [evaluations, setEvaluations] = useState<any[]>([]);

  useEffect(() => {
    fetchRecentEvaluations();
  }, []);

  const fetchRecentEvaluations = async () => {
    const { data } = await supabase
      .from('director_evaluations')
      .select(`
        id,
        status,
        percentage,
        general_rating,
        created_at,
        director:users!director_evaluations_director_id_fkey(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    setEvaluations(data || []);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'تم الإرسال':
      case 'اطلع المدير':
        return 'info';
      case 'بانتظار الموافقة':
        return 'warning';
      case 'موافقة':
        return 'success';
      case 'مرفوض':
        return 'danger';
      case 'مغلق':
        return 'default';
      default:
        return 'default';
    }
  };

  if (evaluations.length === 0) {
    return <p className="text-ds-faint text-center py-4">لا توجد تقييمات حديثة</p>;
  }

  return (
    <div className="space-y-3">
      {evaluations.map((evaluation) => (
        <div key={evaluation.id} className="flex items-center justify-between p-3 bg-ds-bg rounded-lg">
          <div className="flex-1">
            <p className="font-medium text-ds-text">{evaluation.director?.full_name}</p>
            {evaluation.percentage > 0 && (
              <p className="text-sm text-ds-muted">{evaluation.percentage}% - {evaluation.general_rating}</p>
            )}
          </div>
          <Badge variant={getStatusVariant(evaluation.status)}>
            {evaluation.status}
          </Badge>
        </div>
      ))}
    </div>
  );
};

const DirectorPerformanceStats: React.FC = () => {
  const [stats, setStats] = useState<any[]>([]);

  useEffect(() => {
    fetchPerformanceStats();
  }, []);

  const fetchPerformanceStats = async () => {
    const { data } = await supabase
      .from('director_evaluations')
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
              style={{ width: `${(stat.count / total) * 100}%`, background: 'var(--warning)' }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
};
