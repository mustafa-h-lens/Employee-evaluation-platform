import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { Scale, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ChevronRight, User, CalendarOff } from 'lucide-react';
import { AvatarUploader } from '../../components/ui/AvatarUploader';
import { LeaveTypes } from './LeaveTypes';
import { WeightAllocation } from '../../components/admin/WeightAllocation';

export const AdminSettings: React.FC = () => {
  const { user, refreshUser } = useAuth();

  // Section visibility
  const [showWeights, setShowWeights] = useState(false);
  const [showLeaveTypes, setShowLeaveTypes] = useState(false);

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

  // The legacy period-wide weight save + bulk recalc loop was removed when
  // per-scope (per-group + high-management) weights replaced it. The new
  // WeightAllocation component writes weights directly to the per-scope
  // tables; new evaluations and re-saved drafts pick those up on the fly,
  // already-submitted evaluations stay frozen.

  return (
    <div className="space-y-6">
      <div
        className="rounded-ds-xl p-4 sm:p-5 lg:p-8"
        style={{
          background: 'var(--sc-purple-grad)',
          border: '1px solid var(--sc-purple-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--sc-purple-val)' }}>الإعدادات</h1>
        <p className="mt-2" style={{ color: 'var(--sc-purple-label)' }}>إدارة إعدادات نظام التقييم</p>
      </div>

      <Card>
        <CardBody className="py-6 px-6">
          <AvatarUploader />
        </CardBody>
      </Card>

      {!showWeights ? (
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowWeights(true)}>
          <CardBody className="flex items-center justify-between py-5 px-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-ds-info-bg rounded-lg flex items-center justify-center">
                <Scale className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-ds-text">توزيع أوزان التقييم</h3>
                <p className="text-sm text-ds-faint">توزيع نسبة المعايير العامة والخاصة لكل إدارة / مشرف / إدارة عليا</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-ds-faint" />
          </CardBody>
        </Card>
      ) : (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-ds-info-bg text-ds-info rounded-lg flex items-center justify-center">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ds-text">توزيع أوزان التقييم</h2>
                <p className="text-sm text-ds-muted">توزيع لكل مجموعة في الإدارات والمشرفين، وللإدارة العليا</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setShowWeights(false)}>إخفاء</Button>
          </div>
        </CardHeader>
        <CardBody>
          <WeightAllocation />
        </CardBody>
      </Card>
      )}

      {/* Leave types catalog */}
      {!showLeaveTypes ? (
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowLeaveTypes(true)}>
          <CardBody className="flex items-center justify-between py-5 px-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-ds-warning-bg rounded-lg flex items-center justify-center">
                <CalendarOff className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-ds-text">أنواع الإجازات</h3>
                <p className="text-sm text-ds-faint">قائمة أنواع الإجازات المعتمدة في النظام — تُستخدم عند إضافة إجازة لموظف</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-ds-faint" />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-ds-warning-bg text-ds-warning rounded-lg flex items-center justify-center">
                  <CalendarOff className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-ds-text">أنواع الإجازات</h2>
                  <p className="text-sm text-ds-muted">قائمة أنواع الإجازات المعتمدة في النظام — تُستخدم عند إضافة إجازة لموظف</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setShowLeaveTypes(false)}>إخفاء</Button>
            </div>
          </CardHeader>
          <CardBody>
            <LeaveTypes hideHero />
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
              <div className="w-10 h-10 bg-ds-info-bg rounded-lg flex items-center justify-center">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-ds-text">تغيير الاسم</h3>
                <p className="text-sm text-ds-faint">الاسم الحالي: {user?.full_name}</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-ds-faint" />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-ds-info-bg rounded-lg flex items-center justify-center">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-ds-text text-lg">تغيير الاسم</h3>
            </div>

            <form onSubmit={handleChangeName} className="space-y-4">
              {nameError && (
                <div className="bg-ds-danger-bg border border-ds-danger-border rounded-lg p-3 flex items-center gap-2 text-ds-danger-text text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{nameError}</span>
                </div>
              )}

              <div className="max-w-md">
                <label className="block text-sm font-medium text-ds-muted mb-1 text-right">الاسم الجديد</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-ds-border bg-ds-input text-ds-text placeholder:text-ds-faint px-4 py-2.5 text-sm text-right focus:border-ds-accent focus:ring-1 focus:ring-ds-accent outline-none"
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
              <div className="w-10 h-10 bg-ds-info-bg rounded-lg flex items-center justify-center">
                <Lock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-ds-text">تغيير كلمة المرور</h3>
                <p className="text-sm text-ds-faint">تحديث كلمة المرور الخاصة بحسابك</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-ds-faint" />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-ds-info-bg rounded-lg flex items-center justify-center">
                <Lock className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-ds-text text-lg">تغيير كلمة المرور</h3>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {pwError && (
                <div className="bg-ds-danger-bg border border-ds-danger-border rounded-lg p-3 flex items-center gap-2 text-ds-danger-text text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{pwError}</span>
                </div>
              )}

              <div className="max-w-md">
                <label className="block text-sm font-medium text-ds-muted mb-1 text-right">كلمة المرور الجديدة</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full rounded-lg border border-ds-border bg-ds-input text-ds-text placeholder:text-ds-faint px-4 py-2.5 text-sm text-right focus:border-ds-accent focus:ring-1 focus:ring-ds-accent outline-none"
                    placeholder="أدخل كلمة المرور الجديدة"
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute left-3 top-1/2 -translate-y-1/2 text-ds-faint hover:text-ds-muted">
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-ds-faint mt-1 text-right">6 أحرف على الأقل</p>
              </div>

              <div className="max-w-md">
                <label className="block text-sm font-medium text-ds-muted mb-1 text-right">تأكيد كلمة المرور الجديدة</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    className="w-full rounded-lg border border-ds-border bg-ds-input text-ds-text placeholder:text-ds-faint px-4 py-2.5 text-sm text-right focus:border-ds-accent focus:ring-1 focus:ring-ds-accent outline-none"
                    placeholder="أعد إدخال كلمة المرور الجديدة"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute left-3 top-1/2 -translate-y-1/2 text-ds-faint hover:text-ds-muted">
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
