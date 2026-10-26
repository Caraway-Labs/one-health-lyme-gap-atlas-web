import json
import os
import random
import time

import httpx
import pandas as pd

NULL_STATES = {"MISSING", "SUPPRESSED", "UNAVAILABLE"}
MAX_ATTEMPTS = 4
MAX_PAGES = 100
BASE_URL = os.environ.get(
    "ATLAS_API_BASE_URL", "https://api.onehealthatlas.org"
).rstrip("/")


def main() -> str:
    filters = [
        ("measure_id", "nclimgrid_tavg_county_day"),
        ("geography_type", "county"),
        ("geography_id", "36061"),
        ("year", "2025"),
        ("page_size", "2"),
    ]
    notes: list[str] = []
    rows: list[dict[str, object]] = []
    token: str | None = None
    pages = 0
    release_id = ""
    while True:
        if pages >= MAX_PAGES:
            raise RuntimeError(
                "Stopped after 100 pages because next_page_token was still set"
            )
        params = list(filters)
        if token is not None:
            params.append(("page_token", token))
        page_notes, page_rows, release_id, token = fetch_page(params)
        notes.extend(page_notes)
        rows.extend(page_rows)
        pages += 1
        if token is None:
            break
    frame = table_frame(rows)
    assert_fips(frame)
    assert_null_states(frame)
    lines = [
        *notes,
        f"release_id: {release_id}",
        f"pages: {pages}",
        "next_page_token: null",
        "period_start,geography_id,value,value_state,release_id",
    ]
    for row in frame.to_dict("records"):
        lines.append(
            f"{row['period_start']},{row['geography_id']},{format_value(row['value'])},{row['value_state']},{row['release_id']}"
        )
    return "\n".join(lines) + "\n"


def fetch_page(
    params: list[tuple[str, str]],
) -> tuple[list[str], list[dict[str, object]], str, str | None]:
    notes: list[str] = []
    with httpx.Client(timeout=30.0) as client:
        for attempt in range(1, MAX_ATTEMPTS + 1):
            response = client.get(f"{BASE_URL}/v1/observations", params=params)
            if response.status_code in {429, 503}:
                code = problem_code(response)
                delay = retry_delay_seconds(
                    response.headers.get("Retry-After"), attempt
                )
                code_text = f" {code}" if code else ""
                notes.append(
                    f"retry: {response.status_code}{code_text} {format_delay(delay)}"
                )
                if attempt == MAX_ATTEMPTS:
                    raise RuntimeError(
                        f"Atlas HTTP {response.status_code} after {MAX_ATTEMPTS} attempts"
                    )
                time.sleep(delay)
                continue
            if response.status_code >= 400:
                raise RuntimeError(
                    f"Atlas HTTP {response.status_code} {problem_detail(response)}"
                )
            rows, release_id, token = read_page(response)
            return notes, rows, release_id, token
    raise RuntimeError("Atlas retry loop ended")


def read_page(
    response: httpx.Response,
) -> tuple[list[dict[str, object]], str, str | None]:
    assert_media(response, "application/json")
    body = response.json()
    meta = body["meta"]
    token = meta["next_page_token"]
    if token is not None and not isinstance(token, str):
        raise RuntimeError("Atlas next_page_token is not a string or null")
    release_id = meta["release_id"]
    if not isinstance(release_id, str):
        raise RuntimeError("Atlas response is missing release_id")
    rows = [read_observation(item) for item in body["data"]]
    return rows, release_id, token


def read_observation(item: dict[str, object]) -> dict[str, object]:
    geography = item["geography"]
    if not isinstance(geography, dict):
        raise RuntimeError("Atlas observation is missing geography")
    return {
        "geography_id": geography["geography_id"],
        "period_start": item["period_start"],
        "release_id": item["release_id"],
        "value": item["value"],
        "value_state": item["value_state"],
    }


def table_frame(rows: list[dict[str, object]]) -> pd.DataFrame:
    frame = pd.DataFrame.from_records(
        rows,
        columns=[
            "period_start",
            "geography_id",
            "value",
            "value_state",
            "release_id",
        ],
    )
    frame["geography_id"] = pd.Series(frame["geography_id"], dtype="string")
    frame["value"] = pd.Series([row["value"] for row in rows], dtype="object")
    frame["value_state"] = pd.Series(frame["value_state"], dtype="string")
    frame["release_id"] = pd.Series(frame["release_id"], dtype="string")
    frame["period_start"] = pd.Series(frame["period_start"], dtype="string")
    return frame


def assert_fips(frame: pd.DataFrame) -> None:
    for geography_id in frame["geography_id"].tolist():
        if (
            not isinstance(geography_id, str)
            or len(geography_id) != 5
            or not geography_id.isdigit()
        ):
            raise RuntimeError(
                f"FIPS must stay a 5-character string, got {geography_id!r}"
            )


def assert_null_states(frame: pd.DataFrame) -> None:
    for row in frame.to_dict("records"):
        if row["value_state"] not in NULL_STATES:
            continue
        value = row["value"]
        if value is None or (not isinstance(value, str) and pd.isna(value)):
            continue
        raise RuntimeError(
            f"{row['value_state']} for {row['geography_id']} was {value!r}, not null"
        )


def format_value(value: object) -> str:
    if value is None or (not isinstance(value, str) and pd.isna(value)):
        return "null"
    if isinstance(value, bool):
        raise RuntimeError("Atlas value was a boolean")
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return json.dumps(value)
    if isinstance(value, str):
        return value
    raise RuntimeError(f"Unexpected Atlas value {value!r}")


def retry_delay_seconds(header: str | None, attempt: int) -> float:
    if header is not None and header.strip() != "":
        seconds = float(header)
        if seconds >= 0:
            return seconds
    base = min(60.0, float(2 ** (attempt - 1)))
    return min(60.0, base + random.uniform(0, min(1.0, base * 0.1)))


def format_delay(delay: float) -> str:
    if float(delay).is_integer():
        return str(int(delay))
    return str(delay)


def problem_code(response: httpx.Response) -> str | None:
    problem = problem_body(response)
    code = problem.get("code") if problem else None
    return code if isinstance(code, str) else None


def problem_detail(response: httpx.Response) -> str:
    problem = problem_body(response)
    detail = problem.get("detail") if problem else None
    return detail if isinstance(detail, str) else ""


def problem_body(response: httpx.Response) -> dict[str, object] | None:
    if media_type(response) != "application/problem+json":
        return None
    body = response.json()
    if isinstance(body, dict):
        return body
    return None


def assert_media(response: httpx.Response, expected: str) -> None:
    actual = media_type(response)
    if actual != expected:
        raise RuntimeError(f"Atlas Content-Type was {actual or 'missing'}")


def media_type(response: httpx.Response) -> str | None:
    header = response.headers.get("Content-Type")
    if header is None:
        return None
    return header.split(";", 1)[0].strip().lower()


if __name__ == "__main__":
    print(main(), end="")
