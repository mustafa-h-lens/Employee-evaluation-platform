import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ChevronLeft } from 'lucide-react';
import { AvatarUploader } from '../../components/ui/AvatarUploader';

export const ChangePassword: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword.length < 6) {
      setErrorMsg('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('كلمة المرور الجديدة وتأكيدها غير متطابقتين');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setErrorMsg('حدث خطأ أثناء تغيير كلمة المرور');
        return;
      }

      setSuccessMsg('تم تغيير كلمة المرور بنجاح');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSuccessMsg(null);
        setShowForm(false);
      }, 3000);
    } catch {
      setErrorMsg('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      <div
        className="rounded-ds-xl p-5 lg:p-8"
        style={{
          background: 'var(--sc-purple-grad)',
          border: '1px solid var(--sc-purple-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-purple-val)' }}>الإعدادات</h1>
        <p className="mt-2" style={{ color: 'var(--sc-purple-label)' }}>إدارة إعدادات حسابك</p>
      </div>

      <Card>
        <CardBody className="py-6 px-6">
          <AvatarUploader />
        </CardBody>
      </Card>

      {!showForm ? (
        <Card className="max-w-lg cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowForm(true)}>
          <CardBody className="flex items-center justify-between py-5 px-6">
            <ChevronLeft className="h-5 w-5 text-ds-faint" />
            <div className="flex items-center gap-3">
              <div>
                <h3 className="font-semibold text-ds-text">تغيير كلمة المرور</h3>
                <p className="text-sm text-ds-faint">تحديث كلمة المرور الخاصة بحسابك</p>
              </div>
              <div className="w-10 h-10 bg-ds-info-bg rounded-lg flex items-center justify-center">
                <Lock className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card className="max-w-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div />
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-ds-text text-lg">تغيير كلمة المرور</h3>
                <div className="w-10 h-10 bg-ds-info-bg rounded-lg flex items-center justify-center">
                  <Lock className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="bg-ds-danger-bg border border-ds-danger-border rounded-lg p-3 flex items-center gap-2 text-ds-danger-text text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-ds-muted mb-1">كلمة المرور الجديدة</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full rounded-lg border border-ds-border bg-ds-input text-ds-text placeholder:text-ds-faint px-4 py-2.5 text-sm focus:border-ds-accent focus:ring-1 focus:ring-ds-accent outline-none"
                    placeholder="أدخل كلمة المرور الجديدة"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ds-faint hover:text-ds-muted"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-ds-faint mt-1">6 أحرف على الأقل</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-ds-muted mb-1">تأكيد كلمة المرور الجديدة</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    className="w-full rounded-lg border border-ds-border bg-ds-input text-ds-text placeholder:text-ds-faint px-4 py-2.5 text-sm focus:border-ds-accent focus:ring-1 focus:ring-ds-accent outline-none"
                    placeholder="أعد إدخال كلمة المرور الجديدة"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ds-faint hover:text-ds-muted"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => { setShowForm(false); setErrorMsg(null); setNewPassword(''); setConfirmPassword(''); }}
                >
                  رجوع
                </Button>
                <Button type="submit" size="sm" loading={loading} disabled={!newPassword || !confirmPassword}>
                  تغيير كلمة المرور
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
