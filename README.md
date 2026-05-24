# FinishLine — Backend

Fastify + TypeScript API for the FinishLine savings goals app.

## Quick start (full stack via Docker)

```bash
# 1. Clone both repos into the same parent directory
mkdir finishline && cd finishline
git clone https://github.com/Nenavsegda/finishline-backend
git clone https://github.com/Nenavsegda/finishline-frontend

# 2. Set up backend env
cd finishline-backend
cp .env.example .env
# Edit .env — fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET

# 3. Set up frontend env (if needed)
cp ../finishline-frontend/.env.example ../finishline-frontend/.env

# 4. Start everything
docker compose up -d

# 5. Run database migrations (first time only)
# Clone https://github.com/Nenavsegda/finishline-database and follow its README
```

App runs at **http://localhost:3000**

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/google` | Redirect to Google OAuth |
| GET | `/auth/google/callback` | OAuth callback |
| GET | `/auth/me` | Current user |
| POST | `/auth/logout` | Sign out |
| GET | `/goals` | List goals |
| POST | `/goals` | Create goal |
| PUT | `/goals/:id` | Update goal |
| PATCH | `/goals/:id/toggle` | Toggle active/inactive |
| DELETE | `/goals/:id` | Delete goal |
| GET | `/goals/summary` | Daily/weekly/monthly totals |
