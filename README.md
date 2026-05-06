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
- **`--mode shots`**: **1** NBA request (`shotchartdetail`, league-wide `PlayerID=0`; `--season-type` chooses RS vs PO)
- **`--mode all`**: **3** NBA requests (roster, then RS chart, then PO chart — **2–6s** jitter between successive calls)

There is **no per-player shot loop**, so this will not hammer the API hundreds of times per run. Retries only happen on transient errors (still bounded).

League-wide shot rows are **filtered** to `person_id`s that exist in `nba_players` before upsert, so inserts respect a foreign key from `nba_shots` → `nba_players` (some chart rows are for players not on the synced active roster).

Each shot row carries `season_type` (`Regular Season` or `Playoffs`). **Before syncing**, ensure the column exists in Supabase:

```bash
# Or paste scripts/sql/add_nba_shots_season_type.sql into the Supabase SQL editor
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
- Manual dispatch starts both jobs **in parallel** (players runner + shots runner ≈ simultaneous hits to `stats.nba.com`; the shots runner still does RS then PO sequentially)
- Both jobs read:
  - `secrets.SUPABASE_URL`
  - `secrets.SUPABASE_SERVICE_ROLE_KEY`

## App data flow

```text
Browser -> /api/players          -> Supabase nba_players (revalidate 24h)
Browser -> /api/shots/[playerId] -> Supabase nba_shots   (revalidate 30m)
```
