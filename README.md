# Sales Intelligence CRM — Backend API

Node.js + Express + PostgreSQL REST API.

---

## Local Development

```bash
# 1. Install
npm install

# 2. Create .env (copy from .env.example)
cp .env.example .env
# Edit .env → set DATABASE_URL and JWT_SECRET

# 3. Run migrations (creates all 21 tables)
npm run migrate

# 4. Seed with sample data
npm run seed

# 5. Start dev server
npm run dev
```

Server starts at: `http://localhost:3000`
Health check: `http://localhost:3000/health`

---

## Deploy to Render (Recommended — Free Tier)

1. Push this folder to a **GitHub repo**
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Render will auto-detect `render.yaml` and create:
   - A **Web Service** (Node.js API)
   - A **PostgreSQL database** (free tier)
5. After deploy, run migrations + seed via Render Shell:
   ```bash
   npm run migrate
   npm run seed
   ```
6. Copy your Render URL → set as `EXPO_PUBLIC_API_URL` in your mobile app

---

## Deploy to Railway

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add a **PostgreSQL** plugin
4. Railway auto-sets `DATABASE_URL`
5. Add env var: `JWT_SECRET=your-secret-key`
6. In Railway Shell:
   ```bash
   npm run migrate && npm run seed
   ```

---

## API Endpoints

Base URL: `https://your-api.com/api/v1`

All protected routes require: `Authorization: Bearer <token>`

### Auth
| Method | Endpoint | Body | Auth |
|--------|----------|------|------|
| POST | `/auth/login` | `{ phone_number, password }` | ❌ |
| POST | `/auth/logout` | — | ✅ |
| GET | `/auth/me` | — | ✅ |

### Managers
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/managers` | ✅ |
| GET | `/managers/leaderboard?period=Yesterday` | ✅ |
| GET | `/managers/performance?period=Yesterday` | ✅ |
| GET | `/managers/:id` | ✅ |
| POST | `/managers` | ✅ Admin |
| PUT | `/managers/:id` | ✅ Admin |

### Meetings
| Method | Endpoint |
|--------|----------|
| GET | `/meetings?period=Yesterday&managerId=2` |
| GET | `/meetings/summary?period=Yesterday` |
| GET | `/meetings/:id` |
| GET | `/meetings/:id/analysis` |
| GET | `/meetings/:id/transcript` |
| GET | `/meetings/reports/activity?period=This Month` |
| GET | `/meetings/reports/quality` |

### Leads
| Method | Endpoint |
|--------|----------|
| GET | `/leads?managerId=2&status=Hot Interested&search=amit` |
| GET | `/leads/status-distribution?managerId=2` |
| GET | `/leads/:id` |
| POST | `/leads` |
| PUT | `/leads/:id` |
| PATCH | `/leads/:id/status` |
| POST | `/leads/:id/reassign` |
| GET | `/leads/:id/preferences` |
| GET | `/leads/:id/status-history` |
| GET | `/leads/:id/objections` |

### Follow-ups
| Method | Endpoint |
|--------|----------|
| GET | `/followups?manager_id=2&status=Pending` |
| GET | `/followups/summary?manager_id=2` |
| POST | `/followups` |
| PATCH | `/followups/:id/done` |

### Pipeline
| Method | Endpoint |
|--------|----------|
| GET | `/pipeline/snapshot` |
| GET | `/pipeline/leads?tab=stuck_7d&managerId=2` |
| GET | `/pipeline/projects` |

### Reports
| Method | Endpoint |
|--------|----------|
| GET | `/reports/activity` |
| GET | `/reports/daily-trend` |
| GET | `/reports/meeting-quality` |
| GET | `/reports/conversion` |
| GET | `/reports/pipeline` |
| GET | `/reports/lead-intelligence` |
| GET | `/reports/objections` |
| GET | `/reports/manager-performance` |
| GET | `/reports/revenue` |

### Alerts
| Method | Endpoint |
|--------|----------|
| GET | `/alerts` |
| PATCH | `/alerts/:id/resolve` |

---

## Filter Query Params (all list endpoints)

| Param | Values | Default |
|-------|--------|---------|
| `period` | `Today`, `Yesterday`, `This Week`, `This Month`, `Last Month` | `This Month` |
| `managerId` | manager ID or `all` | `all` |
| `projectId` | project ID or `all` | `all` |
| `dateFrom` | `YYYY-MM-DD` | auto from period |
| `dateTo` | `YYYY-MM-DD` | auto from period |

---

## Seed Credentials

| Name | Phone | Password | Role |
|------|-------|----------|------|
| Admin | +919000000000 | admin123 | Admin |
| Rahul Kumar | +919876543210 | password123 | Sales Manager |
| Priya Sharma | +919876543211 | password123 | Sales Manager |
| Amit Verma | +919876543212 | password123 | Sales Manager |
| Neha Joshi | +919876543213 | password123 | Sales Manager |

---

## Project Structure

```
src/
├── index.js              # Express app + server
├── db/
│   ├── index.js          # pg Pool connection
│   ├── migrate.js        # Creates all 21 tables
│   └── seed.js           # Realistic sample data
├── middleware/
│   └── auth.js           # JWT verify, adminOnly guard
├── routes/
│   ├── auth.js           # Login, logout, me
│   ├── managers.js       # CRUD + leaderboard + performance
│   ├── meetings.js       # List, detail, analysis, reports
│   ├── leads.js          # CRUD + status + reassign + preferences
│   ├── followups.js      # List, create, mark done
│   ├── pipeline.js       # Snapshot, leads, projects
│   ├── reports.js        # All 8 report categories
│   └── alerts.js         # List, resolve
└── utils/
    └── filters.js        # Parse period/date query params
```
