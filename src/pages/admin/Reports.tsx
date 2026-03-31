import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { BarChart3, Download } from 'lucide-react';

export const Reports: React.FC = () => {
  const [stats, setStats] = useState({
    totalEvaluations: 0,
    completionRate: 0,
    averageScore: 0,
    excellentCount: 0,
    goodCount: 0,
    needsImprovement: 0
  });
  const [evaluations, setEvaluations] = useState<any[]>([]);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    const { data: evals } = await supabase
      .from('evaluations')
      .select(`
        id,
        percentage,
        general_rating,
        status,
        employee:employees(full_name),
        department:departments(name),
        period:evaluation_periods(year, quarter)
      `)
      .in('status', ['تم الإرسال', 'اطلع الموظف', 'مغلق']);

    const evaluationsData = evals || [];
    setEvaluations(evaluationsData);

    const total = evaluationsData.length;
    const avgScore = total > 0
      ? evaluationsData.reduce((sum, e) => sum + (e.percentage || 0), 0) / total
      : 0;

    const ratingCounts = {
      excellent: evaluationsData.filter(e => e.percentage >= 90).length,
      good: evaluationsData.filter(e => e.percentage >= 70 && e.percentage < 90).length,
      needsImprovement: evaluationsData.filter(e => e.percentage < 70).length
    };

    setStats({
      totalEvaluations: total,
      completionRate: 85,
      averageScore: avgScore,
      excellentCount: ratingCounts.excellent,
      goodCount: ratingCounts.good,
      needsImprovement: ratingCounts.needsImprovement
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">التقارير والإحصائيات</h1>
          <p className="text-gray-600 mt-2">تقارير شاملة عن أداء الموظفين</p>
        </div>
        <Button className="flex items-center gap-2">
          <span>تصدير التقرير</span>
          <Download className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardBody>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">إجمالي التقييمات</p>
              <p className="text-4xl font-bold text-blue-600">{stats.totalEvaluations}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">معدل الإنجاز</p>
              <p className="text-4xl font-bold text-green-600">{stats.completionRate}%</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">متوسط الدرجات</p>
              <p className="text-4xl font-bold text-indigo-600">{stats.averageScore.toFixed(1)}%</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">الأداء الممتاز</p>
              <p className="text-4xl font-bold text-teal-600">{stats.excellentCount}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">توزيع التقييمات</h2>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">ممتاز (90%+)</span>
                <span className="text-sm text-gray-600">{stats.excellentCount} موظف</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full"
                  style={{ width: `${stats.totalEvaluations > 0 ? (stats.excellentCount / stats.totalEvaluations) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">جيد (70%-89%)</span>
                <span className="text-sm text-gray-600">{stats.goodCount} موظف</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full"
                  style={{ width: `${stats.totalEvaluations > 0 ? (stats.goodCount / stats.totalEvaluations) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">يحتاج تحسين (&lt;70%)</span>
                <span className="text-sm text-gray-600">{stats.needsImprovement} موظف</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-amber-500 h-3 rounded-full"
                  style={{ width: `${stats.totalEvaluations > 0 ? (stats.needsImprovement / stats.totalEvaluations) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">جميع التقييمات</h2>
        </CardHeader>
        <CardBody>
          <div className="space-y-3">
            {evaluations.slice(0, 10).map((evaluation) => (
              <div key={evaluation.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{evaluation.employee?.full_name}</p>
                  <p className="text-sm text-gray-600">{evaluation.department?.name}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{evaluation.percentage}%</p>
                    <p className="text-xs text-gray-500">النسبة</p>
                  </div>
                  <Badge variant={evaluation.percentage >= 90 ? 'success' : evaluation.percentage >= 70 ? 'info' : 'warning'}>
                    {evaluation.general_rating}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
