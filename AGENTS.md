# AGENTS.md

## Cursor Cloud specific instructions

"Can He Shoot?" is a single Next.js 15 (App Router, React 19) app — there is no separate backend service. The dev server (`npm run dev`, port 3000) serves both the UI and the API routes (`/api/ask`, `/api/shots/[playerId]`, `/api/stats/[playerId]`).

### Running / testing / building
Standard commands are in `package.json` and `README.md`:
- `npm run dev` — dev server (use this for development, not `npm run build`/`npm start`)
- `npm run lint`, `npm run typecheck`, `npm run test:ci` — the same checks CI runs (`.github/workflows/ci.yml`)

Tests are pure unit/route tests: they mock Supabase, Cohere, and `pg`, so `npm run test:ci` needs **no** env vars or network.

### External services (required for real data, not for tests)
The app has no local datastore — all real data lives in external services, so end-to-end functionality needs secrets in `.env.local` (see `.env.example`):
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — powers `/stats`, player search, shot maps, season stats.
- `COHERE_API_KEY` + `ASK_READONLY_DATABASE_URL` — powers the `/` Ask feature (Cohere generates SQL, run on a read-only Postgres role).
- `SUPABASE_SERVICE_ROLE_KEY` — only for `scripts/nba_scraper.py` ingestion; never used by the web app.

Without these secrets the pages still compile and render (HTTP 200), but data-backed features degrade gracefully: `/stats` shows an empty roster and `POST /api/ask` returns `503`. There is no local seed/fixture path — the Supabase DB must be populated (via `scripts/nba_scraper.py`) for real answers.

### Gotchas
- The dev log prints `Failed to find font override values for font 'Big Shoulders'` on startup — this is a harmless Google Fonts warning, not an error.
- `next lint` prints a deprecation notice ("deprecated and will be removed in Next.js 16") and two `no-img-element` warnings; these are expected and lint exits 0.
