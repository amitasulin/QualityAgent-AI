# QualityAgent - AI Quality Operations Platform

פלטפורמת AI לניהול איכות במפעלי ייצור עם סוכן פרואקטיבי חכם.

## 🚀 התחלה מהירה

### דרישות מוקדמות
- Docker Desktop מותקן ופועל
- VS Code (מומלץ)
- Git

### הרצת הפרויקט

```bash
# שכפול המאגר
git clone <repository-url>
cd QualityAgent

# בנייה והרצה עם Docker Compose
docker-compose up --build
```

השירותים יהיו זמינים בכתובות:
- **Frontend (Next.js)**: http://localhost:3000
- **Backend API (FastAPI)**: http://localhost:8000
- **API Documentation (Swagger)**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### כניסה למערכת
בדף הכניסה (http://localhost:3000/login) לחצו על **"כניסת הדגמה (מפתחים)"** או השתמשו בפרטים:
- אימייל: `quality@demo.com`
- סיסמה: `demo123`

## 📁 מבנה הפרויקט

```
quality-agent/
├── docker-compose.yml          # תזמור השירותים
├── infra/
│   └── sql/
│       └── init.sql           # אתחול מסד הנתונים
├── apps/
│   ├── api/                   # FastAPI Backend
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── app/
│   │       ├── main.py        # נקודת כניסה
│   │       ├── core/          # הגדרות, DB, אבטחה
│   │       ├── models/        # מודלי SQLAlchemy
│   │       ├── schemas/       # Pydantic Schemas
│   │       └── api/           # נתיבי API
│   └── web/                   # Next.js Frontend
│       ├── Dockerfile
│       ├── package.json
│       ├── next.config.js
│       ├── tailwind.config.js
│       └── src/
│           ├── app/           # דפי Next.js (App Router)
│           ├── components/    # רכיבי React
│           └── lib/           # utilities, API client, store
└── packages/
    └── contracts/             # סכמות משותפות (OpenAPI/TypeScript)
```

## 🛠 טכנולוגיות

### Backend
- **FastAPI** - Web framework מודרני ומהיר
- **SQLAlchemy 2.0** - ORM אסינכרוני
- **PostgreSQL 16** - מסד נתונים ראשי
- **Redis 7** - מטמון ותורים
- **Alembic** - מיגרציות מסד נתונים
- **Pydantic v2** - ולידציה וסריאליזציה
- **python-jose** - JWT authentication
- **Celery** - משימות רקע

### Frontend
- **Next.js 14** (App Router) - React framework
- **TypeScript** - טיפוסים סטטיים
- **Tailwind CSS** - עיצוב utility-first
- **shadcn/ui** - רכיבי UI נגישים
- **Zustand** - ניהול מצב גלובלי
- **TanStack Query** - ניהול מצב שרת
- **Axios** - HTTP client
- **Lucide React** - אייקונים
- **Recharts** - גרפים

### DevOps
- **Docker & Docker Compose** - קונטיינריזציה
- **GitHub Actions** - CI: type-check, בדיקות יחידה ובנייה בכל push

## 📋 תכונות עיקריות (MVP)

### ניהול אי התאמות (NCR)
- ✅ יצירת חריגות עם טופס מלא
- ✅ מכונת מצבים (Draft → Open → Contained → Investigating → Action Pending → Effectiveness Review → Closed)
- ✅ העלאת קבצים ותמונות
- ✅ סינון, חיפוש ועימוד
- ✅ הקצאת אחראי ומעקב

### פעולות מתקנות (CAPA)
- ✅ יצירת פעולות מתקנות/מונעות/תיקונים
- ✅ תאריכי יעד ומעקב איחורים
- ✅ בדיקת אפקטיביות
- ✅ אישור מנהל איכות

### סוכן AI פרואקטיבי
- ✅ זיהוי פגמים חוזרים (Same product + defect code ב-7 ימים)
- ✅ התראות על CAPA באיחור
- ✅ המלצות מובנות עם ראיות וביטחון
- ✅ צ'אט עם הסוכן (שפה טבעית)
- ✅ מנגנון אישור/דחייה/יישום המלצות

### דשבורד ניהולי
- ✅ מדדי KPI בזמן אמת
- ✅ מגמת חריגות (6 חודשים)
- ✅ תובנות AI אוטומטיות
- ✅ חריגות ופעולות אחרונות
- ✅ מועדי יעד קרובים

### ניהול נתוני בסיס
- ✅ ארגונים (Multi-tenant)
- ✅ אתרים/קווי ייצור
- ✅ משתמשים ותפקידים (RBAC)
- ✅ מוצרים, לקוחות, ספקים
- ✅ מסמכים וגרסאות

### קבצים ואחסון
- ✅ העלאת נספחים ל-NCR ושמירתם בפועל
- ✅ העלאת גרסאות מסמך מקובץ אמיתי
- ✅ הורדת קבצים מאובטחת דרך ה-API
- ✅ שמירה ב-Postgres (שורדת דיפלוי גם בלי דיסק קבוע)
- ✅ הגבלת גודל קובץ ל-15MB

## 🔐 אבטחה והרשאות

### תפקידים (Roles)
| תפקיד | הרשאות עיקריות |
|--------|----------------|
| `admin` | ניהול מלא: משתמשים, ארגון, הגדרות, כל הנתונים |
| `quality_manager` | ניהול חריגות, CAPA, מסמכים, דוחות, צפייה בכל |
| `quality_inspector` | דיווח חריגות, בדיקות, עדכון CAPA, מסמכים |
| `production_worker` | דיווח חריגות, משימות משויכות |
| `viewer` | צפייה בלבד במסמכים מפורסמים ודשבורד |

### Multi-tenancy
- בידוד מלא ברמת מסד נתונים (Row Level Security)
- כל רשומה משויכת ל-`tenant_id`
- API מאמת שייכות לארגון בכל בקשה

## 🗄 מסד נתונים

### טבלאות עיקריות
- `organizations` - ארגונים (Tenants)
- `sites` - אתרים/מפעלים
- `users` - משתמשים
- `products` - מוצרים (SKU, גרסאות)
- `customers` / `suppliers` - לקוחות וספקים
- `documents` / `document_versions` - נהלים ומסמכים
- `nonconformities` - אי התאמות (NCR)
- `ncr_attachments` - קבצים מצורפים
- `file_objects` - תוכן הקבצים עצמם (BYTEA), משותף לנספחים ולגרסאות מסמך
- `corrective_actions` - פעולות מתקנות (CAPA)
- `effectiveness_checks` - בדיקות אפקטיביות
- `agent_runs` / `agent_recommendations` - הרצות והמלצות סוכן
- `audit_events` - Audit Trail מלא
- `tasks` - משימות ומעקב

## 🔧 פיתוח מקומי

### הרצת Backend בלבד
```bash
cd apps/api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # ערוך הגדרות
uvicorn app.main:app --reload
```

### הרצת Frontend בלבד
```bash
cd apps/web
npm install
npm run dev
```

### מיגרציות מסד נתונים
```bash
cd apps/api
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## 📝 משתני סביבה

### Backend (`.env`)
```env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/qualityagent
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
FRONTEND_URL=http://localhost:3000
ENVIRONMENT=development
OPENAI_API_KEY=your-openai-key
MAX_UPLOAD_SIZE_MB=15
```

### Frontend (`.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=QualityAgent
```

## 🧪 בדיקות

```bash
# Backend tests
cd apps/api
pytest -v

# Frontend tests
cd apps/web
npm test          # הרצה חד-פעמית
npm run test:watch
```

ה-CI (`.github/workflows/ci.yml`) מריץ בכל push ל-`main` וב-PR:
`npm ci` → `type-check` → `vitest` → `next build`, ובמקביל `pytest` על ה-API.

## 📦 בנייה לפרודקשן

```bash
# בניית תמונות Docker
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# הרצה
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 🗺 Roadmap

### הושלם
- [x] בדיקות אוטומטיות (Vitest + pytest) ו-CI ב-GitHub Actions
- [x] מסכי ניהול משתמשים, תפקידים ואתרים
- [x] לוח בקרה, דארק מוד, NCR/CAPA/תלונות/בדיקות/משימות/מסמכים

### הבא בתור
- [ ] העברת אחסון הקבצים ל-S3/R2 (השכבה מוכנה להחלפה בלי שינוי בקוראים)
- [ ] התראות מתמשכות ושליחת אימייל
- [ ] ייצוא PDF/Excel ודוח 8D
- [ ] חיפוש גלובלי ושמירת פילטרים

### AI
- [ ] RAG על מסמכי הארגון
- [ ] ניתוח סיבות שורש (5 Whys מודרך)
- [ ] הצעת פעולות מתקנות מבוססת היסטוריה
- [ ] אינטגרציה עם OpenAI/GPT-4

### פרודקשן
- [ ] Monitoring & Logging (Prometheus, Grafana, ELK)
- [ ] Backup & Disaster Recovery
- [ ] Rate limiting ו-Security Hardening
- [ ] Load Testing

## 🤝 תרומה

1. Fork את הפרויקט
2. צור branch חדש (`git checkout -b feature/amazing-feature`)
3. Commit השינויים (`git commit -m 'Add amazing feature'`)
4. Push ל-branch (`git push origin feature/amazing-feature`)
5. פתח Pull Request

## 📄 רישיון

פרויקט זה מופץ תחת רישיון MIT. ראה `LICENSE` לפרטים נוספים.

## 📞 תמיכה

לשאלות ובעיות:
- פתח Issue ב-GitHub
- אימייל: support@qualityagent.io
- דוקומנטציה: https://docs.qualityagent.io

---

**QualityAgent** - הופך ניהול איכות מחובה להזדמנות 🎯