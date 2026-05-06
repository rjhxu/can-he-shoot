#!/usr/bin/env python3
"""
Scrape NBA player and shot data from stats.nba.com and upsert into Supabase.

stats.nba.com HTTP usage (minimal by design — no per-player shot loops):

  --mode players  -> 1 request (commonallplayers)
  --mode shots    -> 1 request (shotchartdetail, league-wide PlayerID=0 TeamID=0)
  --mode all      -> 2 requests total (players, then shots; randomized delay between)

Retries only occur on transient 429/5xx or errors (bounded by MAX_RETRIES).

Usage examples:
  python scripts/nba_scraper.py
  python scripts/nba_scraper.py --season 2025-26 --season-type "Regular Season"
"""

from __future__ import annotations

import argparse
import os
import random
import sys
import time
from typing import Any, Dict, Iterable, List, Optional

from curl_cffi import requests
from supabase import Client, create_client

NBA_STATS_URL = "https://stats.nba.com/stats"
DEFAULT_SEASON = "2025-26"
DEFAULT_SEASON_TYPE = "Regular Season"
DEFAULT_TIMEOUT_SECONDS = 20
MAX_RETRIES = 3
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
# Be conservative between NBA endpoints to reduce throttle / soft-ban risk on shared IPs.
REQUEST_DELAY_RANGE_SECONDS = (2.0, 6.0)

COMMON_HEADERS = {
    "Referer": "https://www.nba.com/",
    "Origin": "https://www.nba.com",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}

_LAST_REQUEST_TS: Optional[float] = None


def _sleep_between_requests() -> None:
    global _LAST_REQUEST_TS
    now = time.time()
    if _LAST_REQUEST_TS is not None and now >= _LAST_REQUEST_TS:
        delay = random.uniform(*REQUEST_DELAY_RANGE_SECONDS)
        print(f"[rate-limit] Sleeping {delay:.2f}s before next request...", flush=True)
        time.sleep(delay)
    _LAST_REQUEST_TS = time.time()


def _get_result_set(payload: Dict[str, Any], name: str) -> Dict[str, Any]:
    result_sets = payload.get("resultSets", [])
    for result in result_sets:
        if result.get("name") == name:
            return result
    raise ValueError(f"Could not find result set '{name}' in NBA response.")


def _rows_to_dicts(table: Dict[str, Any]) -> List[Dict[str, Any]]:
    headers = table.get("headers", [])
    row_set = table.get("rowSet", [])
    return [dict(zip(headers, row)) for row in row_set]


def _nba_get(session: requests.Session, endpoint: str, params: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{NBA_STATS_URL}/{endpoint}"
    last_error: Optional[Exception] = None

    for attempt in range(1, MAX_RETRIES + 1):
        _sleep_between_requests()
        try:
            response = session.get(
                url,
                params=params,
                headers=COMMON_HEADERS,
                impersonate="chrome",
                timeout=DEFAULT_TIMEOUT_SECONDS,
            )
            if response.status_code in RETRYABLE_STATUS_CODES:
                wait_seconds = (2 ** (attempt - 1)) + random.uniform(0.1, 0.6)
                print(
                    f"[http] {endpoint} returned {response.status_code} (attempt {attempt}/{MAX_RETRIES}). "
                    f"Retrying in {wait_seconds:.2f}s...",
                    flush=True,
                )
                time.sleep(wait_seconds)
                continue

            response.raise_for_status()
            return response.json()
        except Exception as exc:  # pylint: disable=broad-except
            last_error = exc
            if attempt == MAX_RETRIES:
                break
            wait_seconds = (2 ** (attempt - 1)) + random.uniform(0.1, 0.6)
            print(
                f"[http] Error calling {endpoint} (attempt {attempt}/{MAX_RETRIES}): {exc}. "
                f"Retrying in {wait_seconds:.2f}s...",
                flush=True,
            )
            time.sleep(wait_seconds)

    raise RuntimeError(f"Failed request for endpoint '{endpoint}' after {MAX_RETRIES} attempts: {last_error}")


def fetch_players(session: requests.Session, season: str = DEFAULT_SEASON) -> List[Dict[str, Any]]:
    params = {
        "LeagueID": "00",
        "Season": season,
        "IsOnlyCurrentSeason": "1",
    }
    payload = _nba_get(session, "commonallplayers", params)
    table = _get_result_set(payload, "CommonAllPlayers")
    rows = _rows_to_dicts(table)

    players: List[Dict[str, Any]] = []
    for row in rows:
        roster_status = int(row.get("ROSTERSTATUS") or 0)
        team_id = int(row.get("TEAM_ID") or 0)
        if roster_status != 1 or team_id == 0:
            continue

        players.append(
            {
                "person_id": int(row.get("PERSON_ID") or 0),
                "display_first_last": str(row.get("DISPLAY_FIRST_LAST") or ""),
                "team_id": team_id,
                "team_abbreviation": str(row.get("TEAM_ABBREVIATION") or ""),
                "rosterstatus": str(row.get("ROSTERSTATUS") or ""),
                "from_year": str(row.get("FROM_YEAR") or ""),
                "to_year": str(row.get("TO_YEAR") or ""),
            }
        )

    players.sort(key=lambda p: p["display_first_last"])
    print(f"[players] Parsed {len(players)} active players for {season}.", flush=True)
    return players


def _build_shot_id(shot_row: Dict[str, Any], player_id: int) -> str:
    game_id = str(shot_row.get("GAME_ID") or "")
    period = int(shot_row.get("PERIOD") or 0)
    minutes_remaining = int(shot_row.get("MINUTES_REMAINING") or 0)
    seconds_remaining = int(shot_row.get("SECONDS_REMAINING") or 0)
    loc_x = int(shot_row.get("LOC_X") or 0)
    loc_y = int(shot_row.get("LOC_Y") or 0)
    return f"{game_id}_{player_id}_{period}_{minutes_remaining}_{seconds_remaining}_{loc_x}_{loc_y}"


def fetch_shots(
    session: requests.Session,
    player_id: int,
    season: str = DEFAULT_SEASON,
    season_type: str = DEFAULT_SEASON_TYPE,
) -> List[Dict[str, Any]]:
    params = {
        "AheadBehind": "",
        "ClutchTime": "",
        "ContextFilter": "",
        "ContextMeasure": "FGA",
        "DateFrom": "",
        "DateTo": "",
        "EndPeriod": 0,
        "EndRange": 28800,
        "GameID": "",
        "GameSegment": "",
        "LastNGames": 0,
        "LeagueID": "00",
        "Location": "",
        "Month": 0,
        "OpponentTeamID": 0,
        "Outcome": "",
        "Period": 0,
        "PlayerID": player_id,
        "PlayerPosition": "",
        "PointDiff": "",
        "Position": "",
        "RangeType": 0,
        "RookieYear": "",
        "Season": season,
        "SeasonSegment": "",
        "SeasonType": season_type,
        "StartPeriod": 0,
        "StartRange": 0,
        "TeamID": 0,
        "VsConference": "",
        "VsDivision": "",
    }
    payload = _nba_get(session, "shotchartdetail", params)
    table = _get_result_set(payload, "Shot_Chart_Detail")
    rows = _rows_to_dicts(table)

    shots: List[Dict[str, Any]] = []
    for row in rows:
        resolved_player_id = int(row.get("PLAYER_ID") or player_id)
        shots.append(
            {
                "shot_id": _build_shot_id(row, resolved_player_id),
                "game_id": str(row.get("GAME_ID") or ""),
                "person_id": resolved_player_id,
                "game_date": str(row.get("GAME_DATE") or ""),
                "period": int(row.get("PERIOD") or 0),
                "minutes_remaining": int(row.get("MINUTES_REMAINING") or 0),
                "seconds_remaining": int(row.get("SECONDS_REMAINING") or 0),
                "action_type": str(row.get("ACTION_TYPE") or ""),
                "shot_type": str(row.get("SHOT_TYPE") or ""),
                "shot_zone_basic": str(row.get("SHOT_ZONE_BASIC") or ""),
                "shot_zone_area": str(row.get("SHOT_ZONE_AREA") or ""),
                "shot_zone_range": str(row.get("SHOT_ZONE_RANGE") or ""),
                "shot_distance": int(row.get("SHOT_DISTANCE") or 0),
                "loc_x": int(row.get("LOC_X") or 0),
                "loc_y": int(row.get("LOC_Y") or 0),
                "shot_made_flag": int(row.get("SHOT_MADE_FLAG") or 0),
            }
        )

    print(
        f"[shots] Player {player_id} ({season}, {season_type}) -> {len(shots)} shots.",
        flush=True,
    )
    return shots


def _chunk(items: List[Dict[str, Any]], size: int) -> Iterable[List[Dict[str, Any]]]:
    for idx in range(0, len(items), size):
        yield items[idx : idx + size]


def _supabase_client() -> Client:
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        raise RuntimeError(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
        )
    return create_client(supabase_url, service_role_key)


def upsert_players(supabase: Client, players: List[Dict[str, Any]], batch_size: int = 500) -> None:
    if not players:
        print("[supabase] No players to upsert.", flush=True)
        return

    total = 0
    for batch in _chunk(players, batch_size):
        supabase.table("nba_players").upsert(batch, on_conflict="person_id").execute()
        total += len(batch)
    print(f"[supabase] Upserted {total} player rows.", flush=True)


def upsert_shots(supabase: Client, shots: List[Dict[str, Any]], batch_size: int = 500) -> None:
    if not shots:
        print("[supabase] No shots to upsert for this player.", flush=True)
        return

    total = 0
    for batch in _chunk(shots, batch_size):
        supabase.table("nba_shots").upsert(batch, on_conflict="shot_id").execute()
        total += len(batch)
    print(f"[supabase] Upserted {total} shot rows.", flush=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape NBA data and upsert into Supabase.")
    parser.add_argument(
        "--mode",
        default="all",
        choices=["all", "players", "shots"],
        help="Run mode: all (default), players-only, or shots-only.",
    )
    parser.add_argument("--season", default=DEFAULT_SEASON, help=f"Season string (default: {DEFAULT_SEASON})")
    parser.add_argument(
        "--season-type",
        default=DEFAULT_SEASON_TYPE,
        choices=["Regular Season", "Playoffs"],
        help=f"Season type (default: {DEFAULT_SEASON_TYPE})",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    supabase = _supabase_client()

    with requests.Session() as session:
        players: List[Dict[str, Any]] = []
        if args.mode in {"all", "players"}:
            players = fetch_players(session=session, season=args.season)
            upsert_players(supabase, players)

        if args.mode == "players":
            print(f"[done] Finished players-only sync for season={args.season}.", flush=True)
            return 0

        print("[run] League-wide shot sync (shotchartdetail PlayerID=0, TeamID=0).", flush=True)
        league_shots = fetch_shots(
            session=session,
            player_id=0,
            season=args.season,
            season_type=args.season_type,
        )
        upsert_shots(supabase, league_shots)

    print(
        f"[done] Finished scraping season={args.season} season_type='{args.season_type}'. "
        f"League-wide shots upserted={len(league_shots)}.",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n[exit] Interrupted by user.", file=sys.stderr)
        raise SystemExit(130)
