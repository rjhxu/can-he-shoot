# Can He Shoot?

**Ask NBA shooting questions in plain English. Get answers backed by real data — then jump to interactive shot charts.**

![Next.js](https://img.shields.io/badge/Next.js_15-000000?style=flat-square&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React_19-149ECA?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Cohere](https://img.shields.io/badge/LLM-Cohere-39D2C0?style=flat-square)
![Python](https://img.shields.io/badge/Python-Data_Pipeline-3776AB?style=flat-square&logo=python&logoColor=white)
![D3.js](https://img.shields.io/badge/D3.js-Visualization-F9A03C?style=flat-square&logo=d3.js&logoColor=white)
![Vitest](https://img.shields.io/badge/Tests-Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)

---

## What it is

A full-stack NBA analytics app with two main experiences:

1. **Ask** — type a question like *"What was Steph Curry's corner 3PT%?"* and get a natural-language answer sourced from a Postgres database.
2. **Shot maps** — explore any active player's heatmaps, hexbin shot charts, and season box scores.

Built as a portfolio project demonstrating **LLM integration**, **text-to-SQL**, **data visualization**, and **production-minded API design** (validation, rate limiting, read-only database access).

---

## Highlights

| | |
|---|---|
| **Text-to-SQL pipeline** | Cohere converts natural language → validated `SELECT` queries against a real NBA schema |
| **Safe LLM usage** | Query allowlists, keyword guards, read-only Postgres role, opponent-question detection to prevent hallucinated stats |
| **Interactive viz** | D3-powered heatmaps and hexbin charts with league-average comparisons and zone-level stats |
| **Full-stack Next.js** | App Router, server-side data fetching, REST API routes, responsive UI with light/dark theme |
| **Data pipeline** | Python scraper ingests players, shot locations, and season stats from `stats.nba.com` into Supabase |
| **Tested & CI** | 76+ Vitest unit/integration tests; GitHub Actions runs lint, typecheck, and tests on every PR |

---

## Tech stack

| Layer | Tools |
|-------|-------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS, D3.js, next-themes |
| **Backend / API** | Next.js Route Handlers, Zod validation, in-memory rate limiting |
| **AI** | Cohere API — structured JSON output for SQL generation and answer summarization |
| **Database** | Supabase (PostgreSQL) — RLS policies, dedicated `ask_readonly` role for Ask queries |
| **Data ingestion** | Python scraper → Supabase (`nba_players`, `nba_shots`, `nba_player_stats`) |
| **Quality** | Vitest, ESLint, TypeScript strict mode, GitHub Actions CI |

---

## How it works

```mermaid
flowchart LR
  subgraph client [Browser]
    Ask[Ask page]
    Stats[Shot maps]
  end

  subgraph next [Next.js App]
    API["/api/ask"]
    Shots["/api/shots"]
    StatsAPI["/api/stats"]
  end

  subgraph external [Services]
    Cohere[Cohere LLM]
    PG[(PostgreSQL / Supabase)]
  end

  Scraper[Python scraper] --> PG
  Ask --> API
  Stats --> Shots & StatsAPI
  API --> Cohere
  API --> PG
  Shots --> PG
  StatsAPI --> PG
```

**Ask flow (simplified):** question → LLM generates SQL → server validates and resolves player names → query runs on a read-only DB role → LLM summarizes results → UI renders enriched answer with links to shot charts.

**Shot maps:** select a player → fetch shot coordinates and season stats from Supabase → render zone heatmaps or hexbin density charts with regular season / playoff toggle.

---

## Features

- Natural-language Q&A over shooting and season stats (StatMuse-style)
- Player search across the active NBA roster
- Zone heatmaps comparing a player to league averages
- Hexbin shot charts with make/miss filtering
- Per-game season stats sidebar (PTS, REB, AST, shooting splits)
- Deep links from Ask answers to individual player shot charts
- Light / dark mode

---

## For developers

### Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase, Cohere, and readonly DB credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Server-side Supabase reads |
| `COHERE_API_KEY` | Ask SQL generation and answer summarization |
| `ASK_READONLY_DATABASE_URL` | Pooled Postgres connection for Ask queries |
| `SUPABASE_SERVICE_ROLE_KEY` | Scraper only — never expose to the frontend |

Run [`scripts/ask_readonly_setup.sql`](scripts/ask_readonly_setup.sql) in Supabase before enabling Ask.

### Data ingestion

```bash
pip install -r scripts/requirements.txt
python scripts/nba_scraper.py --mode all
```

Modes: `players`, `shots`, `stats`. See the script for season-type flags.

### Development commands

```bash
npm run lint
npm run typecheck
npm run test:ci
```

### API routes

| Route | Description |
|-------|-------------|
| `POST /api/ask` | Natural-language query |
| `GET /api/shots/[playerId]?seasonType=` | Shot locations and zone aggregates |
| `GET /api/stats/[playerId]?seasonType=` | Per-game season stats |

Player lists are fetched server-side on stats pages — there is no `/api/players` route.

### Project structure (selected)

```
app/           Next.js pages and API routes
components/    Ask UI, shot charts, player search
lib/cohere/    LLM prompts and client
lib/sql/       Query validation, player filter rewriting
lib/nba/       Data access, court geometry, types
lib/ask/       Unsupported-question detection
scripts/       Python scraper and DB setup SQL
tests/         Vitest unit and integration tests
```

### Known limitations

- Data is scraped periodically, not live at request time
- No opponent/matchup stats (not in the source schema)
- Ask SQL validation is regex-based; rate limiting is in-memory per IP
- Single season (`2025-26`) unless the scraper is run for another year
