import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from '../../components/ui/Table';
import { Activity, Plus, Trash2, RefreshCw, CreditCard as Edit3, ToggleRight, ToggleLeft, ChevronLeft, ChevronRight, Filter, Clock, User } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
  user_full_name?: string;
  user_role?: string;
}

const PAGE_SIZE = 20;

const entityTypeLabels: Record<string, string> = {
  evaluation_criteria: 'معايير التقييم',
  evaluation_periods: 'فترات التقييم',
  departments: 'الإدارات',
  employees: 'الموظفين',
  evaluations: 'التقييمات',
  users: 'المستخدمين',
};

const getActionIcon = (action: string) => {
  if (action.includes('إضافة') || action.includes('إنشاء') || action.includes('تسجيل')) return <Plus className="h-4 w-4" />;
  if (action.includes('حذف')) return <Trash2 className="h-4 w-4" />;
  if (action.includes('تحديث') || action.includes('تعديل')) return <Edit3 className="h-4 w-4" />;
  if (action.includes('تفعيل')) return <ToggleRight className="h-4 w-4" />;
  if (action.includes('تعطيل')) return <ToggleLeft className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
};

const getActionColor = (action: string) => {
  if (action.includes('إضافة') || action.includes('إنشاء') || action.includes('تسجيل') || action.includes('تفعيل')) return 'bg-green-100 text-green-600';
  if (action.includes('حذف')) return 'bg-red-100 text-red-600';
  if (action.includes('تحديث') || action.includes('تعديل')) return 'bg-blue-100 text-blue-600';
  if (action.includes('تعطيل')) return 'bg-gray-100 text-gray-500';
  return 'bg-gray-100 text-gray-600';
};

const getActionBadgeVariant = (action: string): 'success' | 'danger' | 'info' | 'default' => {
  if (action.includes('إضافة') || action.includes('إنشاء') || action.includes('تسجيل') || action.includes('تفعيل')) return 'success';
  if (action.includes('حذف')) return 'danger';
  if (action.includes('تحديث') || action.includes('تعديل')) return 'info';
  return 'default';
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDetails = (details: Record<string, unknown> | null): string => {
  if (!details) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(details)) {
    if (key === 'title' || key === 'name' || key === 'full_name') {
      parts.unshift(String(value));
    } else if (key === 'is_active') {
      parts.push(value ? 'تفعيل' : 'تعطيل');
    } else if (key === 'status') {
      parts.push(`الحالة: ${value}`);
    } else if (key === 'weight') {
      parts.push(`الوزن: ${value}%`);
    } else if (key === 'month') {
      parts.push(String(value));
    } else if (key === 'year') {
      parts.push(String(value));
    }
  }
  return parts.join(' - ');
};

export const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [entityFilter, setEntityFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      let countQuery = supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true });

      let dataQuery = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (entityFilter !== 'all') {
        countQuery = countQuery.eq('entity_type', entityFilter);
        dataQuery = dataQuery.eq('entity_type', entityFilter);
      }

      const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

      if (countResult.count !== null) {
        setTotalCount(countResult.count);
      }

      if (!dataResult.error && dataResult.data) {
        const userIds = [...new Set(dataResult.data.map(l => l.user_id))];
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name, role')
          .in('id', userIds);

        const userMap = new Map(users?.map(u => [u.id, u]) || []);

        const enriched: AuditLogEntry[] = dataResult.data.map(log => ({
          ...log,
          user_full_name: userMap.get(log.user_id)?.full_name || 'غير معروف',
          user_role: userMap.get(log.user_id)?.role || '',
        }));

        setLogs(enriched);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, entityFilter]);

  useEffect(() => {
    setLoading(true);
    fetchLogs();
  }, [fetchLogs]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  const handleFilterChange = (value: string) => {
    setEntityFilter(value);
    setPage(0);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (loading && !refreshing) {
    return <div className="flex items-center justify-center h-64">جاري التحميل...</div>;
  }

  const entityTypes = [
    { value: 'all', label: 'جميع الأنواع' },
    { value: 'evaluation_criteria', label: 'معايير التقييم' },
    { value: 'evaluation_periods', label: 'فترات التقييم' },
    { value: 'departments', label: 'الإدارات' },
    { value: 'employees', label: 'الموظفين' },
    { value: 'evaluations', label: 'التقييمات' },
    { value: 'users', label: 'المستخدمين' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">سجل النشاط</h1>
          <p className="text-gray-600 mt-2">عرض جميع العمليات التي تمت في النظام</p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          className="flex items-center gap-2"
          loading={refreshing}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>تحديث</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">إجمالي السجلات</p>
                <p className="text-xl font-bold text-gray-900">{totalCount}</p>
              </div>
              <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
                <Activity className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">آخر نشاط</p>
                <p className="text-xl font-bold text-gray-900">
                  {logs.length > 0 ? formatDate(logs[0].created_at) : '-'}
                </p>
              </div>
              <div className="bg-green-50 text-green-600 p-3 rounded-xl">
                <Clock className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">مستخدمين نشطين</p>
                <p className="text-xl font-bold text-gray-900">
                  {new Set(logs.map(l => l.user_id)).size}
                </p>
              </div>
              <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
                <User className="h-6 w-6" />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <div className="flex items-center gap-3 mb-4">
            <Filter className="h-5 w-5 text-gray-400" />
            <div className="w-64">
              <Select
                options={entityTypes}
                value={entityFilter}
                onChange={(e) => handleFilterChange(e.target.value)}
              />
            </div>
          </div>

          {logs.length === 0 ? (
            <EmptyState
              message="لا توجد سجلات نشاط"
              icon={<Activity className="h-12 w-12 text-gray-400" />}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المستخدم</TableHead>
                    <TableHead>العملية</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>التفاصيل</TableHead>
                    <TableHead>التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getActionColor(log.action)}`}>
                            {getActionIcon(log.action)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{log.user_full_name}</p>
                            <p className="text-xs text-gray-500">
                              {log.user_role === 'admin' ? 'مدير النظام' : 'موظف'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.action)} size="sm">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 text-sm">
                          {entityTypeLabels[log.entity_type] || log.entity_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="text-gray-500 text-sm max-w-xs truncate">
                          {formatDetails(log.details) || '-'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="text-right">
                          <p className="text-sm text-gray-900">{formatDate(log.created_at)}</p>
                          <p className="text-xs text-gray-500">{formatTime(log.created_at)}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    عرض {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, totalCount)} من {totalCount}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= totalPages - 1}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <span className="text-sm text-gray-600 font-medium">
                      {page + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => p - 1)}
                      disabled={page === 0}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
