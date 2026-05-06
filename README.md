# can-he-shoot

A Next.js app that renders an interactive zone heatmap for active NBA players.
The web app now reads from Supabase tables (`nba_players`, `nba_shots`) while a
Python scraper syncs fresh data from `stats.nba.com`.

## Stack

- Next.js 15 + React 19 + TypeScript
- Supabase (`@supabase/supabase-js`) for server-side reads
- Python scraper (`curl_cffi`, `supabase`)
- Tailwind CSS, D3, cmdk, zod

## Environment variables

Both the app and scraper require:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data sync scraper

The scraper is intentionally stingy toward `stats.nba.com`:

- **`--mode players`**: **1** NBA request (`commonallplayers`)
- **`--mode shots`**: **1** NBA request (`shotchartdetail`, league-wide `PlayerID=0`)
- **`--mode all`**: **2** NBA requests total, with a **random 2–6s** pause between them

There is **no per-player shot loop**, so this will not hammer the API hundreds of times per run. Retries only happen on transient errors (still bounded).

Install Python deps:

```bash
pip install -r scripts/requirements.txt
```

Run modes:

```bash
# Players + shots
python scripts/nba_scraper.py --mode all

# Players only
python scripts/nba_scraper.py --mode players

# Shots only (one league-wide shotchartdetail call; PlayerID=0, TeamID=0)
python scripts/nba_scraper.py --mode shots
```

Other useful flags:

```bash
python scripts/nba_scraper.py --season 2025-26 --season-type "Regular Season"
```

The scraper is idempotent by design: it uses Supabase `upsert` on
`person_id` (`nba_players`) and `shot_id` (`nba_shots`), so reruns update rows
instead of duplicating them.

## GitHub Actions automation

Workflow file: `.github/workflows/nba_sync.yml`

- Triggered by schedule and `workflow_dispatch`
- Shots job runs daily; players job runs weekly (each job makes **exactly 1** NBA request — see scraper section above)
- Manual dispatch runs **both** jobs, often in parallel (two runners ≈ two near-simultaneous NBA calls; use rerun on a single job if you want only one)
- Both jobs read:
  - `secrets.SUPABASE_URL`
  - `secrets.SUPABASE_SERVICE_ROLE_KEY`

## App data flow

```text
Browser -> /api/players          -> Supabase nba_players (revalidate 24h)
Browser -> /api/shots/[playerId] -> Supabase nba_shots   (revalidate 30m)
```
