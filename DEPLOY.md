# העלאה לאוויר — QualityAgent

מדריך מלא להעלאת המערכת לפרודקשן: **פרונט ב־Vercel**, **API + Postgres + Redis ב־Render**.

---

## 1. ארכיטקטורה — מה הולך לאן

| רכיב | טכנולוגיה | איפה | כתובת |
|---|---|---|---|
| פרונט | Next.js 14 (App Router) | **Vercel** | `https://<project>.vercel.app` |
| API | FastAPI (Docker) | **Render** (Web Service) | `https://qualityagent-api.onrender.com` |
| DB | PostgreSQL 16 | **Render Postgres** | פנימי, לא נגיש מהדפדפן |
| Cache | Redis / Key Value | **Render Key Value** | פנימי |

הפרונט מדבר עם ה־API **ישירות** דרך `NEXT_PUBLIC_API_URL` (נצרב בזמן build), ולכן:

1. חובה ש־`ALLOWED_ORIGINS` ב־API יכיל **בדיוק** את דומיין ה־Vercel.
2. כל שינוי ב־`NEXT_PUBLIC_API_URL` מחייב **Redeploy** ב־Vercel (לא מספיק לשמור משתנה).

> ה־API **לא** יכול לרוץ ב־Vercel כמו שהוא: הוא צריך Postgres, Redis ותהליך ארוך־טווח.

---

## 2. דרישות מקדימות

- חשבון GitHub עם הריפו של הפרויקט (הקבצים הבאים חייבים להיות בריפו: `render.yaml`, `apps/api/Dockerfile`, `infra/sql/init.sql`).
- חשבון Render (חינמי).
- חשבון Vercel (יש לך).
- `psql` זמין (או Docker) להרצת סקריפט ה־DB.

> אם עוד אין ריפו: `git init` + `git add .` + דחיפה ל־GitHub. Render ו־Vercel עובדים מ־Git.

---

## 3. שלב א׳ — הקמת הבקאנד ב־Render (Blueprint)

1. היכנס ל־[dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**.
2. חבר את חשבון ה־GitHub ובחר את הריפו של QualityAgent.
3. Render יזהה את `render.yaml` ויציג 3 משאבים:
   - `qualityagent-db` (Postgres, free)
   - `qualityagent-redis` (Key Value, free)
   - `qualityagent-api` (Docker Web Service, free)
4. בלחיצה על **Apply** הוא יבקש ערכים ל־`FRONTEND_URL` ו־`ALLOWED_ORIGINS` (מסומנים `sync: false`).
   **אפשר להשאיר ריק לעכשיו** — נמלא אחרי שיש דומיין Vercel (שלב ד׳).
5. המתן ל־Build (5–10 דקות בפעם הראשונה). ה־healthcheck הוא `/health`.
6. כשהסטטוס **Live**, בדוק:
   ```powershell
   curl https://qualityagent-api.onrender.com/health
   # {"status":"healthy","app":"QualityAgent","version":"0.1.0","environment":"production"}
   ```

ה־Blueprint מגדיר אוטומטית:
- `DATABASE_URL` מה־DB שנוצר (Render מחזיר `postgresql://...` — ה־API מנרמל ל־`postgresql+asyncpg://` אוטומטית).
- `REDIS_URL` מה־Key Value.
- `SECRET_KEY` אקראי חזק (`generateValue`).
- `ENVIRONMENT=production`, `DEBUG=false`.

---

## 4. שלב ב׳ — אתחול סכימת ה־DB + דמו (חד־פעמי!)

ה־API **לא** יוצר טבלאות לבד (`init_db()` intentionally no-op), ולכן חובה להריץ את `infra/sql/init.sql` פעם אחת על ה־DB המאוחסן.

### איך משיגים את הכתובת
Render Dashboard → `qualityagent-db` → **Connections** → **External Database URL** (מתחיל ב־`postgres://`).

### אפשרות 1 — psql מקומי
```powershell
psql "<EXTERNAL_DATABASE_URL>" -v ON_ERROR_STOP=1 -f infra/sql/init.sql
```

### אפשרות 2 — דרך ה־Postgres container הקיים (בלי להתקין psql)
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
docker exec -i qualityagent_postgres psql "<EXTERNAL_DATABASE_URL>" -v ON_ERROR_STOP=1 -f - < infra\sql\init.sql
```

### אפשרות 3 — ספק עם SQL Editor בדפדפן (Neon / Supabase)
החלף את ה־`DATABASE_URL` ב־Render לכתובת של אותו ספק, והרץ את תוכן `infra/sql/init.sql` בעורך ה־SQL.

### מה הסקריפט יוצר
- הרחבות `uuid-ossp`, `pgcrypto`.
- כל ה־enums והטבלאות (organizations, users, products, customers, suppliers, documents, NCR, CAPA, inspections, **complaints** ועוד), אינדקסים, RLS, triggers.
- דאטה דמו: ארגון `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`, משתמש `quality@demo.com` / `demo123`, מוצרים, ספקים, NCR/CAPA, **6 תלונות לקוח**.

> ⚠️ הסקריפט **לא אידמפוטנטי** (`CREATE TYPE` ייכשל בהרצה שנייה). להריץ פעם אחת על DB ריק. אם צריך לאפס — צור DB חדש.

### בדיקה שהדאטה עלה
```powershell
docker exec -i qualityagent_postgres psql "<EXTERNAL_DATABASE_URL>" -c "select count(*) from complaints;"
# 6
```

---

## 5. שלב ג׳ — הפרונט ב־Vercel

1. [vercel.com/new](https://vercel.com/new) → ייבוא הריפו.
2. הגדרות הפרויקט (**קריטי**):
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `apps/web` ← חובה, אחרת ה־build נכשל
   - Build Command: `npm run build` (ברירת מחדל; `apps/web/vercel.json` כבר מגדיר `npm ci`)
   - Install Command: `npm ci`
   - Output Directory: ברירת מחדל (`.next`)
3. **Environment Variables** (Production + Preview):
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://qualityagent-api.onrender.com` (בלי `/api/v1` ובלי `/` בסוף) |
   | `NEXT_PUBLIC_APP_NAME` | `QualityAgent` |
4. **Deploy**. בסיום תקבל `https://<project>.vercel.app`.

> אם ה־API שלך לא על `qualityagent-api.onrender.com` (Render מוסיף סיומת אם השם תפוס) — העתק את הדומיין המדויק מ־Render Dashboard.

---

## 6. שלב ד׳ — חיבור CORS (השלב שנשכח וזה מה ששובר את האפליקציה)

ב־Render → `qualityagent-api` → **Environment**:

| Key | Value |
|---|---|
| `FRONTEND_URL` | `https://<project>.vercel.app` |
| `ALLOWED_ORIGINS` | `https://<project>.vercel.app` |

- אפשר גם רשימה מופרדת בפסיקים: `https://<project>.vercel.app,https://<project>-git-main-<user>.vercel.app`
- או מערך JSON: `["https://<project>.vercel.app"]`
- **בלי** סלאש בסוף, **עם** `https://`.

שמור → Render עושה redeploy אוטומטי. ב־Logs תראה:
```
Allowed CORS origins: ['https://<project>.vercel.app']
```

---

## 7. צ׳ק־ליסט אימות (אחרי שהכל עלה)

```powershell
# 1. API חי
curl https://qualityagent-api.onrender.com/health

# 2. CORS מחזיר את דומיין Vercel
curl -i -X OPTIONS https://qualityagent-api.onrender.com/api/v1/auth/login `
  -H "Origin: https://<project>.vercel.app" `
  -H "Access-Control-Request-Method: POST"
# צריך להחזיר 200 + Access-Control-Allow-Origin: https://<project>.vercel.app

# 3. התחברות דמו
curl -X POST https://qualityagent-api.onrender.com/api/v1/auth/demo-login
```

בדפדפן (על דומיין ה־Vercel):
1. `/login` → כפתור **כניסת הדגמה** עובד.
2. Dashboard נטען עם נתונים (לא מסך ריק).
3. `/complaints` מציג 6 תלונות, KPI למעלה, פילטרים וייצוא CSV.
4. פתיחת תלונה → עדכון סטטוס, שמירת טיפול/ציון שביעות רצון, יצירת NCR.
5. אין שגיאות אדומות ב־Console (F12).

---

## 8. משתני סביבה — טבלת ייחוס

### API (Render)
| משתנה | חובה | דוגמה |
|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql://user:pass@host/db` (מנורמל אוטומטית) |
| `REDIS_URL` | ✅ | `redis://red-xxx:6379` |
| `SECRET_KEY` | ✅ | מחרוזת אקראית 32+ תווים |
| `ENVIRONMENT` | ✅ | `production` |
| `DEBUG` | ✅ | `false` |
| `FRONTEND_URL` | ✅ | `https://app.vercel.app` |
| `ALLOWED_ORIGINS` | ✅ | `https://app.vercel.app` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | — | `60` |
| `DEMO_TENANT_ID` | — | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` |
| `ALLOW_DEMO_LOGIN` | — | `true` (ברירת מחדל). `false` מכבה את `/auth/demo-login` |
| `OPENAI_API_KEY` | — | לסוכן ה־AI (לא חובה להרצה) |

### Web (Vercel)
| משתנה | חובה | דוגמה |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | `https://qualityagent-api.onrender.com` |
| `NEXT_PUBLIC_APP_NAME` | — | `QualityAgent` |

### מודל ההרשאות בפרודקשן

- **כל** נקודות הקצה דורשות `Authorization: Bearer <access_token>` (401 בלעדיו) — הפרונט שולח אותן אוטומטית מה־cookie.
- כניסה למערכת: `quality@demo.com` / `demo123`, או כפתור **כניסת הדגמה** (`POST /api/v1/auth/demo-login`).
- כדי לכבות את כניסת ההדגמה בסביבה ציבורית: `ALLOW_DEMO_LOGIN=false` ואז redeploy ל־API.

---

## 9. בעיות נפוצות

**“Failed to fetch” / “Network Error” בדפדפן**
ה־API למטה או CORS חסום. בדוק `/health` בדפדפן, ואת `ALLOWED_ORIGINS` (חייב להיות זהה לחלוטין לדומיין, כולל `https` וללא `/` בסוף).

**“blocked by CORS policy” ב־Console**
אותו דבר — עדכן `ALLOWED_ORIGINS` ועשה redeploy ל־API.

**`403 Demo mode only available in development`**
לא אמור להופיע יותר: כל נקודות הקצה עובדות לפי המשתמש המחובר, וכניסת ההדגמה נשלטת ב־`ALLOW_DEMO_LOGIN`. אם השתמשת בגרסה ישנה — פרוס מחדש.

**האתר עלה אבל הכל ריק / 401 בלולאה**
`NEXT_PUBLIC_API_URL` שגוי, או שנשמר **אחרי** ה־build. Vercel → Deployments → **Redeploy** (עם “Use existing build cache” כבוי).

**Build ב־Vercel נכשל על `npm ci`**
וודא ש־`apps/web/package-lock.json` בריפו (יש) וש־Root Directory הוא `apps/web`.

**Build של Render נכשל: `Dockerfile not found`**
וודא ש־`dockerfilePath: ./apps/api/Dockerfile` ו־`dockerContext: ./apps/api` ב־`render.yaml` (כבר מוגדר).

**`InvalidPasswordError` / `password authentication failed`**
ה־`DATABASE_URL` הודבק ידנית עם תווים חסרים. העדף את `fromDatabase` ב־Blueprint.

**`ssl` / `channel_binding` / `sslmode`**
הקוד מנרמל: `postgres://` → `postgresql+asyncpg://`, `sslmode=require` → `ssl=require`, ומסיר `channel_binding`. אין צורך לתקן ידנית.

**הבקשה הראשונה איטית (30–60 שניות)**
תוכנית ה־free של Render מכבה את השירות אחרי 15 דקות חוסר פעילות. זה צפוי. לפרודקשן אמיתי — שדרג ל־Starter ($7/חודש) או השאר cron שמבקר ב־`/health`.

**Render free Postgres נמחק אחרי 30 יום**
מגבלה של התוכנית החינמית. לפני שנגמר — שדרג, או עבור ל־Neon (יש free tier קבוע) והחלף רק את `DATABASE_URL`.

---

## 10. חלופה: Railway במקום Render

1. פרויקט חדש → **Deploy from GitHub repo** → בחר את הריפו.
2. **Settings → Root Directory**: `apps/api` (הקובץ `apps/api/railway.json` מגדיר Dockerfile + healthcheck `/health`).
3. הוסף **PostgreSQL** ו־**Redis** מהתבנית (Templates).
4. משתני סביבה: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `REDIS_URL=${{Redis.REDIS_URL}}`, `SECRET_KEY`, `ENVIRONMENT=production`, `DEBUG=false`, `FRONTEND_URL`, `ALLOWED_ORIGINS`.
5. הרץ את `infra/sql/init.sql` מול ה־DB (שלב ב׳).

---

## 11. מה כבר מוכן בריפו

| קובץ | תפקיד |
|---|---|
| `render.yaml` | Blueprint: Postgres + Key Value + Docker API + healthcheck + משתנים |
| `apps/api/Dockerfile` | Container עם `PORT` דינמי ו־proxy headers |
| `apps/api/.dockerignore` | מונע העלאת `.env`, טסטים ו־cache ל־image |
| `apps/api/railway.json` | חלופת Railway |
| `apps/web/vercel.json` | `npm ci` + `next build` |
| `apps/web/.env.production.example` | דוגמת משתני production לפרונט |
| `apps/api/app/core/config.py` | נרמול `DATABASE_URL` + פירסור `ALLOWED_ORIGINS` |
| `apps/api/app/main.py` | CORS, אזהרת `SECRET_KEY` בפרודקשן, `/health` |
| `apps/api/app/api/dependencies.py` | הרשאות לפי המשתמש המחובר (`get_current_tenant`) + מתג `ALLOW_DEMO_LOGIN` |
| `infra/sql/init.sql` | סכימה מלאה + דאטה דמו (כולל תלונות) |

---

## 12. מה נשאר לך לעשות (השלבים היחידים שלא ניתן לעשות מהמחשב הזה)

1. לדחוף את הקוד ל־GitHub.
2. ליצור Blueprint ב־Render (שלב א׳) ולהריץ את `init.sql` (שלב ב׳).
3. לייבא את הפרויקט ב־Vercel עם `Root Directory = apps/web` ו־`NEXT_PUBLIC_API_URL` (שלב ג׳).
4. לעדכן `FRONTEND_URL` + `ALLOWED_ORIGINS` לדומיין ה־Vercel (שלב ד׳).

ברגע שיהיו לי שני הדומיינים (Vercel + Render) — אפשר להריץ את כל הבדיקות בסעיף 7 ולסגור.

---

## 13. מסלול מהיר בלי Git (CLI)

במחשב הזה **אין Git מותקן**, ולכן שתי אפשרויות:

### א. להתקין Git (מומלץ — נותן auto-deploy אוטומטי)
```powershell
winget install --id Git.Git -e --source winget
```
ואז: `git init` → `git add .` → `git commit -m "deploy"` → יצירת ריפו ב־GitHub → `git remote add origin ...` → `git push -u origin main`.
משם ממשיכים לשלבים א׳–ד׳ כרגיל (Render ו־Vercel יודעים לקרוא מהריפו).

### ב. בלי Git בכלל — Vercel CLI + Railway CLI
**פרונט (Vercel):**
```powershell
cd apps\web
npx vercel login          # פותח דפדפן לאישור
npx vercel --prod         # פותח פרויקט ומעלה
```
אחרי ה־deploy, הוסף את המשתנה דרך הדשבורד (Project → Settings → Environment Variables):
`NEXT_PUBLIC_API_URL = https://<api-domain>` ואז **Redeploy** (חשוב — נצרב ב־build).

**בקאנד (Railway — לא דורש Git):**
```powershell
npm i -g @railway/cli
railway login
cd apps\api
railway init
railway add            # בחר PostgreSQL ואז Redis
railway up             # מעלה את apps/api/Dockerfile
railway variables --set "ENVIRONMENT=production" --set "DEBUG=false" --set "ALLOW_DEMO_LOGIN=true"
```
ואז ב־Railway Dashboard: חבר `DATABASE_URL`/`REDIS_URL` ל־Postgres/Redis, הוסף `SECRET_KEY`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, והרץ את `infra/sql/init.sql` (שלב ב׳).

> שים לב: Render Blueprint **דורש** ריפו Git. בלי Git — לך על Railway (או התקן Git).
