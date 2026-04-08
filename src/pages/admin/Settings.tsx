import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { Save, Scale, RefreshCw, Calendar, CheckCircle, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ChevronRight, User } from 'lucide-react';
import { computeFinalScores } from '../../lib/scoring';

const monthLabels: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
};

interface Period {
  id: string;
  year: number;
  month: number;
  status: string;
  general_weight: number;
  specific_weight: number;
}

export const AdminSettings: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [generalWeight, setGeneralWeight] = useState(50);
  const [specificWeight, setSpecificWeight] = useState(50);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recalcCount, setRecalcCount] = useState<number | null>(null);

  // Section visibility
  const [showWeights, setShowWeights] = useState(false);

  // Password change state
  const [showPwForm, setShowPwForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  // Name change state
  const [showNameForm, setShowNameForm] = useState(false);
  const [newName, setNewName] = useState(user?.full_name || '');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const handleChangeName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);
    setNameSuccess(null);

    if (!newName.trim()) {
      setNameError('يرجى إدخال الاسم');
      return;
    }
    if (!user) return;

    setNameLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: newName.trim() })
        .eq('id', user.id);

      if (error) { setNameError('حدث خطأ أثناء تحديث الاسم'); return; }

      await refreshUser();
      setNameSuccess('تم تحديث الاسم بنجاح');
      setTimeout(() => { setNameSuccess(null); setShowNameForm(false); }, 3000);
    } catch {
      setNameError('حدث خطأ غير متوقع');
    } finally {
      setNameLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPassword.length < 6) {
      setPwError('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('كلمة المرور الجديدة وتأكيدها غير متطابقتين');
      return;
    }

    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { setPwError('حدث خطأ أثناء تغيير كلمة المرور'); return; }

      setPwSuccess('تم تغيير كلمة المرور بنجاح');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => { setPwSuccess(null); setShowPwForm(false); }, 3000);
    } catch {
      setPwError('حدث خطأ غير متوقع');
    } finally {
      setPwLoading(false);
    }
  };

  const fetchPeriods = useCallback(async () => {
    const { data } = await supabase
      .from('evaluation_periods')
      .select('id, year, month, status, general_weight, specific_weight')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    const periodList = (data || []) as Period[];
    setPeriods(periodList);

    // Auto-select the active period, or the first one
    const active = periodList.find(p => p.status === 'نشطة');
    const target = active || periodList[0];
    if (target) {
      setSelectedPeriodId(target.id);
      setGeneralWeight(target.general_weight);
      setSpecificWeight(target.specific_weight);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
    setSaved(false);
    setRecalcCount(null);
    const period = periods.find(p => p.id === periodId);
    if (period) {
      setGeneralWeight(period.general_weight);
      setSpecificWeight(period.specific_weight);
    }
  };

  const handleGeneralWeightChange = (value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    setGeneralWeight(clamped);
    setSpecificWeight(100 - clamped);
    setSaved(false);
    setRecalcCount(null);
  };

  const handleSpecificWeightChange = (value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    setSpecificWeight(clamped);
    setGeneralWeight(100 - clamped);
    setSaved(false);
    setRecalcCount(null);
  };

  const recalculateEvaluations = async (periodId: string, genWeight: number, specWeight: number) => {
    // Fetch all evaluations for this period
    const { data: evals } = await supabase
      .from('evaluations')
      .select('id')
      .eq('period_id', periodId);

    if (!evals || evals.length === 0) return 0;

    let count = 0;

    for (const ev of evals) {
      // Fetch scores for this evaluation
      const { data: scoreRows } = await supabase
        .from('evaluation_scores')
        .select('score_1_to_5, weighted_result, criterion_type, criterion_id, department_criterion_id, criterion:evaluation_criteria(weight), dept_criterion:department_criteria(weight)')
        .eq('evaluation_id', ev.id);

      if (!scoreRows || scoreRows.length === 0) continue;

      // Calculate raw totals (each is score * criterion.weight, max = sum_of_weights * 5)
      let generalRawTotal = 0;
      let specificRawTotal = 0;
      let generalMaxPossible = 0;
      let specificMaxPossible = 0;

      scoreRows.forEach((s: any) => {
        const weight = s.criterion_type === 'specific'
          ? (s.dept_criterion?.weight || 0)
          : (s.criterion?.weight || 0);
        const rawScore = s.score_1_to_5 * weight;

        if (s.criterion_type === 'specific') {
          specificRawTotal += rawScore;
          specificMaxPossible += weight * 5;
        } else {
          generalRawTotal += rawScore;
          generalMaxPossible += weight * 5;
        }
      });

      // Normalize each to 0-1, then apply weights
      const generalNormalized = generalMaxPossible > 0 ? generalRawTotal / generalMaxPossible : 0;
      const specificNormalized = specificMaxPossible > 0 ? specificRawTotal / specificMaxPossible : 0;

      // Raw percentage
      const percentage = (generalNormalized * genWeight + specificNormalized * specWeight) / 100 * 100;

      // Dynamic score mapping based on percentage ranges
      const { finalScore5, finalScore500, generalRating } = computeFinalScores(percentage);

      await supabase
        .from('evaluations')
        .update({
          final_score_500: finalScore500,
          final_score_5: finalScore5,
          percentage,
          general_rating: generalRating,
        })
        .eq('id', ev.id);

      count++;
    }

    return count;
  };

  const handleSave = async () => {
    if (!user || !selectedPeriodId) return;
    setSaving(true);
    setSaved(false);
    setRecalcCount(null);

    try {
      // Update the period's weights
      const { error } = await supabase
        .from('evaluation_periods')
        .update({
          general_weight: generalWeight,
          specific_weight: specificWeight,
        })
        .eq('id', selectedPeriodId);

      if (error) throw error;

      // Update local state
      setPeriods(prev => prev.map(p =>
        p.id === selectedPeriodId
          ? { ...p, general_weight: generalWeight, specific_weight: specificWeight }
          : p
      ));

      // Also update global settings table for backward compatibility
      const { data: settingsRow } = await supabase
        .from('evaluation_settings')
        .select('id')
        .limit(1)
        .single();

      if (settingsRow) {
        await supabase
          .from('evaluation_settings')
          .update({ general_weight: generalWeight, specific_weight: specificWeight })
          .eq('id', settingsRow.id);
      }

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'تحديث أوزان فترة التقييم',
        entity_type: 'evaluation_periods',
        entity_id: selectedPeriodId,
        details: { general_weight: generalWeight, specific_weight: specificWeight },
      });

      setSaved(true);

      // Recalculate all evaluations for this period
      setRecalculating(true);
      const count = await recalculateEvaluations(selectedPeriodId, generalWeight, specificWeight);
      setRecalcCount(count);
      setRecalculating(false);

    } catch (error: any) {
      console.error('Error saving settings:', error);
      alert('حدث خطأ أثناء حفظ الإعدادات:\n' + (error?.message || JSON.stringify(error)));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">جاري التحميل...</div>;
  }

  const total = generalWeight + specificWeight;
  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">الإعدادات</h1>
        <p className="text-gray-600 mt-2">إدارة إعدادات نظام التقييم</p>
      </div>

      {!showWeights ? (
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowWeights(true)}>
          <CardBody className="flex items-center justify-between py-5 px-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Scale className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">توزيع أوزان التقييم</h3>
                <p className="text-sm text-gray-500">تحديد نسبة المعايير العامة والمعايير الخاصة لكل فترة تقييم</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </CardBody>
        </Card>
      ) : (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">توزيع أوزان التقييم</h2>
              <p className="text-sm text-gray-600">تحديد نسبة المعايير العامة والمعايير الخاصة لكل فترة تقييم</p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-6">

          {/* Period selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              فترة التقييم
            </label>
            <select
              value={selectedPeriodId}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {periods.map(p => (
                <option key={p.id} value={p.id}>
                  {monthLabels[p.month]} {p.year} — {p.status === 'نشطة' ? '(نشطة)' : p.status}
                </option>
              ))}
            </select>
            {selectedPeriod && (
              <p className="text-xs text-gray-500 mt-1">
                الأوزان الحالية لهذه الفترة: عامة {selectedPeriod.general_weight}% — خاصة {selectedPeriod.specific_weight}%
              </p>
            )}
          </div>

          {/* Weight distribution */}
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm font-medium text-gray-700">المعايير العامة</span>
                <span className="text-xs text-gray-500">(يحددها مسؤول الموارد البشرية)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">(يحددها المدير المباشر)</span>
                <span className="text-sm font-medium text-gray-700">المعايير الخاصة</span>
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
              </div>
            </div>

            <div className="relative mb-3">
              <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden flex">
                <div
                  className="bg-blue-500 h-6 transition-all duration-300 flex items-center justify-center"
                  style={{ width: `${generalWeight}%` }}
                >
                  {generalWeight >= 15 && <span className="text-white text-xs font-bold">{generalWeight}%</span>}
                </div>
                <div
                  className="bg-emerald-500 h-6 transition-all duration-300 flex items-center justify-center"
                  style={{ width: `${specificWeight}%` }}
                >
                  {specificWeight >= 15 && <span className="text-white text-xs font-bold">{specificWeight}%</span>}
                </div>
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={generalWeight}
              onChange={(e) => handleGeneralWeightChange(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-blue-600 font-medium">عامة:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={generalWeight}
                  onChange={(e) => handleGeneralWeightChange(parseInt(e.target.value) || 0)}
                  className="w-16 text-center text-lg font-bold text-blue-600 border border-blue-300 rounded-lg px-2 py-1"
                />
                <span className="text-blue-600 font-bold">%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-emerald-600 font-medium">خاصة:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={specificWeight}
                  onChange={(e) => handleSpecificWeightChange(parseInt(e.target.value) || 0)}
                  className="w-16 text-center text-lg font-bold text-emerald-600 border border-emerald-300 rounded-lg px-2 py-1"
                />
                <span className="text-emerald-600 font-bold">%</span>
              </div>
            </div>
          </div>

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              عند حفظ الإعدادات، سيتم إعادة حساب جميع التقييمات المرتبطة بهذه الفترة تلقائيًا بناءً على التوزيع الجديد.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 flex-wrap">
            {saved && recalcCount !== null && (
              <span className="text-green-600 text-sm font-medium flex items-center gap-1 ml-auto">
                <CheckCircle className="h-4 w-4" />
                تم حفظ الإعدادات وإعادة حساب {recalcCount} تقييم بنجاح
              </span>
            )}
            <Button
              onClick={handleSave}
              loading={saving || recalculating}
              disabled={total !== 100}
              className="flex items-center gap-2"
            >
              {recalculating ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>جاري إعادة حساب التقييمات...</span>
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  <span>حفظ وإعادة الحساب</span>
                </>
              )}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setShowWeights(false)}
            >
              رجوع
            </Button>
          </div>
        </CardBody>
      </Card>
      )}

      {/* Name Change */}
      {nameSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">{nameSuccess}</span>
        </div>
      )}

      {!showNameForm ? (
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setShowNameForm(true); setNewName(user?.full_name || ''); }}>
          <CardBody className="flex items-center justify-between py-5 px-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">تغيير الاسم</h3>
                <p className="text-sm text-gray-500">الاسم الحالي: {user?.full_name}</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-lg">تغيير الاسم</h3>
            </div>

            <form onSubmit={handleChangeName} className="space-y-4">
              {nameError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{nameError}</span>
                </div>
              )}

              <div className="max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-1 text-right">الاسم الجديد</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-right focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="أدخل الاسم الجديد"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" size="sm" loading={nameLoading} disabled={!newName.trim()}>
                  حفظ الاسم
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => { setShowNameForm(false); setNameError(null); }}
                >
                  رجوع
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Password Change */}
      {pwSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">{pwSuccess}</span>
        </div>
      )}

      {!showPwForm ? (
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowPwForm(true)}>
          <CardBody className="flex items-center justify-between py-5 px-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Lock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">تغيير كلمة المرور</h3>
                <p className="text-sm text-gray-500">تحديث كلمة المرور الخاصة بحسابك</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Lock className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-lg">تغيير كلمة المرور</h3>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {pwError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{pwError}</span>
                </div>
              )}

              <div className="max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-1 text-right">كلمة المرور الجديدة</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-right focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="أدخل كلمة المرور الجديدة"
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1 text-right">6 أحرف على الأقل</p>
              </div>

              <div className="max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-1 text-right">تأكيد كلمة المرور الجديدة</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-right focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="أعد إدخال كلمة المرور الجديدة"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" size="sm" loading={pwLoading} disabled={!newPassword || !confirmPassword}>
                  تغيير كلمة المرور
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => { setShowPwForm(false); setPwError(null); setNewPassword(''); setConfirmPassword(''); }}
                >
                  رجوع
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
