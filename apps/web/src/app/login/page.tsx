'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Bot, Eye, EyeOff, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/utils';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await api.login(email, password);
      const userData = await api.getMeProfile();
      setAuth(userData, data.access_token, data.refresh_token);
      router.push(callbackUrl);
      router.refresh();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosError.response?.data?.error?.message || 'שגיאה בהתחברות. בדוק את הפרטים.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setError('');

    try {
      const data = await api.demoLogin();
      const userData = await api.getMeProfile();
      setAuth(userData, data.access_token, data.refresh_token);
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setError('שגיאה בכניסת הדגמה. ודא שהשרת רץ.');
      console.error(err);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-50 via-secondary-50 to-white px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl shadow-xl shadow-primary-500/25 flex items-center justify-center">
              <Bot className="h-10 w-10 text-white" />
            </div>
          </Link>
          <h1 className="text-3xl font-bold text-secondary-900">QualityAgent</h1>
          <p className="text-secondary-500 mt-2">פלטפורמת AI לניהול איכות בייצור</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-lg shadow-secondary-200/50">
          <CardHeader className="text-center">
            <CardTitle>התחברות למערכת</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            {error && (
              <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="אימייל"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="user@company.com"
              />

              <div className="relative">
                <Input
                  label="סיסמה"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="הכנס סיסמה"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-[38px] text-secondary-400 hover:text-secondary-600"
                  aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              <Button type="submit" className="w-full" loading={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                התחבר
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-secondary-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-secondary-500">או</span>
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={handleDemoLogin}
              loading={demoLoading}
            >
              <Bot className="h-4 w-4" />
              כניסת הדגמה (מפתחים)
            </Button>

            <p className="text-center text-sm text-secondary-500">
              גרסת הדגמה - משתמש: quality@demo.com / סיסמה: demo123
            </p>
          </CardBody>
          <CardFooter className="text-center">
            <p className="text-sm text-secondary-500">
              גרסה 0.1.0 - סביבת פיתוח
            </p>
          </CardFooter>
        </Card>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-3 text-center">
          <div className="p-4 bg-white/80 backdrop-blur rounded-xl border border-secondary-200 hover:border-primary-300 transition-colors">
            <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Bot className="h-5 w-5 text-primary-600" />
            </div>
            <p className="text-sm font-medium text-secondary-900">סוכן AI</p>
            <p className="text-xs text-secondary-500">פרואקטיבי וחכם</p>
          </div>
          <div className="p-4 bg-white/80 backdrop-blur rounded-xl border border-secondary-200 hover:border-primary-300 transition-colors">
            <div className="w-8 h-8 bg-success-50 rounded-lg flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="h-5 w-5 text-success-600" />
            </div>
            <p className="text-sm font-medium text-secondary-900">CAPA מלא</p>
            <p className="text-xs text-secondary-500">תיקון ומניעה</p>
          </div>
          <div className="p-4 bg-white/80 backdrop-blur rounded-xl border border-secondary-200 hover:border-primary-300 transition-colors">
            <div className="w-8 h-8 bg-warning-50 rounded-lg flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="h-5 w-5 text-warning-600" />
            </div>
            <p className="text-sm font-medium text-secondary-900">NCR חכם</p>
            <p className="text-xs text-secondary-500">זיהוי וחקירה</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-secondary-50">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}