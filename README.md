# can-he-shoot

A Next.js app that renders interactive NBA shot maps for active players. The app
reads from Supabase tables (`nba_players`, `nba_shots`) while a Python scraper
syncs fresh data from `stats.nba.com`.

## What the app shows

- Player search across active NBA players
- Season-type filter (`Regular Season` / `Playoffs`)
- Map-mode toggle:
  - **Heatmap**: zone-level FG% vs league average coloring
  - **Shot Chart**: hexbin density view over the same half-court geometry
- Shot-chart result filter (`Makes` / `Misses`) shown next to the shot-chart legend
- Zone/hex hover tooltips and a right-side summary panel with shooting totals

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

If localhost cannot read Supabase but deployment works, verify your terminal is
not overriding `.env` with stale exported `SUPABASE_*` variables.

## Data sync scraper

NBA request profile by mode:

- **`--mode players`**: **1** NBA request (`commonallplayers`)
- **`--mode shots`**: **1** NBA request (`shotchartdetail`, league-wide `PlayerID=0`; `--season-type` chooses RS vs PO)
- **`--mode all`**: **5** NBA requests (players + three Regular Season windows + Playoffs)
  - Regular Season window 1: Oct-Dec
  - Regular Season window 2: Jan-Feb
  - Regular Season window 3: Mar-Apr
  - Playoffs: full playoffs query

The scraper waits **2–6s** between NBA requests and retries transient errors with bounded backoff.
There is **no per-player shot loop**.

League-wide shot rows are **filtered** to `person_id`s that exist in `nba_players` before upsert, so inserts respect a foreign key from `nba_shots` → `nba_players` (some chart rows are for players not on the synced active roster).

Each shot row carries `season_type` (`Regular Season` or `Playoffs`). Before syncing, ensure the column exists in Supabase:

```bash
# Paste scripts/sql/add_nba_shots_season_type.sql into the Supabase SQL editor
```

Regular-season `shot_id` values stay compatible with older rows; playoffs use a `po_…` prefix on `shot_id` so playoffs don’t collide with regular season.

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

# Shots only (one NBA call per invocation; defaults to Regular Season)
python scripts/nba_scraper.py --mode shots
python scripts/nba_scraper.py --mode shots --season-type Playoffs
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
- Shots job runs daily: **regular season** then **playoffs** (**2** sequential NBA requests on the runner)
- Players job runs weekly (**1** NBA request)
- `workflow_dispatch` can run both jobs in the same workflow run (players and shots are separate jobs)
- Both jobs read:
  - `secrets.SUPABASE_URL`
  - `secrets.SUPABASE_SERVICE_ROLE_KEY`

## App data flow

```text
Browser -> /api/players          -> Supabase nba_players (revalidate 24h)
Browser -> /api/shots/[playerId] -> Supabase nba_shots   (revalidate 30m)
```
