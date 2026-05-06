-- Run once in Supabase SQL editor so the app + scraper can split Regular Season vs Playoffs rows.
ALTER TABLE nba_shots
  ADD COLUMN IF NOT EXISTS season_type TEXT NOT NULL DEFAULT 'Regular Season';

CREATE INDEX IF NOT EXISTS idx_nba_shots_person_id_season_type
  ON nba_shots (person_id, season_type);
