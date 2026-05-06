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

# Shots only
python scripts/nba_scraper.py --mode shots
```

Other useful flags:

```bash
python scripts/nba_scraper.py --season 2025-26 --season-type "Regular Season"
python scripts/nba_scraper.py --player-ids 2544,201939 --max-players 2
```

The scraper is idempotent by design: it uses Supabase `upsert` on
`person_id` (`nba_players`) and `shot_id` (`nba_shots`), so reruns update rows
instead of duplicating them.

## GitHub Actions automation

Workflow file: `.github/workflows/nba_sync.yml`

- Triggered by schedule and `workflow_dispatch`
- Shots job runs on every trigger
- Players job runs once daily (and also on manual dispatch)
- Both jobs read:
  - `secrets.SUPABASE_URL`
  - `secrets.SUPABASE_SERVICE_ROLE_KEY`

## App data flow

```text
Browser -> /api/players          -> Supabase nba_players (revalidate 24h)
Browser -> /api/shots/[playerId] -> Supabase nba_shots   (revalidate 30m)
```
