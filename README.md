# Prodocu

Turn a GitHub repo (or a project zip) into professional documentation — tech stack detection, architecture write-up, Mermaid diagrams, thesis-style analysis, and downloadable Markdown / PDF / Word files — powered by Prodocu.

## Stack

- **Frontend:** Next.js 14 (App Router, TypeScript, Tailwind CSS) — deploys to **Vercel**
- **Backend:** Express + TypeScript (runs on port 4000) — deploys separately (Render, Railway, Fly.io, or as Vercel serverless functions)
- **Auth:** JWT-based (signed tokens in httpOnly cookies, bcrypt-hashed passwords)
- **Database:** SQLite (development) / PostgreSQL (production) via Prisma
- **AI:** OpenRouter API with structured JSON output (`json_schema`) for reliable parsing
- **Ingestion:** GitHub tarball download (no `git` binary needed) or zip upload, walked and filtered to a token-budget-aware file set
- **Diagrams:** Prodocu generates Mermaid syntax; rendered to PNG/SVG via the public `mermaid.ink` service (swappable for local `mermaid-cli` if you need an offline/air-gapped setup)
- **Exports:** Markdown (native), PDF (`md-to-pdf` / Puppeteer), Word (`docx` package, built programmatically with embedded diagram images)
- **Storage:** Temporary ZIP uploads stored on the local filesystem (`os.tmpdir()`) — swap to S3/Blob for multi-instance production

## How it works

1. User signs up / signs in.
2. User submits a public GitHub URL or uploads a `.zip`.
3. The `analyze` route ingests the source (download+extract or unzip), walks the file tree, and selects a capped set of high-signal files (manifests, configs, source files) within a size budget.
4. **Four sequential AI analysis calls:**
   - **Tech stack detection** → languages, frameworks, databases, build/test tools, architecture pattern
   - **Documentation generation** → overview, architecture, folder structure, setup instructions, key modules, API endpoints, data models, deployment notes
   - **Diagram generation** → 2-4 Mermaid diagrams chosen based on what's actually in the project (architecture, sequence, ER, class)
   - **Thesis analysis** → formal academic-style write-up with abstract, theoretical background, design rationale, known issues, future work, and references
5. Results are stored as JSON in the `Project` row. The frontend polls `GET /api/projects/:id` until `status` is `completed` or `failed`.
6. `GET /api/projects/:id/export?format=md|pdf|docx` builds the requested file on demand from the stored JSON.

## Prerequisites

- **Node.js** v18+ (v20 recommended)
- **npm** v9+
- An [OpenRouter API key](https://openrouter.ai/keys) (free tier available)

## Quick start

### 1. Clone and install

```bash
git clone <repo-url> prodocu
cd prodocu
npm install
```

This installs dependencies for the root, `backend/`, and `frontend/` via npm workspaces.

### 2. Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill in at least:

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | ✅ | Get one at [openrouter.ai/keys](https://openrouter.ai/keys) |
| `JWT_SECRET` | ✅ | Generate with `openssl rand -base64 32` |
| `DATABASE_URL` | ✅ | For local dev with SQLite: `file:./dev.db` (default — no setup needed) |

### 3. Push the Prisma schema

```bash
npm run db:push
```

This creates the SQLite database file (`backend/dev.db`) and generates the Prisma client.

### 4. Start the dev servers

```bash
npm run dev
```

This starts both servers concurrently:

| Service | URL |
|---|---|
| **Frontend** (Next.js) | [http://localhost:3000](http://localhost:3000) |
| **Backend** (Express API) | [http://localhost:4000](http://localhost:4000) |

Open [http://localhost:3000](http://localhost:3000), sign up, and you're ready to go.

### 5. Verify the backend is running

```bash
curl http://localhost:4000/api/health
# → {"status":"ok","timestamp":"2026-07-22T..."}
```

## Project structure

```
prodocu/
├── backend/                        # Express API server (port 4000)
│   ├── prisma/
│   │   └── schema.prisma           # User & Project models
│   ├── src/
│   │   ├── index.ts                # Express app entry
│   │   ├── routes/
│   │   │   ├── auth.ts             # Signup, signin, signout
│   │   │   ├── projects.ts         # CRUD + zip upload
│   │   │   ├── analyze.ts          # Ingest → AI pipeline
│   │   │   └── export.ts           # Download md/pdf/docx
│   │   └── lib/
│   │       ├── auth.ts             # JWT sign/verify + bcrypt
│   │       ├── prisma.ts           # Prisma client singleton
│   │       ├── ingest.ts           # GitHub tarball / zip parsing
│   │       ├── openrouter.ts       # OpenRouter prompts + schemas
│   │       ├── renderDiagram.ts    # Mermaid → PNG/SVG via mermaid.ink
│   │       ├── buildMarkdown.ts    # Canonical markdown builder
│   │       └── exporters/
│   │           ├── markdown.ts
│   │           ├── pdf.ts
│   │           └── docx.ts
│   │── .env.example                # Env var template (copy to .env)
│   └── package.json
│
├── frontend/                       # Next.js UI (port 3000)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── signin/page.tsx
│   │   │   │   └── signup/page.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx        # Project list
│   │   │   │   ├── new/page.tsx    # Create new project
│   │   │   │   └── [id]/page.tsx   # View project docs
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx            # Landing page
│   │   └── components/
│   │       ├── Navbar.tsx
│   │       └── StatusBadge.tsx
│   └── package.json
│
├── vercel.json                     # Vercel monorepo config (points to frontend/)
├── package.json                    # Root: workspaces + scripts
└── README.md
```

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start both frontend and backend in dev mode (with hot reload) |
| `npm run build` | Build backend (tsc) + frontend (next build) |
| `npm run start` | Start the production backend server |
| `npm run db:push` | Push Prisma schema to the database |
| `npm run db:studio` | Open Prisma Studio (GUI db browser) |

You can also run workspace-specific scripts:

```bash
npm run dev -w backend        # Backend only (port 4000)
npm run dev -w frontend       # Frontend only (port 3000)
npm run db:push -w backend    # DB migration
```

## Getting an OpenRouter API key

1. Go to [https://openrouter.ai/keys](https://openrouter.ai/keys)
2. Sign up or log in
3. Create an API key (free tier works fine)
4. Add it to `backend/.env` as `OPENROUTER_API_KEY=your-key-here`

To change the AI model, set `OPENROUTER_MODEL` in `backend/.env`. Options include:

- `openai/gpt-4o` (default — good balance of quality/speed)
- `anthropic/claude-sonnet-4` (strong reasoning)
- `google/gemini-2.0-flash` (fast, lightweight)

## Production notes

- **Background jobs:** `POST /api/projects/:id/analyze` kicks off the pipeline without awaiting it, so the request returns immediately and the client polls for status. This works fine on a long-running Node server. On serverless platforms (e.g. Vercel) with strict execution timeouts, move `runPipeline` into a proper queue/worker (e.g. a Vercel Background Function, Inngest, or a small worker process reading from a queue) so it isn't killed mid-analysis.
- **File size limits:** `MAX_ZIP_SIZE_MB` (default 50MB) and per-project file/byte caps in `backend/src/lib/ingest.ts` keep prompts within the AI's context window and control API cost — tune for your repos.
- **Diagram rendering dependency:** diagrams are rendered via the public `mermaid.ink` service both in the browser and when building PDF/DOCX exports. For air-gapped or high-volume deployments, replace `backend/src/lib/renderDiagram.ts` with a local `mermaid-cli` (`mmdc`) call.
- **Database:** SQLite is fine for local dev/small single-instance deployments. For multi-instance production, point `DATABASE_URL` at Postgres/MySQL and rerun `npx prisma migrate deploy`.
- **Secrets:** never commit `.env`. Generate `JWT_SECRET` with `openssl rand -base64 32`.
- **Temporary ZIP storage:** Uploaded ZIP files are stored in the OS temp directory (`os.tmpdir()`). On multi-instance deployments, swap `backend/src/lib/tempZipStore.ts` to use a shared storage backend like S3 or a database Blob field.

---

# Vercel Deployment Guide

Prodocu is designed for a two-part deployment:

1. **Frontend** — Next.js app deployed to **Vercel** (free tier available)
2. **Backend** — Express API deployed separately on a persistent platform (Render, Railway, Fly.io, or as Vercel serverless functions)

## Architecture

```
User → Vercel (Next.js) ──rewrite──→ Backend API (Render / Railway / Fly.io)
                                         ↓
                                    PostgreSQL
                                         ↓
                               Local filesystem (temp ZIPs)
```

- **Frontend:** Next.js 14 on Vercel — static + serverless edge rendering
- **Backend:** Express API on a persistent Node hosting platform
- **Database:** PostgreSQL via Prisma (production), SQLite (local dev)
- **Storage:** Temp ZIP files on local filesystem — swap to S3/Blob for multi-instance
- **API routing:** Vercel rewrites proxy `/api/*` requests to the backend via `BACKEND_URL` env var

## Option 1: Deploy frontend to Vercel + backend to Render

### 1. Deploy the backend to Render

[Render](https://render.com) has a generous free tier and supports long-running Node services (required for the analysis pipeline).

1. Push your repo to GitHub
2. In Render Dashboard → **New +** → **Web Service**
3. Connect your repo
4. Configure:
   - **Name:** `prodocu-backend`
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npx prisma generate && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free (or Starter for $7/mo — no spin-down)
5. Add environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string (use Render's own PostgreSQL or [Neon](https://neon.tech) for serverless Postgres) |
| `OPENROUTER_API_KEY` | From [openrouter.ai/keys](https://openrouter.ai/keys) |
| `JWT_SECRET` | `openssl rand -base64 32` |
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `FRONTEND_URL` | Your Vercel app URL (set after step 2) |

6. Deploy. Note your backend URL: `https://prodocu-backend.onrender.com`

### 2. Deploy the frontend to Vercel

1. In [Vercel Dashboard](https://vercel.com) → **Add New** → **Project**
2. Import your GitHub repo
3. Configure:
   - **Framework Preset:** Next.js (auto-detected via `vercel.json`)
   - **Root Directory:** `frontend` (leave blank — `vercel.json` handles this)
   - **Build Command:** auto-detected from `vercel.json`
   - **Output Directory:** auto-detected from `vercel.json`
4. Add environment variable:

| Variable | Value |
|---|---|
| `BACKEND_URL` | `https://prodocu-backend.onrender.com` (from step 1) |

5. **Deploy.** Vercel detects Next.js from the root `vercel.json`, builds the frontend, and the `BACKEND_URL` env var enables the production rewrites so `/api/*` calls are proxied to your backend.

6. Once deployed, update the backend's `FRONTEND_URL` env var to your Vercel URL (e.g. `https://prodocu.vercel.app`).

> ⚠️ **Render free tier spins down after inactivity** (first request after idle has a ~30s cold start). Upgrade to the Starter plan ($7/mo) for always-on or use [Fly.io](https://fly.io) (free tier with always-on compute).

## Option 2: Deploy both frontend and backend to Vercel (serverless functions)

For a single-provider deployment, convert the Express backend to Vercel serverless functions:

1. Create `backend/api/index.ts` as a serverless entry point:

```ts
import app from "../src/index";
export default app;
```

2. Add a `vercel.json` in `backend/`:

```json
{
  "functions": {
    "api/index.ts": {
      "memory": 512,
      "maxDuration": 300
    }
  }
}
```

3. The root `vercel.json` already handles the monorepo. Update the rewrites to route `/api/*` from the frontend to the backend functions.

> ⚠️ **Limitation:** Vercel serverless functions have a 60s execution timeout (300s on Pro). The AI analysis pipeline can exceed this. Use Vercel Background Functions or a queue-based worker for long-running analysis.

## Setting up PostgreSQL

For production, you'll need a PostgreSQL database:

- **[Neon](https://neon.tech)** — Serverless Postgres with a generous free tier (3GB storage, always-on). Recommended for Vercel deployments.
- **[Render PostgreSQL](https://render.com/docs/databases)** — Free tier (1GB storage), spins down after inactivity.
- **[Supabase](https://supabase.com)** — 500MB free tier with connection pooling.

Set the `DATABASE_URL` env var on your backend to the connection string:

```
postgresql://user:password@host:5432/dbname?sslmode=require
```

Then run migrations:

```bash
# From your backend directory:
npx prisma migrate deploy
```

> 💡 For local development, SQLite is the default (`file:./dev.db`) — no setup required.

## Environment variables summary

### Backend

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (or `file:./dev.db` for local SQLite) |
| `OPENROUTER_API_KEY` | ✅ | From [openrouter.ai/keys](https://openrouter.ai/keys) |
| `JWT_SECRET` | ✅ | `openssl rand -base64 32` |
| `NODE_ENV` | | `production` in production |
| `PORT` | | Backend port (default `4000`) |
| `FRONTEND_URL` | ✅ | Your Vercel frontend URL (for CORS) |
| `MAX_ZIP_SIZE_MB` | | ZIP upload limit (default `50`) |

### Frontend (in Vercel project settings)

| Variable | Required | Description |
|---|---|---|
| `BACKEND_URL` | ✅ | Your deployed backend URL (e.g. `https://prodocu-backend.onrender.com`) |

## Project structure

```
prodocu/
├── vercel.json              # Vercel monorepo config (points to frontend/)
├── backend/                 # Express API server (deployed separately)
│   ├── prisma/
│   │   └── schema.prisma    # User & Project models
│   ├── src/
│   │   ├── index.ts         # Express app entry
│   │   └── ...
│   └── package.json
├── frontend/                # Next.js UI (deployed to Vercel)
│   └── package.json
└── README.md
```

## Updating after code changes

```bash
# Push code changes to your Git repository
# Both Vercel and Render automatically redeploy on push to the connected branch.

# To manually run database migrations after backend deploys:
npx prisma migrate deploy
```

## Cost comparison (2026)

| Platform | Configuration | Monthly Cost |
|---|---|---|
| Vercel (frontend) | Free tier — 100GB bandwidth, 6000 build mins | **$0** |
| Render (backend) | Free tier — spins down after inactivity | **$0** |
| Render (backend) | Starter — always-on, no cold starts | **$7/mo** |
| Neon (PostgreSQL) | Free tier — 3GB storage, always-on | **$0** |
| **Total (free tier)** | | **$0/mo** |
| **Total (always-on)** | | **~$7/mo** |

> 💡 **Free tier caveat:** Render's free plan spins down after 15 mins of inactivity. The first request after idle has a ~30s cold start. Upgrade to the Starter plan ($7/mo) for instant responses or use Fly.io's always-on free tier.

## Troubleshooting

### 404 on API calls after deployment

- Verify `BACKEND_URL` is set in Vercel project environment variables.
- Check the backend is running and `FRONTEND_URL` matches your Vercel domain.
- Ensure CORS is configured: the backend's `FRONTEND_URL` env var controls the `cors` origin.

### Backend crashes or times out during analysis

- The analysis pipeline runs synchronously. On platforms with request timeouts (e.g. Render free tier: 30s), this may fail. Upgrade to a plan without timeouts or implement a queue-based worker.
- Check the OpenRouter API key is valid and the model hasn't been rate-limited.

### Prisma client not found

```bash
# In the backend deployment, ensure postinstall runs:
npx prisma generate
```
- Render: the build command should include `npx prisma generate`.
- Vercel: if using serverless functions, add `"postinstall": "prisma generate"` to `backend/package.json`.

### ZIP upload fails in production

- The temp ZIP store uses the local filesystem. On multi-instance deployments, one instance may upload a ZIP but another instance's analysis job won't find it. Swap `tempZipStore.ts` to use a shared store (S3, database Blob, etc.) for multi-instance setups.
