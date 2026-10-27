"""Run the Python integration recipes against the local fixture server."""

import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RECIPE_DIR = ROOT / "src" / "features" / "docs" / "recipes"
EXPECTED_DIR = RECIPE_DIR / "expected"
MOCK = RECIPE_DIR / "mock-server.ts"
RECIPES = (
    "county-table.py",
    "page-collection.py",
    "value-state.py",
)
R_RECIPES = (
    "county-table.R",
    "page-collection.R",
    "value-state.R",
)


def main() -> None:
    port = free_port()
    mock = subprocess.Popen(
        [
            "node",
            "--experimental-strip-types",
            "--disable-warning=ExperimentalWarning",
            str(MOCK),
            str(port),
        ],
        cwd=ROOT,
    )
    try:
        wait_for_mock(port)
        env = os.environ.copy()
        env["ATLAS_API_BASE_URL"] = f"http://127.0.0.1:{port}"
        for name in RECIPES:
            run_recipe(name, env)
        syntax_check_r()
    finally:
        mock.terminate()
        try:
            mock.wait(timeout=5)
        except subprocess.TimeoutExpired:
            mock.kill()
            mock.wait(timeout=5)


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_for_mock(port: int) -> None:
    url = f"http://127.0.0.1:{port}/healthz"
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except OSError:
            time.sleep(0.05)
    raise RuntimeError("Recipe mock did not start")


def run_recipe(name: str, env: dict[str, str]) -> None:
    script = RECIPE_DIR / name
    result = subprocess.run(
        [sys.executable, str(script)],
        check=False,
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"{name} failed\n{result.stdout}\n{result.stderr}"
        )
    expected_path = EXPECTED_DIR / f"{script.stem}.txt"
    output = result.stdout
    assert_contract(name, output)
    if os.environ.get("ATLAS_RECIPE_WRITE_EXPECTED") == "1":
        expected_path.parent.mkdir(parents=True, exist_ok=True)
        expected_path.write_text(output)
        print(f"wrote {expected_path}")
        return
    expected = expected_path.read_text()
    if output != expected:
        raise RuntimeError(
            f"{name} output did not match {expected_path}\n{output}"
        )
    print(f"{name} matched {expected_path.name}")


def assert_contract(name: str, output: str) -> None:
    if "api.onehealthatlas.org" in output:
        raise RuntimeError(f"{name} printed the production origin")
    if "01001" in output and ",1001," in output:
        raise RuntimeError(f"{name} dropped a leading zero")
    for line in output.splitlines():
        cells = line.split(",")
        if len(cells) < 3:
            continue
        if cells[2] in {"MISSING", "SUPPRESSED", "UNAVAILABLE"} and cells[1] in {
            "0",
            "0.0",
        }:
            raise RuntimeError(f"{name} coerced null to zero: {line}")
        if cells[0] == "01001" and cells[0] != "01001":
            raise RuntimeError(name)
    if "release_id: governed-2026-10-15-january-climate-prod" not in output:
        raise RuntimeError(f"{name} omitted release_id")


def syntax_check_r() -> None:
    rscript = shutil.which("Rscript")
    if rscript is None:
        print("Rscript is not installed; R parse was skipped")
        return
    for name in R_RECIPES:
        script = RECIPE_DIR / name
        subprocess.run(
            [
                rscript,
                "--vanilla",
                "-e",
                f"invisible(parse(file={json.dumps(str(script))}))",
            ],
            check=True,
        )
        print(f"parsed {name}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(error, file=sys.stderr)
        sys.exit(1)
