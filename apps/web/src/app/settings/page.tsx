'use client';

import { useEffect, useState } from 'react';
import {
  User,
  Building,
  Shield,
  Bell,
  Palette,
  Database,
  Key,
  Save,
  Loader2,
  Settings2,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'profile', label: 'פרופיל', icon: User },
  { id: 'organization', label: 'ארגון', icon: Building },
  { id: 'permissions', label: 'הרשאות', icon: Shield },
  { id: 'notifications', label: 'התראות', icon: Bell },
  { id: 'appearance', label: 'מראה', icon: Palette },
  { id: 'integrations', label: 'אינטגרציות', icon: Database },
  { id: 'security', label: 'אבטחה', icon: Key },
];

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: '',
    language: 'he',
    timezone: 'Asia/Jerusalem',
  });
  const [passwords, setPasswords] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [appearance, setAppearance] = useState({ theme: 'system', density: 'comfortable' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.getMeProfile();
        if (!cancelled) {
          setProfileData((prev) => ({
            ...prev,
            full_name: me.full_name ?? prev.full_name,
            email: me.email ?? prev.email,
            phone: me.phone ?? '',
          }));
        }
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await api.updateUser(user.id, {
        full_name: profileData.full_name,
        email: profileData.email,
        phone: profileData.phone || null,
      });
      setUser({ ...user, full_name: updated.full_name, email: updated.email });
      alert('השינויים נשמרו בהצלחה');
    } catch (err) {
      console.error(err);
      alert('שגיאה בשמירת השינויים');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwords.current_password || !passwords.new_password) {
      alert('יש למלא סיסמה נוכחית וסיסמה חדשה');
      return;
    }
    if (passwords.new_password.length < 8) {
      alert('הסיסמה החדשה חייבת להכיל לפחות 8 תווים');
      return;
    }
    if (passwords.new_password !== passwords.confirm_password) {
      alert('הסיסמאות החדשות אינן תואמות');
      return;
    }
    setPasswordSaving(true);
    try {
      await api.changePassword({
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
      alert('הסיסמה עודכנה בהצלחה');
    } catch (err) {
      console.error(err);
      alert('שגיאה בעדכון הסיסמה - בדוק שהסיסמה הנוכחית נכונה');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSaveAppearance = () => {
    try {
      localStorage.setItem('qualityagent-appearance', JSON.stringify(appearance));
      alert('ההעדפות נשמרו');
    } catch (err) {
      console.error(err);
      alert('שגיאה בשמירת ההעדפות');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          icon={Settings2}
          title="הגדרות"
          subtitle="ניהול הגדרות החשבון, הארגון והמערכת"
        />

        {/* Tabs Navigation */}
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-secondary-100 p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap',
                  activeTab === tab.id
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-secondary-500 hover:text-secondary-800'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'profile' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                פרופיל אישי
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-6 max-w-2xl">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center">
                  <User className="h-10 w-10 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-secondary-900">{user?.full_name}</h3>
                  <p className="text-secondary-500">{user?.email}</p>
                  <Badge variant="primary" className="mt-1">{user?.role}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="שם מלא"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                />
                <Input
                  label="אימייל"
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                />
                <Input
                  label="טלפון"
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="050-1234567"
                />
                <Select
                  label="שפה"
                  value={profileData.language}
                  onChange={(e) => setProfileData(prev => ({ ...prev, language: e.target.value }))}
                  options={[
                    { value: 'he', label: 'עברית' },
                    { value: 'en', label: 'English' },
                  ]}
                />
                <Select
                  label="אזור זמן"
                  value={profileData.timezone}
                  onChange={(e) => setProfileData(prev => ({ ...prev, timezone: e.target.value }))}
                  options={[
                    { value: 'Asia/Jerusalem', label: 'ישראל (GMT+2/3)' },
                    { value: 'UTC', label: 'UTC' },
                    { value: 'Europe/London', label: 'לונדון' },
                    { value: 'America/New_York', label: 'ניו יורק' },
                  ]}
                />
              </div>

              <div className="pt-4 border-t border-secondary-200">
                <Button onClick={handleSave} loading={saving}>
                  <Save className="h-4 w-4" />
                  שמור שינויים
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {activeTab === 'organization' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                הגדרות ארגון
              </CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-4 max-w-2xl">
                <div className="p-4 bg-secondary-50 rounded-lg">
                  <p className="text-sm text-secondary-600">
                    הגדרות ארגון זמינות למנהלי מערכת בלבד. פנה למנהל המערכת שלך לשינויים.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="שם הארגון" value="מפעל הדגמה - פלסטיק עמית" disabled />
                  <Input label="תעשייה" value="פלסטיק" disabled />
                  <Input label="אזור זמן" value="Asia/Jerusalem" disabled />
                  <Select
                    label="סטטוס"
                    value="active"
                    disabled
                    options={[
                      { value: 'active', label: 'פעיל' },
                      { value: 'inactive', label: 'לא פעיל' },
                      { value: 'trial', label: 'ניסיון' },
                    ]}
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {activeTab === 'permissions' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                הרשאות ותפקידים
              </CardTitle>
            </CardHeader>
            <CardBody>
              <div className="max-w-3xl">
                <div className="space-y-4">
                  {[
                    { role: 'admin', label: 'מנהל מערכת', desc: 'גישה מלאה לכל המערכת כולל ניהול משתמשים והגדרות' },
                    { role: 'quality_manager', label: 'אחראי איכות', desc: 'ניהול חריגות, CAPA, מסמכים, דוחות וצפייה בכל הנתונים' },
                    { role: 'quality_inspector', label: 'מבקר איכות', desc: 'דיווח חריגות, ביצוע בדיקות, עדכון CAPA, צפייה במסמכים' },
                    { role: 'production_worker', label: 'עובד ייצור', desc: 'דיווח חריגות, צפייה במשימות משויכות, עדכון התקדמות' },
                    { role: 'viewer', label: 'צופה', desc: 'צפייה בלבד במסמכים מפורסמים ודשבורד לקריאה בלבד' },
                  ].map(({ role, label, desc }) => (
                    <div key={role} className={cn('p-4 rounded-lg border', user?.role === role ? 'border-primary-300 bg-primary-50' : 'border-secondary-200')}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', user?.role === role ? 'bg-primary-100' : 'bg-secondary-100')}>
                            <Shield className={cn('h-5 w-5', user?.role === role ? 'text-primary-600' : 'text-secondary-400')} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-secondary-900">{label}</h4>
                              {user?.role === role && <Badge variant="primary" className="text-xs">התפקיד שלך</Badge>}
                            </div>
                            <p className="text-sm text-secondary-500 mt-1">{desc}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {activeTab === 'notifications' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                הגדרות התראות
              </CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-4 max-w-2xl">
                {[
                  { id: 'email_ncr', label: 'אימייל על חריגות חדשות', desc: 'קבל התראה כשנפתחת חריגה חדשה שמשויכת אליך' },
                  { id: 'email_capa_due', label: 'אימייל על CAPA מתקרב', desc: 'תזכורת 3 ימים לפני תאריך יעד של פעולה מתקנת' },
                  { id: 'email_capa_overdue', label: 'אימייל על CAPA באיחור', desc: 'התראה מיידית כשפעולה מתקנת עוברת את תאריך היעד' },
                  { id: 'email_ai_rec', label: 'אימייל על המלצות AI', desc: 'התראה כשהסוכן יוצר המלצה חדשה בדרגת אזהרה או קריטי' },
                  { id: 'push_enabled', label: 'התראות דפדפן', desc: 'אפשר התראות בזמן אמת בדפדפן' },
                  { id: 'daily_digest', label: 'סיכום יומי', desc: 'קבל סיכום איכות יומי באימייל בכל בוקר' },
                ].map(({ id, label, desc }) => (
                  <label key={id} className="flex items-center justify-between p-4 border border-secondary-200 rounded-lg hover:bg-secondary-50 cursor-pointer">
                    <div className="flex-1">
                      <p className="font-medium text-secondary-900">{label}</p>
                      <p className="text-sm text-secondary-500 mt-1">{desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked={id !== 'daily_digest'}
                      className="w-5 h-5 text-primary-600 rounded border-secondary-300 focus:ring-primary-500"
                    />
                  </label>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {activeTab === 'appearance' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                מראה ותצוגה
              </CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-6 max-w-2xl">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-3">מצב תצוגה</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['light', 'dark', 'system'].map((mode) => (
                      <label key={mode} className={cn(
                        'p-4 rounded-lg border-2 cursor-pointer transition-colors text-center',
                        appearance.theme === mode ? 'border-primary-500 bg-primary-50' : 'border-secondary-200 hover:border-secondary-300'
                      )}>
                        <input
                          type="radio"
                          name="theme"
                          value={mode}
                          checked={appearance.theme === mode}
                          onChange={() => setAppearance((prev) => ({ ...prev, theme: mode }))}
                          className="sr-only"
                        />
                        <div className="font-medium text-secondary-900 capitalize">{mode}</div>
                        <p className="text-xs text-secondary-500 mt-1">
                          {mode === 'light' && 'בהיר תמיד'}
                          {mode === 'dark' && 'כהה תמיד'}
                          {mode === 'system' && 'לפי המערכת'}
                        </p>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-3">צפיפות תצוגה</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['comfortable', 'compact', 'spacious'].map((density) => (
                      <label key={density} className={cn(
                        'p-4 rounded-lg border-2 cursor-pointer transition-colors text-center',
                        appearance.density === density ? 'border-primary-500 bg-primary-50' : 'border-secondary-200 hover:border-secondary-300'
                      )}>
                        <input
                          type="radio"
                          name="density"
                          value={density}
                          checked={appearance.density === density}
                          onChange={() => setAppearance((prev) => ({ ...prev, density }))}
                          className="sr-only"
                        />
                        <div className="font-medium text-secondary-900 capitalize">{density}</div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-secondary-200">
                  <Button variant="primary" onClick={handleSaveAppearance}>שמור העדפות</Button>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {activeTab === 'integrations' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                אינטגרציות
              </CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-4 max-w-2xl">
                {[
                  { name: 'ERP System', status: 'disconnected', desc: 'התחברות למערכת ERP ליבוא נתוני ייצור והזמנות' },
                  { name: 'MES System', status: 'disconnected', desc: 'חיבור לרצפת ייצור לקריאת נתוני מכונות ובדיקות' },
                  { name: 'Email (SMTP)', status: 'connected', desc: 'שליחת התראות ודוחות אוטומטיים' },
                  { name: 'File Storage (S3)', status: 'connected', desc: 'אחסון מסמכים, תמונות וראיות' },
                  { name: 'Active Directory / SSO', status: 'disconnected', desc: 'אימות משתמשים ארגוני' },
                ].map((integration) => (
                  <div key={integration.name} className="flex items-center justify-between p-4 border border-secondary-200 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center',
                        integration.status === 'connected' ? 'bg-success-100' : 'bg-secondary-100'
                      )}>
                        <Database className={cn('h-6 w-6', integration.status === 'connected' ? 'text-success-600' : 'text-secondary-400')} />
                      </div>
                      <div>
                        <h4 className="font-medium text-secondary-900">{integration.name}</h4>
                        <p className="text-sm text-secondary-500">{integration.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={integration.status === 'connected' ? 'success' : 'secondary'}>
                        {integration.status === 'connected' ? 'מחובר' : 'לא מחובר'}
                      </Badge>
                      <Button variant="ghost" size="sm" disabled title="אינטגרציות יופעלו בגרסה הבאה">
                        {integration.status === 'connected' ? 'נתק' : 'הגדר'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {activeTab === 'security' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                אבטחה
              </CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-6 max-w-2xl">
                <div>
                  <h3 className="font-medium text-secondary-900 mb-4">שינוי סיסמה</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="סיסמה נוכחית"
                      type="password"
                      placeholder="הכנס סיסמה נוכחית"
                      value={passwords.current_password}
                      onChange={(e) => setPasswords((prev) => ({ ...prev, current_password: e.target.value }))}
                    />
                    <Input
                      label="סיסמה חדשה"
                      type="password"
                      placeholder="הכנס סיסמה חדשה"
                      value={passwords.new_password}
                      onChange={(e) => setPasswords((prev) => ({ ...prev, new_password: e.target.value }))}
                    />
                  </div>
                  <Input
                    label="אישור סיסמה חדשה"
                    type="password"
                    placeholder="אשר סיסמה חדשה"
                    className="max-w-xs mt-4"
                    value={passwords.confirm_password}
                    onChange={(e) => setPasswords((prev) => ({ ...prev, confirm_password: e.target.value }))}
                  />
                  <Button variant="primary" className="mt-4" onClick={handleChangePassword} loading={passwordSaving}>
                    עדכן סיסמה
                  </Button>
                </div>

                <div className="pt-6 border-t border-secondary-200">
                  <h3 className="font-medium text-secondary-900 mb-4">אימות דו-שלבי (2FA)</h3>
                  <div className="p-4 bg-secondary-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-secondary-900">אימות דו-שלבי מופעל</p>
                        <p className="text-sm text-secondary-500">הוסף שכבת אבטחה נוספת לחשבון שלך</p>
                      </div>
                      <Badge variant="secondary">בפיתוח</Badge>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-secondary-200">
                  <h3 className="font-medium text-secondary-900 mb-4">פעילות אחרונה</h3>
                  <div className="space-y-2">
                    {[
                      { time: 'לפני 5 דקות', action: 'התחברות', ip: '192.168.1.100', device: 'Chrome on Windows' },
                      { time: 'לפני שעתיים', action: 'צפייה בדשבורד', ip: '192.168.1.100', device: 'Chrome on Windows' },
                      { time: 'אתמול', action: 'יצירת NCR-1042', ip: '192.168.1.100', device: 'Chrome on Windows' },
                    ].map((activity, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg">
                        <div>
                          <p className="font-medium text-secondary-900">{activity.action}</p>
                          <p className="text-sm text-secondary-500">{activity.device} • {activity.ip}</p>
                        </div>
                        <span className="text-xs text-secondary-400">{activity.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}