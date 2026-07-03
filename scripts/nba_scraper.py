#!/usr/bin/env python3
"""
Scrape NBA player and shot data from stats.nba.com and upsert into Supabase.

stats.nba.com HTTP usage (minimal by design — no per-player shot loops):

  --mode players  -> 1 request (commonallplayers)
  --mode shots    -> 1 request (shotchartdetail, league-wide; --season-type picks RS vs PO)
  --mode stats    -> 1 request (leaguedashplayerstats, Base PerGame; --season-type picks RS vs PO)
  --mode all      -> 1 commonallplayers + 4 shotchartdetail
                    (RS split Oct-Dec, Jan-Feb, Mar-Apr; then PO)

Retries only occur on transient 429/5xx or errors (bounded by MAX_RETRIES).

Usage examples:
  python scripts/nba_scraper.py
  python scripts/nba_scraper.py --season 2025-26 --season-type "Regular Season"
"""

from __future__ import annotations

import argparse
import calendar
import os
import random
import sys
import time
from typing import Any, Dict, Iterable, List, Optional

import httpx
from curl_cffi import requests
from supabase import Client, ClientOptions, create_client

NBA_STATS_URL = "https://stats.nba.com/stats"
# Default scrape target season.
# To change seasons:
#   1) Update this constant (project-wide default), OR
#   2) Pass --season at runtime, e.g. --season 2026-27 (recommended).
DEFAULT_SEASON = "2025-26"
DEFAULT_SEASON_TYPE = "Regular Season"
STATS_MEASURE_TYPE = "Base"
STATS_PER_MODE = "PerGame"
DEFAULT_TIMEOUT_SECONDS = 20
MAX_RETRIES = 3
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
SUPABASE_HTTP_TIMEOUT = httpx.Timeout(180.0, connect=45.0)
SUPABASE_PLAYERS_BATCH = 300
SUPABASE_SHOTS_BATCH = 80
SUPABASE_UPSERT_MAX_RETRIES = 6


def _transport_retryable(exc: BaseException) -> bool:
    return isinstance(
        exc,
        (
            httpx.ReadError,
            httpx.ConnectError,
            httpx.ConnectTimeout,
            httpx.ReadTimeout,
            httpx.WriteError,
            httpx.RemoteProtocolError,
            httpx.WriteTimeout,
        ),
    )


def _caused_by_retryable_transport(exc: BaseException) -> bool:
    cur: Optional[BaseException] = exc
    while cur is not None:
        if _transport_retryable(cur):
            return True
        cur = cur.__cause__
    return False
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


def _stats_num(row: Dict[str, Any], key: str) -> float:
    val = row.get(key)
    if val is None or val == "":
        return 0.0
    return float(val)


def _stats_int(row: Dict[str, Any], key: str) -> int:
    val = row.get(key)
    if val is None or val == "":
        return 0
    return int(val)


def _stats_row_to_db(
    row: Dict[str, Any],
    season: str,
    season_type: str,
) -> Dict[str, Any]:
    return {
        "person_id": _stats_int(row, "PLAYER_ID"),
        "season": season,
        "season_type": season_type,
        "per_mode": STATS_PER_MODE,
        "measure_type": STATS_MEASURE_TYPE,
        "player_name": str(row.get("PLAYER_NAME") or ""),
        "team_id": _stats_int(row, "TEAM_ID"),
        "team_abbreviation": str(row.get("TEAM_ABBREVIATION") or ""),
        "age": _stats_num(row, "AGE"),
        "gp": _stats_int(row, "GP"),
        "w": _stats_int(row, "W"),
        "l": _stats_int(row, "L"),
        "w_pct": _stats_num(row, "W_PCT"),
        "min": _stats_num(row, "MIN"),
        "fgm": _stats_int(row, "FGM"),
        "fga": _stats_int(row, "FGA"),
        "fg_pct": _stats_num(row, "FG_PCT"),
        "fg3m": _stats_int(row, "FG3M"),
        "fg3a": _stats_int(row, "FG3A"),
        "fg3_pct": _stats_num(row, "FG3_PCT"),
        "ftm": _stats_int(row, "FTM"),
        "fta": _stats_int(row, "FTA"),
        "ft_pct": _stats_num(row, "FT_PCT"),
        "oreb": _stats_int(row, "OREB"),
        "dreb": _stats_int(row, "DREB"),
        "reb": _stats_int(row, "REB"),
        "ast": _stats_int(row, "AST"),
        "tov": _stats_int(row, "TOV"),
        "stl": _stats_int(row, "STL"),
        "blk": _stats_int(row, "BLK"),
        "blka": _stats_int(row, "BLKA"),
        "pf": _stats_int(row, "PF"),
        "pfd": _stats_int(row, "PFD"),
        "pts": _stats_num(row, "PTS"),
        "plus_minus": _stats_num(row, "PLUS_MINUS"),
        "nba_fantasy_pts": _stats_num(row, "NBA_FANTASY_PTS"),
        "dd2": _stats_int(row, "DD2"),
        "td3": _stats_int(row, "TD3"),
    }


def fetch_player_stats(
    session: requests.Session,
    season: str = DEFAULT_SEASON,
    season_type: str = DEFAULT_SEASON_TYPE,
) -> List[Dict[str, Any]]:
    params = {
        "College": "",
        "Conference": "",
        "Country": "",
        "DateFrom": "",
        "DateTo": "",
        "Division": "",
        "DraftPick": "",
        "DraftYear": "",
        "GameScope": "",
        "GameSegment": "",
        "Height": "",
        "LastNGames": 0,
        "LeagueID": "00",
        "Location": "",
        "MeasureType": STATS_MEASURE_TYPE,
        "Month": 0,
        "OpponentTeamID": 0,
        "Outcome": "",
        "PORound": 0,
        "PaceAdjust": "N",
        "PerMode": STATS_PER_MODE,
        "Period": 0,
        "PlayerExperience": "",
        "PlayerPosition": "",
        "PlusMinus": "N",
        "Rank": "N",
        "Season": season,
        "SeasonSegment": "",
        "SeasonType": season_type,
        "ShotClockRange": "",
        "StarterBench": "",
        "TeamID": 0,
        "TwoWay": 0,
        "VsConference": "",
        "VsDivision": "",
        "Weight": "",
    }
    payload = _nba_get(session, "leaguedashplayerstats", params)
    table = _get_result_set(payload, "LeagueDashPlayerStats")
    rows = _rows_to_dicts(table)

    stats = [_stats_row_to_db(row, season, season_type) for row in rows]
    print(
        f"[stats] Parsed {len(stats)} player stat rows for {season}, {season_type} "
        f"({STATS_MEASURE_TYPE} / {STATS_PER_MODE}).",
        flush=True,
    )
    return stats


def _shot_id_for_row(shot_row: Dict[str, Any], player_id: int, season_type: str) -> str:
    """Regular season keeps legacy id shape; playoffs prefix po_ so rows don't collide in one table."""
    game_id = str(shot_row.get("GAME_ID") or "")
    period = int(shot_row.get("PERIOD") or 0)
    minutes_remaining = int(shot_row.get("MINUTES_REMAINING") or 0)
    seconds_remaining = int(shot_row.get("SECONDS_REMAINING") or 0)
    loc_x = int(shot_row.get("LOC_X") or 0)
    loc_y = int(shot_row.get("LOC_Y") or 0)
    base = f"{game_id}_{player_id}_{period}_{minutes_remaining}_{seconds_remaining}_{loc_x}_{loc_y}"
    if season_type == "Playoffs":
        return f"po_{base}"
    return base


def fetch_shots(
    session: requests.Session,
    player_id: int,
    season: str = DEFAULT_SEASON,
    season_type: str = DEFAULT_SEASON_TYPE,
    date_from: str = "",
    date_to: str = "",
) -> List[Dict[str, Any]]:
    params = {
        "AheadBehind": "",
        "ClutchTime": "",
        "ContextFilter": "",
        "ContextMeasure": "FGA",
        "DateFrom": date_from,
        "DateTo": date_to,
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
                "shot_id": _shot_id_for_row(row, resolved_player_id, season_type),
                "game_id": str(row.get("GAME_ID") or ""),
                "person_id": resolved_player_id,
                "season_type": season_type,
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


def _season_years(season: str) -> tuple[int, int]:
    """Convert '2025-26' or '2025-2026' into (2025, 2026)."""
    try:
        start_raw, end_raw = season.split("-")
        start_year = int(start_raw)
        if len(end_raw) == 2:
            century = (start_year // 100) * 100
            end_year = century + int(end_raw)
        else:
            end_year = int(end_raw)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(
            f"Invalid season format '{season}'. Expected e.g. '2025-26'."
        ) from exc
    return start_year, end_year


def _regular_season_windows(season: str) -> List[Dict[str, str]]:
    """Fixed regular-season windows for league-wide ingestion."""
    start_year, end_year = _season_years(season)
    feb_last_day = calendar.monthrange(end_year, 2)[1]
    return [
        {
            "label": "Regular Season (Oct-Dec)",
            "season_type": "Regular Season",
            "date_from": f"10/01/{start_year}",
            "date_to": f"12/31/{start_year}",
        },
        {
            "label": "Regular Season (Jan-Feb)",
            "season_type": "Regular Season",
            "date_from": f"01/01/{end_year}",
            "date_to": f"02/{feb_last_day:02d}/{end_year}",
        },
        {
            "label": "Regular Season (Mar-Apr)",
            "season_type": "Regular Season",
            "date_from": f"03/01/{end_year}",
            "date_to": f"04/30/{end_year}",
        },
    ]


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
    # HTTP/2 + very large JSON bodies has triggered TLS record errors for some users;
    # disable HTTP/2 and use longer timeouts for batched upserts.
    shared_httpx = httpx.Client(http2=False, timeout=SUPABASE_HTTP_TIMEOUT)
    options = ClientOptions(
        httpx_client=shared_httpx,
        postgrest_client_timeout=SUPABASE_HTTP_TIMEOUT,
    )
    return create_client(supabase_url, service_role_key, options=options)


def _stable_upsert_batch(
    supabase: Client,
    *,
    table: str,
    batch: List[Dict[str, Any]],
    on_conflict: str,
    label: str,
) -> None:
    """Retry whole batch on flaky TLS/transient transport (e.g. SSL BAD_RECORD_MAC)."""
    last_error: Optional[BaseException] = None
    for attempt in range(1, SUPABASE_UPSERT_MAX_RETRIES + 1):
        try:
            supabase.table(table).upsert(batch, on_conflict=on_conflict).execute()
            return
        except BaseException as exc:  # noqa: BLE001 — walk __cause__ for wrapped TLS errors
            if not _caused_by_retryable_transport(exc):
                raise
            last_error = exc
            if attempt == SUPABASE_UPSERT_MAX_RETRIES:
                break
            wait_s = (2 ** (attempt - 1)) + random.uniform(0.15, 0.95)
            print(
                f"[supabase] {label}: transient transport error ({type(exc).__name__}: {exc!s}); "
                f"retry {attempt}/{SUPABASE_UPSERT_MAX_RETRIES} in {wait_s:.1f}s",
                flush=True,
            )
            time.sleep(wait_s)
    raise RuntimeError(f"[supabase] {label}: exhausted retries ({last_error!r}).") from last_error


def upsert_players(
    supabase: Client,
    players: List[Dict[str, Any]],
    batch_size: int = SUPABASE_PLAYERS_BATCH,
) -> None:
    if not players:
        print("[supabase] No players to upsert.", flush=True)
        return

    total = 0
    batches = list(_chunk(players, batch_size))
    for idx, batch in enumerate(batches, start=1):
        label = f"nba_players batch {idx}/{len(batches)}"
        _stable_upsert_batch(
            supabase,
            table="nba_players",
            batch=batch,
            on_conflict="person_id",
            label=label,
        )
        total += len(batch)
    print(f"[supabase] Upserted {total} player rows.", flush=True)


def _known_person_ids(supabase: Client) -> set[int]:
    """person_ids present in nba_players (required when nba_shots.person_id has an FK there)."""
    ids: set[int] = set()
    page_size = 1000
    start = 0
    while True:
        res = (
            supabase.table("nba_players")
            .select("person_id")
            .range(start, start + page_size - 1)
            .execute()
        )
        rows = res.data or []
        for row in rows:
            ids.add(int(row["person_id"]))
        if len(rows) < page_size:
            break
        start += page_size
    return ids


def _dedupe_shots_last_wins(shots: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Collapse rows that share the same shot_id. Later rows win (Postgres rejects
    duplicate conflict keys in a single upsert statement).
    """
    by_id: Dict[str, Dict[str, Any]] = {}
    missing_id = 0
    for row in shots:
        sid = str(row.get("shot_id") or "")
        if not sid:
            missing_id += 1
            continue
        by_id[sid] = row
    if missing_id:
        print(
            f"[supabase] Skipped {missing_id} shot row(s) with empty shot_id.",
            flush=True,
        )
    return list(by_id.values())


def upsert_shots(
    supabase: Client,
    shots: List[Dict[str, Any]],
    batch_size: int = SUPABASE_SHOTS_BATCH,
) -> int:
    """Returns number of rows upserted after deduplication by shot_id."""
    if not shots:
        print("[supabase] No shots to upsert for this player.", flush=True)
        return 0

    incoming = len(shots)
    shots = _dedupe_shots_last_wins(shots)
    dupes = incoming - len(shots)
    if dupes:
        print(
            f"[supabase] Collapsed {dupes} duplicate shot_id row(s); keeping last occurrence per id.",
            flush=True,
        )

    total = 0
    batches = list(_chunk(shots, batch_size))
    for idx, batch in enumerate(batches, start=1):
        label = f"nba_shots batch {idx}/{len(batches)}"
        _stable_upsert_batch(
            supabase,
            table="nba_shots",
            batch=batch,
            on_conflict="shot_id",
            label=label,
        )
        total += len(batch)
        if idx % 20 == 0 or idx == len(batches):
            print(f"[supabase] Progress: {total}/{len(shots)} shot rows committed.", flush=True)
    print(f"[supabase] Upserted {total} shot rows.", flush=True)
    return total


def upsert_player_stats(
    supabase: Client,
    stats: List[Dict[str, Any]],
    batch_size: int = SUPABASE_PLAYERS_BATCH,
) -> int:
    """Returns number of rows upserted."""
    if not stats:
        print("[supabase] No player stats to upsert.", flush=True)
        return 0

    total = 0
    batches = list(_chunk(stats, batch_size))
    for idx, batch in enumerate(batches, start=1):
        label = f"nba_player_stats batch {idx}/{len(batches)}"
        _stable_upsert_batch(
            supabase,
            table="nba_player_stats",
            batch=batch,
            on_conflict="person_id,season,season_type,per_mode,measure_type",
            label=label,
        )
        total += len(batch)
    print(f"[supabase] Upserted {total} player stat rows.", flush=True)
    return total


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape NBA data and upsert into Supabase.")
    parser.add_argument(
        "--mode",
        default="all",
        choices=["all", "players", "shots", "stats"],
        help="Run mode: all (default), players-only, shots-only, or stats-only.",
    )
    parser.add_argument(
        "--season",
        default=DEFAULT_SEASON,
        help=(
            f"Season string (default: {DEFAULT_SEASON}). "
            "Change year by passing values like 2026-27."
        ),
    )
    parser.add_argument(
        "--season-type",
        default=DEFAULT_SEASON_TYPE,
        choices=["Regular Season", "Playoffs"],
        help=(
            f"Season segment (default: {DEFAULT_SEASON_TYPE}). "
            "Used by --mode shots and --mode stats; --mode all pulls three Regular Season shot windows plus Playoffs."
        ),
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    supabase = _supabase_client()
    shots_upsert_count = 0

    with requests.Session() as session:
        players: List[Dict[str, Any]] = []
        if args.mode in {"all", "players"}:
            players = fetch_players(session=session, season=args.season)
            upsert_players(supabase, players)

        if args.mode == "players":
            print(f"[done] Finished players-only sync for season={args.season}.", flush=True)
            return 0

        allowed_ids = _known_person_ids(supabase)
        if not allowed_ids:
            print(
                f"[{args.mode}] nba_players is empty — cannot upsert (foreign key). "
                "Run `python scripts/nba_scraper.py --mode players` first.",
                flush=True,
            )
            return 1

        if args.mode == "stats":
            print(
                f"[run] League-wide player stats sync — {args.season_type} "
                f"(leaguedashplayerstats {STATS_MEASURE_TYPE} / {STATS_PER_MODE}).",
                flush=True,
            )
            league_stats = fetch_player_stats(
                session=session,
                season=args.season,
                season_type=args.season_type,
            )
            filtered_stats = [
                s for s in league_stats if int(s.get("person_id") or 0) in allowed_ids
            ]
            dropped = len(league_stats) - len(filtered_stats)
            if dropped:
                print(
                    f"[stats] Dropping {dropped} rows whose person_id is not in nba_players "
                    "(league stats include players outside the synced active roster).",
                    flush=True,
                )
            stats_upsert_count = upsert_player_stats(supabase, filtered_stats)
            print(
                f"[done] Finished stats sync for season={args.season} "
                f"season_type='{args.season_type}'. "
                f"Player stats upserted={stats_upsert_count}.",
                flush=True,
            )
            return 0

        shot_windows: List[Dict[str, str]]
        if args.mode == "all":
            shot_windows = _regular_season_windows(args.season) + [
                {
                    "label": "Playoffs",
                    "season_type": "Playoffs",
                    "date_from": "",
                    "date_to": "",
                }
            ]
        else:
            shot_windows = [
                {
                    "label": args.season_type,
                    "season_type": args.season_type,
                    "date_from": "",
                    "date_to": "",
                }
            ]

        for window in shot_windows:
            st_label = window["label"]
            st_type = window["season_type"]
            date_from = window["date_from"]
            date_to = window["date_to"]
            date_scope = (
                f", date window {date_from} -> {date_to}"
                if date_from and date_to
                else ""
            )
            print(
                f"[run] League-wide shot sync — {st_label} "
                f"(shotchartdetail PlayerID=0, TeamID=0{date_scope}).",
                flush=True,
            )
            league_shots = fetch_shots(
                session=session,
                player_id=0,
                season=args.season,
                season_type=st_type,
                date_from=date_from,
                date_to=date_to,
            )

            filtered_shots = [s for s in league_shots if int(s.get("person_id") or 0) in allowed_ids]
            dropped = len(league_shots) - len(filtered_shots)
            if dropped:
                print(
                    f"[shots] [{st_label}] Dropping {dropped} rows whose person_id is not in nba_players "
                    f"(league chart includes shooters outside the synced active roster).",
                    flush=True,
                )

            shots_upsert_count += upsert_shots(supabase, filtered_shots)

    if args.mode == "all":
        done_season_types = "Regular Season + Playoffs"
    else:
        done_season_types = args.season_type
    print(
        f"[done] Finished scraping season={args.season} season_type_scope='{done_season_types}'. "
        f"League-wide shots upserted(total)={shots_upsert_count}.",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n[exit] Interrupted by user.", file=sys.stderr)
        raise SystemExit(130)
