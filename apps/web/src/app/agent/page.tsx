'use client';

import { useEffect, useState } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Clock,
  Brain,
  RefreshCw,
  MessageSquare,
  X,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { api } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Recommendation {
  id: string;
  type: string;
  severity: string;
  title: string;
  description?: string;
  rationale?: string;
  confidence?: string;
  evidence: Array<{ type: string; id: string; number?: string }>;
  missing_information: string[];
  recommended_action: { type: string; reason: string; requires_approval: boolean };
  status: string;
  created_at: string;
  approved_by_id?: string;
  approved_at?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Array<{ type: string; id: string; label: string }>;
  recommendations?: Recommendation[];
}

const typeLabels: Record<string, string> = {
  repeated_defect: 'פגם חוזר',
  overdue_capa: 'CAPA באיחור',
  document_expiry: 'תוקף מסמך פג',
  trend_alert: 'התראת מגמה',
  rca_suggestion: 'הצעת RCA',
  inspection_schedule: 'תזמון בדיקה',
  supplier_alert: 'התראת ספק',
};

const severityColors: Record<string, 'danger' | 'warning' | 'secondary'> = {
  critical: 'danger',
  warning: 'warning',
  info: 'secondary',
};

export default function AgentPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'recommendations' | 'chat' | 'runs'>('recommendations');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const data = await api.getAgentRecommendations();
      setRecommendations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAgent = async () => {
    setRunLoading(true);
    try {
      await api.triggerAgentRun('manual');
      await fetchRecommendations();
    } catch (err) {
      console.error(err);
    } finally {
      setRunLoading(false);
    }
  };

  const handleActOnRecommendation = async (id: string, action: 'approve' | 'reject' | 'implement') => {
    try {
      await api.actOnRecommendation(id, action);
      await fetchRecommendations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, userMessage]);
    const input = chatInput;
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await api.chatWithAgent(input);
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        sources: response.sources,
        recommendations: response.recommendations,
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
      if (response.recommendations.length > 0) {
        await fetchRecommendations();
      }
    } catch (err) {
      console.error(err);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'אירעה שגיאה בעיבוד הבקשה. נסה שוב מאוחר יותר.',
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  };

  const pendingCount = recommendations.filter(r => r.status === 'pending').length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          icon={Bot}
          title="סוכן AI פרואקטיבי"
          badge={pendingCount > 0 ? <Badge variant="warning">{pendingCount} ממתינות</Badge> : undefined}
          subtitle="המלצות חכמות, ניטור אוטומטי וצ׳אט עם הסוכן"
          actions={
            <Button variant="primary" onClick={handleRunAgent} loading={runLoading} className="whitespace-nowrap">
              {!runLoading && <RefreshCw className="h-4 w-4" />}
              הפעל בדיקה יזומה
            </Button>
          }
        />

        {/* Tabs */}
        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-secondary-100 p-1">
          {[
            { id: 'recommendations', label: 'המלצות ממתינות', count: pendingCount, icon: AlertTriangle },
            { id: 'chat', label: 'צ׳אט עם הסוכן', icon: MessageSquare },
            { id: 'runs', label: 'הרצות אחרונות', icon: Clock },
          ].map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
                activeTab === tab.id
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-secondary-500 hover:text-secondary-800'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="text-xs rounded-full bg-danger-50 text-danger-600 px-1.5 py-0.5 tabular-nums">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Recommendations Tab */}
        {activeTab === 'recommendations' && (
          <div className="space-y-4">
            {loading ? (
              <Card>
                <CardBody className="p-0 divide-y divide-secondary-100">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="p-6 animate-pulse space-y-3">
                      <div className="h-3.5 w-1/4 rounded bg-secondary-100" />
                      <div className="h-4 w-1/2 rounded bg-secondary-100" />
                      <div className="h-3 w-2/3 rounded bg-secondary-50" />
                    </div>
                  ))}
                </CardBody>
              </Card>
            ) : recommendations.length === 0 ? (
              <Card>
                <EmptyState
                  icon={Brain}
                  title="אין המלצות ממתינות"
                  description="הסוכן לא זיהה בעיות הדורשות תשומת לב כרגע."
                  action={
                    <Button variant="primary" onClick={handleRunAgent} loading={runLoading}>
                      <RefreshCw className="h-4 w-4" />
                      הפעל בדיקה יזומה
                    </Button>
                  }
                />
              </Card>
            ) : (
              <div className="space-y-4">
                {recommendations.filter(r => r.status === 'pending').map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    recommendation={rec}
                    onAction={handleActOnRecommendation}
                  />
                ))}
                {recommendations.filter(r => r.status !== 'pending').length > 0 && (
                  <details className="group">
                    <summary className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg cursor-pointer">
                      <span className="font-medium text-secondary-700">
                        היסטוריה ({recommendations.filter(r => r.status !== 'pending').length})
                      </span>
                      <Sparkles className="h-5 w-5 text-secondary-400" />
                    </summary>
                    <div className="p-4 space-y-3">
                      {recommendations.filter(r => r.status !== 'pending').map((rec) => (
                        <RecommendationCard
                          key={rec.id}
                          recommendation={rec}
                          onAction={handleActOnRecommendation}
                          readonly
                        />
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <Card className="flex flex-col h-[600px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                שיחה עם הסוכן
              </CardTitle>
            </CardHeader>
            <CardBody className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 ? (
                <div className="text-center text-secondary-500 py-12">
                  <Bot className="h-16 w-16 mx-auto text-secondary-300 mb-4" />
                  <p className="text-lg font-medium text-secondary-900 mb-2">שלום! אני הסוכן הפרואקטיבי של QualityAgent</p>
                  <p className="max-w-md mx-auto">אני יכול לעזור לך עם:</p>
                  <ul className="text-right mt-4 space-y-2 max-w-md mx-auto">
                    <li className="flex items-center gap-2 justify-center"><Sparkles className="h-5 w-5 text-primary-500" /> חיפוש חריגות וניתוח מגמות</li>
                    <li className="flex items-center gap-2 justify-center"><Sparkles className="h-5 w-5 text-primary-500" /> מעקב פעולות מתקנות</li>
                    <li className="flex items-center gap-2 justify-center"><Sparkles className="h-5 w-5 text-primary-500" /> הצגת המלצות אוטומטיות</li>
                    <li className="flex items-center gap-2 justify-center"><Sparkles className="h-5 w-5 text-primary-500" /> ניתוח סיבות שורש</li>
                  </ul>
                  <p className="mt-6 text-sm text-secondary-400">נסה לשאול: "מה החריגות החוזרות החודש?" או "איזה CAPAs באיחור?"</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {chatMessages.map((msg, index) => (
                    <div key={index} className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : '')}>
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                          msg.role === 'user' ? 'bg-primary-100 text-primary-600' : 'bg-secondary-100 text-secondary-600'
                        )}
                      >
                        {msg.role === 'user' ? (
                          <span className="text-xs font-medium">אתה</span>
                        ) : (
                          <Bot className="h-5 w-5" />
                        )}
                      </div>
                      <div
                        className={cn(
                          'max-w-[70%] p-4 rounded-2xl',
                          msg.role === 'user'
                            ? 'bg-primary-50 rounded-tr-none'
                            : 'bg-white border border-secondary-200 rounded-tl-none'
                        )}
                      >
                        <p className="text-secondary-900 whitespace-pre-wrap">{msg.content}</p>
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-secondary-100">
                            <p className="text-xs text-secondary-500 mb-1">מקורות:</p>
                            <div className="flex flex-wrap gap-1">
                              {msg.sources.map((src, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {src.label || `${src.type}:${src.id.slice(0, 8)}`}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {msg.recommendations && msg.recommendations.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-secondary-100">
                            <p className="text-xs text-secondary-500 mb-1">המלצות שנוצרו:</p>
                            <div className="flex flex-wrap gap-1">
                              {msg.recommendations.map((rec, i) => (
                                <Badge key={i} variant="warning" className="text-xs">
                                  {rec.title}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
            <CardFooter>
              <form onSubmit={handleChatSubmit} className="w-full">
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="שאל את הסוכן שאלה..."
                    className="flex-1"
                    disabled={chatLoading}
                  />
                  <Button type="submit" loading={chatLoading} disabled={!chatInput.trim() || chatLoading}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </CardFooter>
          </Card>
        )}

        {/* Runs Tab */}
        {activeTab === 'runs' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                הרצות סוכן אחרונות
              </CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-secondary-500 text-center py-8">היסטוריית הרצות תופיע כאן לאחר הפעלת הסוכן</p>
            </CardBody>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

function RecommendationCard({
  recommendation,
  onAction,
  readonly = false,
}: {
  recommendation: Recommendation;
  onAction: (id: string, action: 'approve' | 'reject' | 'implement') => Promise<void>;
  readonly?: boolean;
}) {
  const SeverityIcon = recommendation.severity === 'critical' ? AlertTriangle : 
                       recommendation.severity === 'warning' ? AlertTriangle : CheckCircle;

  return (
    <Card className={cn('border-r-4', recommendation.severity === 'critical' ? 'border-danger-500' : recommendation.severity === 'warning' ? 'border-warning-500' : 'border-primary-500')}>
      <CardBody>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant={severityColors[recommendation.severity] || 'secondary'}>
                {recommendation.severity === 'critical' ? 'קריטי' : recommendation.severity === 'warning' ? 'אזהרה' : 'מידע'}
              </Badge>
              <Badge variant="secondary">{typeLabels[recommendation.type] || recommendation.type}</Badge>
              {recommendation.confidence && (
                <Badge variant="secondary">ביטחון: {recommendation.confidence}</Badge>
              )}
              <StatusBadge status={recommendation.status} type="ncr" />
            </div>
            <h3 className="mt-2 font-medium text-secondary-900">{recommendation.title}</h3>
            {recommendation.description && (
              <p className="mt-1 text-sm text-secondary-600">{recommendation.description}</p>
            )}
            {recommendation.rationale && (
              <p className="mt-2 text-sm text-secondary-500"><strong>נימוק:</strong> {recommendation.rationale}</p>
            )}
            {recommendation.evidence.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {recommendation.evidence.map((ev, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {ev.number || `${ev.type}:${ev.id.slice(0, 8)}`}
                  </Badge>
                ))}
              </div>
            )}
            {recommendation.missing_information.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-warning-600">
                  <strong>מידע חסר:</strong> {recommendation.missing_information.join(', ')}
                </p>
              </div>
            )}
            <div className="mt-2 p-2 bg-secondary-50 rounded-lg">
              <p className="text-xs text-secondary-600">
                <strong>פעולה מומלצת:</strong>{' '}
                {recommendation.recommended_action.reason}
                {recommendation.recommended_action.requires_approval && ' (דורש אישור)'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-xs text-secondary-400">{formatRelativeTime(recommendation.created_at)}</span>
            {!readonly && recommendation.status === 'pending' && (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => onAction(recommendation.id, 'reject')}>
                  <X className="h-3 w-3" />
                  דחה
                </Button>
                <Button variant={recommendation.recommended_action.requires_approval ? 'primary' : 'success'} size="sm" onClick={() => onAction(recommendation.id, 'approve')}>
                  <CheckCircle className="h-3 w-3" />
                  {recommendation.recommended_action.requires_approval ? 'אשר' : 'החל'}
                </Button>
              </div>
            )}
            {readonly && recommendation.status !== 'pending' && (
              <Badge variant={recommendation.status === 'approved' ? 'success' : recommendation.status === 'rejected' ? 'danger' : 'secondary'}>
                {recommendation.status === 'approved' ? 'אושר' : recommendation.status === 'rejected' ? 'נדחה' : 'יושם'}
              </Badge>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}