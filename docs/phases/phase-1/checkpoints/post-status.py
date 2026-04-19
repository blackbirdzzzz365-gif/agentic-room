#!/usr/bin/env python3
"""
Post checkpoint status to the dashboard API.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
CONFIG_FILE = SCRIPT_DIR / "config.json"


def load_config() -> dict:
    config = {
        "dashboard_url": "http://localhost:3000",
        "project_slug": "agentic-room",
    }
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, encoding="utf-8") as f:
            config.update(json.load(f))
    if os.environ.get("DASHBOARD_URL"):
        config["dashboard_url"] = os.environ["DASHBOARD_URL"]
    if os.environ.get("PROJECT_SLUG"):
        config["project_slug"] = os.environ["PROJECT_SLUG"]
    return config


def build_payload(data: dict) -> dict:
    role = data.get("role", "implementer")
    if role == "validator":
        payload = {
            "role": "validator",
            "status": data.get("status", "PASS"),
            "summary": data.get("summary", ""),
            "readyForNextTrigger": data.get("ready_for_next_cp", False),
            "checks": data.get("checks", []),
            "issues": data.get("issues", []),
        }
        if data.get("next_cp"):
            payload["nextCp"] = data["next_cp"]
        return payload

    return {
        "role": "implementer",
        "status": data.get("status", "READY"),
        "summary": data.get("summary", ""),
        "readyForNextTrigger": False,
        "artifacts": data.get("artifacts", []),
        "issues": data.get("issues", []),
        "notes": data.get("notes", ""),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Post checkpoint status to dashboard")
    parser.add_argument("--result-file", required=True)
    parser.add_argument("--dashboard-url", default="")
    parser.add_argument("--project-slug", default="")
    args = parser.parse_args()

    config = load_config()
    dashboard_url = args.dashboard_url or config["dashboard_url"]
    project_slug = args.project_slug or config["project_slug"]

    result_path = Path(args.result_file)
    if not result_path.exists():
        print(f"✗ missing result file: {result_path}", file=sys.stderr)
        return 1

    data = json.loads(result_path.read_text(encoding="utf-8"))
    cp_code = data.get("cp", result_path.parent.name)
    payload = build_payload(data)

    url = f"{dashboard_url.rstrip('/')}/api/projects/{project_slug}/checkpoints/{cp_code}/status"

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            _ = resp.read()
        print(f"✓ dashboard updated for {cp_code}")
        return 0
    except urllib.error.URLError as exc:
        print(f"⚠ dashboard unreachable: {exc}")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
