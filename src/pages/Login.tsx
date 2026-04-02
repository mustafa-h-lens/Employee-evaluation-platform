import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { LogIn } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex" dir="rtl">
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex justify-center mb-6">
              <img src="/logo-color.png" alt="Half Lens" className="h-20 w-auto" />
            </div>

            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                منصة التقييم الوظيفي
              </h1>
              <p className="text-gray-600">
                نظام إدارة تقييم الأداء الوظيفي
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Input
                type="email"
                label="البريد الإلكتروني"
                placeholder="example@h-lens.co"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />

              <Input
                type="password"
                label="كلمة المرور"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />

              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={loading}
                className="flex items-center justify-center gap-2"
              >
                <span>تسجيل الدخول</span>
                <LogIn className="h-5 w-5" />
              </Button>
            </form>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-800 text-center">
                استخدم بيانات الدخول المقدمة من مدير النظام
              </p>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>© 2026 HALF LENS. جميع الحقوق محفوظة</p>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 p-12 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-64 h-64 border-4 border-white rounded-full"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 border-4 border-white rounded-full"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 border-4 border-white rotate-45"></div>
        </div>

        <div className="relative z-10 text-white text-center max-w-lg">
          <div className="flex items-center justify-center mx-auto mb-8">
            <img src="/logo-light.png" alt="Half Lens" className="h-40 w-auto" />
          </div>
          <p className="text-blue-100 text-lg">منصة التقييم الوظيفي</p>
        </div>
      </div>
    </div>
  );
};
