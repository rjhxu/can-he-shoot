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

**Supabase (Dashboard → SQL Editor):** before using the anon key in the app, enable RLS and allow read access for `anon` / `authenticated`:

```sql
alter table public.nba_players enable row level security;
alter table public.nba_shots enable row level security;

drop policy if exists "Public read nba_players" on public.nba_players;
drop policy if exists "Public read nba_shots" on public.nba_shots;

create policy "Public read nba_players"
  on public.nba_players for select
  to anon, authenticated
  using (true);

create policy "Public read nba_shots"
  on public.nba_shots for select
  to anon, authenticated
  using (true);
```

**Next.js app** (Vercel + local): server-side reads only; uses the **anon** key under Row Level Security.

```bash
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

**Python scraper** (when you run sync jobs yourself): bulk upserts bypass RLS, so keep **service role** off the web deployment and use it only for the scraper (never expose it to the browser or Vercel).

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Vercel

1. Add `SUPABASE_ANON_KEY` (same value as **Project Settings → API → anon public**).
2. Remove `SUPABASE_SERVICE_ROLE_KEY` from the project if it was only used for this app.
3. Redeploy so serverless env picks up changes.

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

Each shot row carries `season_type` (`Regular Season` or `Playoffs`). Before syncing, ensure the column exists in Supabase (run once in the SQL editor):

```sql
alter table nba_shots
  add column if not exists season_type text not null default 'Regular Season';

create index if not exists idx_nba_shots_person_id_season_type
  on nba_shots (person_id, season_type);
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
instead of duplicating them. Schedule it with cron or another job runner if you want automated syncs; it needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment.

## App data flow

```text
Browser -> /api/players          -> Supabase nba_players (revalidate 24h)
Browser -> /api/shots/[playerId] -> Supabase nba_shots   (revalidate 30m)
```

`/api/shots/[playerId]` paginates Supabase reads in 1000-row chunks so players with more than 1000 attempts still return full shot totals.
