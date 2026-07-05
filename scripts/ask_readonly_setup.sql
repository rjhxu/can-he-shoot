-- Run once in Supabase SQL editor before using POST /api/ask.
-- Replace CHANGE_ME with a strong password, then set ASK_READONLY_DATABASE_URL
-- using the transaction-mode pooled connection string with ask_readonly credentials.

create role ask_readonly with login password 'CHANGE_ME' nosuperuser nocreatedb nocreaterole;

grant usage on schema public to ask_readonly;
grant select on public.nba_players, public.nba_shots, public.nba_player_stats to ask_readonly;
alter role ask_readonly set statement_timeout = '3s';

create policy "ask_readonly read nba_players"
  on public.nba_players for select to ask_readonly using (true);

create policy "ask_readonly read nba_shots"
  on public.nba_shots for select to ask_readonly using (true);

create policy "ask_readonly read nba_player_stats"
  on public.nba_player_stats for select to ask_readonly using (true);
