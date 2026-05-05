# can-he-shoot

A Next.js app that renders an interactive zone heatmap for every active NBA
player's 2025-26 shooting. Search any active player, get the half-court chart
with FG% and attempts colored against the league average for that zone.

Data comes from the same `stats.nba.com` endpoints that the
[`nba_api`](https://github.com/swar/nba_api) Python package wraps —
`commonallplayers` for the search list and `shotchartdetail` for the shots —
proxied through Next.js API routes (the browser can't talk to `stats.nba.com`
directly because of CORS and required headers). No database, no stored
player list.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS for layout
- D3 for the diverging color scale and legend
- `cmdk` for the player typeahead
- `zod` for API route input validation

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), search a player, and the
shot map loads. The first request for each player hits `stats.nba.com`; after
that it's served from Next.js's per-URL cache for an hour. The active-player
list refreshes every 24 hours.

## How the data flows

```
Browser ──► /api/players              (24h ISR)  ──► stats.nba.com/stats/commonallplayers
Browser ──► /api/shots/[playerId]     (1h  ISR)  ──► stats.nba.com/stats/shotchartdetail
```

The `lib/nba/client.ts` wrapper adds the headers `stats.nba.com` requires
(modern Chrome `User-Agent`, `Referer: https://www.nba.com/`, the various
`Sec-Ch-Ua-*` and `Sec-Fetch-*` headers — same set the `nba_api` Python
client uses after its September 2025 update), retries once on `429`/`5xx`
with backoff, and applies a 10s timeout.

Shots are bucketed into the twelve standard NBA zones by their
`SHOT_ZONE_BASIC` × `SHOT_ZONE_AREA` combo (the API returns these on every
row, so no geometry math needed). Each zone polygon is colored by FG%
relative to that zone's league average: green = above league, red = below.

## Project layout

```text
app/
  layout.tsx
  page.tsx                          # SSR: fetches active player list
  globals.css
  api/
    players/route.ts                # ISR 24h
    shots/[playerId]/route.ts       # ISR 1h
components/
  PlayerSearch.tsx                  # cmdk combobox
  SeasonTypeToggle.tsx              # Regular Season / Playoffs
  ShotChart.tsx                     # SVG half court, zones, legend, tooltip
  ShotMapView.tsx                   # client orchestration + side panel
lib/
  aggregate.ts                      # zone aggregation + season totals
  nba/
    client.ts                       # nbaFetch w/ headers, retries, timeout
    court.ts                        # half-court SVG paths + 12 zone polygons
    players.ts                      # commonallplayers wrapper
    shots.ts                        # shotchartdetail wrapper
    types.ts                        # shared types
```

## Deployment

`stats.nba.com` is fronted by Akamai bot protection that, as of late 2025,
blocks many cloud-datacenter IPs (Vercel, AWS Lambda, etc.) with `403`s or
hangs. Three paths in increasing reliability:

### Path A — Vercel (simplest)

```bash
npx vercel deploy
```

Works for personal/low-traffic use. Aggressive ISR caching (24h for players,
1h per player for shots) means most requests hit the cache, but expect the
occasional `502 Bad Gateway` or `504` if NBA blocks the function IP.

### Path B — small VPS / Fly.io / Railway (recommended)

These hosts use IP ranges that aren't blanket-blocked. Build a tiny
container and deploy:

```bash
# example Dockerfile (drop into the repo root)
# FROM node:20-alpine
# WORKDIR /app
# COPY package*.json ./
# RUN npm ci
# COPY . .
# RUN npm run build
# EXPOSE 3000
# CMD ["npm", "start"]

fly launch          # one-time
fly deploy          # subsequent deploys
```

### Path C — Python sidecar fallback

If A and B both prove unreliable, run the official `nba_api` Python package
in a tiny FastAPI sidecar (it has the most battle-tested header rotation +
proxy support):

```text
api-py/
  main.py             # FastAPI: GET /players, GET /shots/{player_id}
  requirements.txt    # fastapi, uvicorn, nba_api
  Dockerfile
```

```python
# api-py/main.py (sketch)
from fastapi import FastAPI
from nba_api.stats.endpoints import shotchartdetail, commonallplayers

app = FastAPI()

@app.get("/players")
def players():
    df = commonallplayers.CommonAllPlayers(
        is_only_current_season=1, season="2025-26"
    ).get_data_frames()[0]
    return df[df["ROSTERSTATUS"] == 1].to_dict(orient="records")

@app.get("/shots/{player_id}")
def shots(player_id: int, season: str = "2025-26"):
    res = shotchartdetail.ShotChartDetail(
        team_id=0,
        player_id=player_id,
        season_nullable=season,
        context_measure_simple="FGA",
        season_type_all_star="Regular Season",
    ).get_data_frames()
    return {
        "shots": res[0].to_dict(orient="records"),
        "league_avg": res[1].to_dict(orient="records"),
    }
```

Then point the Next.js routes at the sidecar instead of `stats.nba.com`:
set `PY_SIDECAR_URL` in the environment and have `lib/nba/client.ts` swap
the base URL based on whether it's set.

## Caveats

- Bot-protection blocks are a moving target. `lib/nba/client.ts` logs every
  non-2xx with the URL so failures are easy to diagnose in the Vercel /
  Fly logs.
- Rookies who get added mid-season may not appear in the player list until
  the cache revalidates (24h).
- Players traded mid-season: the route requests `TeamID=0`, which returns
  shots from all of their teams in the season.
- Backcourt shots (`SHOT_ZONE_BASIC === "Backcourt"`) are dropped from the
  visualization — they don't have a polygon on the half court by design.
