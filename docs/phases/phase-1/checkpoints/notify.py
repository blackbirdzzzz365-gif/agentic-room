#!/usr/bin/env python3
"""
Checkpoint notification script.
Sends checkpoint status to ntfy.sh and optionally syncs status to the dashboard.
"""

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
CONFIG_FILE = SCRIPT_DIR / "config.json"


def load_config() -> dict:
    config = {
        "ntfy_topic": "",
        "ntfy_base": "https://ntfy.sh",
        "dashboard_url": "http://localhost:3000",
        "project_slug": "agentic-room",
    }
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, encoding="utf-8") as f:
            config.update(json.load(f))
    for env_key, config_key in [
        ("NTFY_TOPIC", "ntfy_topic"),
        ("NTFY_BASE", "ntfy_base"),
        ("DASHBOARD_URL", "dashboard_url"),
        ("PROJECT_SLUG", "project_slug"),
    ]:
        if os.environ.get(env_key):
            config[config_key] = os.environ[env_key]
    return config


STATUS_EMOJI = {
    "READY": "✅",
    "BLOCKED": "🚫",
    "PASS": "✅",
    "FAIL": "❌",
    "PARTIAL": "⚠️",
}


def send_ntfy(topic: str, base_url: str, title: str, message: str) -> bool:
    try:
        req = urllib.request.Request(
            f"{base_url.rstrip('/')}/{topic}",
            data=message.encode("utf-8"),
            headers={
                "Title": title.encode("utf-8"),
                "Content-Type": "text/plain; charset=utf-8",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except urllib.error.URLError as exc:
        print(f"⚠ ntfy unreachable: {exc}", file=sys.stderr)
        return False


def ensure_result_file(cp: str, role: str, status: str, summary: str, result_file: str) -> Path:
    path = Path(result_file)
    if path.exists():
        return path

    payload = {
        "cp": cp,
        "role": role,
        "status": status,
        "timestamp": datetime.now().isoformat(),
        "summary": summary,
        "artifacts": [],
        "issues": [],
    }
    if role == "validator":
        payload["checks"] = []
        payload["ready_for_next_cp"] = status == "PASS"

    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


def post_dashboard(result_file: str, config: dict) -> None:
    script_path = SCRIPT_DIR / "post-status.py"
    if not script_path.exists():
        return

    subprocess.run(
        [
            sys.executable,
            str(script_path),
            "--result-file",
            result_file,
            "--dashboard-url",
            config.get("dashboard_url", ""),
            "--project-slug",
            config.get("project_slug", ""),
        ],
        check=False,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Send checkpoint notifications")
    parser.add_argument("--cp", required=True)
    parser.add_argument("--role", required=True, choices=["implementer", "validator"])
    parser.add_argument("--status", required=True)
    parser.add_argument("--summary", required=True)
    parser.add_argument("--result-file", required=True)
    parser.add_argument("--skip-ntfy", action="store_true")
    args = parser.parse_args()

    config = load_config()
    result_path = ensure_result_file(args.cp, args.role, args.status, args.summary, args.result_file)

    if not args.skip_ntfy and config.get("ntfy_topic"):
        emoji = STATUS_EMOJI.get(args.status, "ℹ️")
        title = f"[agentic-room] {args.cp} | {args.role} | {args.status} {emoji}"
        body = "\n".join(
            [
                args.summary,
                "",
                f"CP: {args.cp}",
                f"Role: {args.role}",
                f"Status: {args.status}",
                f"Result file: {result_path}",
                f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            ]
        )
        send_ntfy(config["ntfy_topic"], config["ntfy_base"], title, body)

    post_dashboard(str(result_path), config)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
