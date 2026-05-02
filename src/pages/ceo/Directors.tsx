import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Users, FileCheck, FileClock, Crown, Eye, ClipboardEdit } from 'lucide-react';
import { UserAvatar } from '../../components/ui/UserAvatar';

interface Director {
  id: string;
  full_name: string;
  email: string;
  job_title: string;
  role: string;
  avatar_url?: string | null;
}

interface DirectorEvaluation {
  id: string;
  director_id: string;
  period_id: string;
  status: string;
}

interface CeoDirectorsProps {
  onNavigate: (path: string) => void;
}

const getEvalStatusLabel = (status: string | null): string => {
  if (!status || status === 'مسودة') return 'بانتظار التقييم';
  if (status === 'بانتظار الموافقة') return 'بانتظار اعتماد التقييم';
  if (status === 'موافقة' || status === 'اطلع الموظف' || status === 'مغلق' || status === 'مكتمل') return 'تم اعتماد التقييم';
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
    'مكتمل': 'success',
    'مرفوض': 'danger',
  };
  return map[status] || 'default';
};

export const CeoDirectors: React.FC<CeoDirectorsProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [directors, setDirectors] = useState<Director[]>([]);
  const [evalMap, setEvalMap] = useState<Map<string, DirectorEvaluation>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const { data: dirs, error: dirsError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'director')
        .order('full_name');

      if (dirsError || !dirs) {
        setLoading(false);
        return;
      }

      setDirectors(dirs);

      const { data: activePeriod } = await supabase
        .from('evaluation_periods')
        .select('*')
        .eq('status', 'نشطة')
        .maybeSingle();

      if (activePeriod) {
        const { data: evals } = await supabase
          .from('director_evaluations')
          .select('*')
          .eq('period_id', activePeriod.id);

        if (evals) {
          setEvalMap(new Map(evals.map(ev => [ev.director_id, ev])));
        }
      }
    } catch (error) {
      console.error('Error fetching directors:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalCount = directors.length;
  const evaluatedCount = directors.filter(d => {
    const ev = evalMap.get(d.id);
    return ev && ev.status !== 'مسودة';
  }).length;
  const pendingCount = totalCount - evaluatedCount;

  if (loading) {
    return <div className="page-loading-placeholder" aria-hidden="true" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-ds-xl p-8"
        style={{
          background: 'var(--sc-amber-grad)',
          border: '1px solid var(--sc-amber-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="flex items-center gap-3 mb-1">
          <Crown className="h-8 w-8" style={{ color: 'var(--sc-amber-icon-c)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-amber-val)' }}>مديري الإدارات</h1>
        </div>
        <p className="mt-2" style={{ color: 'var(--sc-amber-label)' }}>عرض وإدارة تقييمات مديري الإدارات</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ds-muted mb-1">إجمالي المديرين</p>
                <p className="text-2xl font-bold text-ds-text">{totalCount}</p>
              </div>
              <div className="bg-ds-info-bg text-ds-info p-3 rounded-xl">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ds-muted mb-1">تم تقييمهم</p>
                <p className="text-2xl font-bold text-green-600">{evaluatedCount}</p>
              </div>
              <div className="bg-ds-success-bg text-ds-success p-3 rounded-xl">
                <FileCheck className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ds-muted mb-1">بانتظار التقييم</p>
                <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              </div>
              <div className="bg-ds-warning-bg text-ds-warning p-3 rounded-xl">
                <FileClock className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Directors Table */}
      <Card>
        <CardBody>
          {directors.length === 0 ? (
            <EmptyState
              message="لا يوجد مديري إدارات حاليًا"
              icon={<Users className="h-12 w-12 text-ds-faint" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>المسمى الوظيفي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directors.map((director) => {
                  return (
                    <TableRow key={director.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar name={director.full_name} avatarUrl={director.avatar_url} size="md" />
                          <span className="font-medium text-ds-text">{director.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-ds-faint text-sm">{director.email}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-ds-muted text-sm">{director.job_title}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
