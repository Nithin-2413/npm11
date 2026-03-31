#!/usr/bin/env python3
"""
PART 5B: NPM CLI Tool — interact with Neural Precision Monitor from CI/CD pipelines.

Usage:
  python npm_cli.py run --blueprint login_flow_v1 --var USER=test@test.com --server http://localhost:8001
  python npm_cli.py status --execution exec_xxx --server http://localhost:8001
  python npm_cli.py run --blueprint smoke_tests --wait --timeout 120
  python npm_cli.py blueprints list
  python npm_cli.py schedules list

Exit codes:
  0 = SUCCESS
  1 = FAILURE
  2 = PARTIAL
  3 = TIMEOUT
  4 = API ERROR
"""
import argparse
import json
import sys
import time
import urllib.request
import urllib.error
from typing import Any, Dict, Optional

DEFAULT_SERVER = "http://localhost:8001"


def api_request(server: str, path: str, method: str = "GET", body: Optional[Dict] = None) -> Dict:
    url = f"{server}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode() if e else ""
        try:
            err_data = json.loads(body_text)
            msg = err_data.get("detail", body_text)
        except Exception:
            msg = body_text
        print(f"ERROR: HTTP {e.code} — {msg}", file=sys.stderr)
        sys.exit(4)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(4)


def cmd_run(args) -> int:
    """Run a blueprint and optionally wait for completion."""
    server = args.server

    # Parse --var KEY=VALUE pairs
    variables = {}
    for v in (args.var or []):
        if "=" in v:
            key, val = v.split("=", 1)
            variables[key.strip()] = val.strip()

    print(f"[NPM] Starting blueprint: {args.blueprint}")
    if variables:
        print(f"[NPM] Variables: {variables}")

    result = api_request(server, "/api/execute/blueprint", "POST", {
        "blueprint_id": args.blueprint,
        "variables": variables,
        "options": {"headless": True, "cli": True},
    })

    exec_id = result.get("execution_id")
    if not exec_id:
        print("ERROR: No execution_id returned", file=sys.stderr)
        return 4

    print(f"[NPM] Execution started: {exec_id}")
    print(f"[NPM] View report: {server}/reports/{exec_id}")

    if not args.wait:
        return 0

    # Wait for completion
    timeout = getattr(args, "timeout", 120)
    print(f"[NPM] Waiting for completion (timeout: {timeout}s)...")
    start = time.time()

    while True:
        elapsed = time.time() - start
        if elapsed > timeout:
            print(f"[NPM] TIMEOUT after {timeout}s", file=sys.stderr)
            return 3

        time.sleep(5)
        status_result = api_request(server, f"/api/execute/{exec_id}/status")
        status = status_result.get("status", "RUNNING")
        pct = status_result.get("progress", 0)

        print(f"[NPM] Status: {status} | Progress: {pct}% | Elapsed: {elapsed:.0f}s")

        if status == "SUCCESS":
            print(f"[NPM] ✓ SUCCESS in {elapsed:.1f}s")
            return 0
        elif status == "FAILURE":
            print(f"[NPM] ✗ FAILURE in {elapsed:.1f}s", file=sys.stderr)
            # Print AI analysis if available
            try:
                report = api_request(server, f"/api/reports/{exec_id}")
                ai = report.get("ai_analysis")
                if ai:
                    print(f"\n[NPM] AI Analysis:")
                    print(f"  Root cause: {ai.get('root_cause', '')}")
                    print(f"  Suggested fix: {ai.get('suggested_fix', '')}")
            except Exception:
                pass
            return 1
        elif status == "PARTIAL":
            print(f"[NPM] ⚠ PARTIAL completion in {elapsed:.1f}s")
            return 2
        elif status == "CANCELLED":
            print(f"[NPM] Execution cancelled")
            return 1


def cmd_status(args) -> int:
    """Check the status of an execution."""
    server = args.server
    result = api_request(server, f"/api/execute/{args.execution}/status")

    status = result.get("status", "UNKNOWN")
    print(f"Execution:  {args.execution}")
    print(f"Status:     {status}")
    print(f"Progress:   {result.get('progress', 0)}%")
    print(f"Actions:    {result.get('actions_completed', 0)}/{result.get('actions_total', 0)}")

    if status == "SUCCESS":
        return 0
    elif status == "PARTIAL":
        return 2
    elif status in ("FAILURE", "CANCELLED"):
        return 1
    return 0


def cmd_blueprints(args) -> int:
    """List or inspect blueprints."""
    server = args.server
    if args.subcommand == "list":
        result = api_request(server, "/api/blueprints")
        blueprints = result.get("blueprints", [])
        print(f"\n{'ID':<30} {'Name':<30} {'Tags':<20} {'Uses'}")
        print("-" * 90)
        for bp in blueprints:
            tags = ", ".join(bp.get("metadata", {}).get("tags", []))[:18]
            uses = bp.get("metadata", {}).get("usage_count", 0)
            print(f"{bp['blueprint_id']:<30} {bp['name'][:28]:<30} {tags:<20} {uses}")
        print(f"\nTotal: {result.get('total', len(blueprints))} blueprints")
    elif args.subcommand == "get":
        result = api_request(server, f"/api/blueprints/{args.id}")
        print(json.dumps(result, indent=2))
    return 0


def cmd_schedules(args) -> int:
    """List schedules."""
    server = args.server
    if args.subcommand == "list":
        result = api_request(server, "/api/schedules")
        schedules = result.get("schedules", [])
        print(f"\n{'ID':<30} {'Name':<25} {'Cron':<15} {'Active':<8} {'Last Run':<22} {'Status'}")
        print("-" * 115)
        for s in schedules:
            active = "Yes" if s.get("is_active") else "No"
            last_run = (s.get("last_run") or "Never")[:19]
            status = s.get("last_status") or "-"
            print(f"{s['schedule_id']:<30} {s['name'][:23]:<25} {s['cron_expression']:<15} {active:<8} {last_run:<22} {status}")
        print(f"\nTotal: {result.get('total', len(schedules))} schedules")
    return 0


def cmd_health(args) -> int:
    """Check server health."""
    server = getattr(args, "server", DEFAULT_SERVER) or DEFAULT_SERVER
    result = api_request(server, "/api/health")
    print(f"Server:    {args.server}")
    print(f"Status:    {result.get('status', 'unknown')}")
    print(f"Database:  {result.get('database', 'unknown')}")
    print(f"LLM Model: {result.get('llm_model', 'unknown')}")
    print(f"Groq:      {'configured' if result.get('groq_configured') else 'NOT CONFIGURED'}")
    return 0 if result.get("status") == "healthy" else 4


def main():
    parser = argparse.ArgumentParser(
        prog="npm_cli",
        description="NPM (Neural Precision Monitor) CLI — for CI/CD integration",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run a blueprint and wait for result
  python npm_cli.py run --blueprint login_test --wait --timeout 120

  # Run with variables
  python npm_cli.py run --blueprint checkout --var COUPON=SAVE10 --var EMAIL=test@test.com --wait

  # Check status of a running execution
  python npm_cli.py status --execution exec_abc123

  # List all blueprints
  python npm_cli.py blueprints list

  # List schedules
  python npm_cli.py schedules list

  # Check server health
  python npm_cli.py health

Exit codes: 0=SUCCESS  1=FAILURE  2=PARTIAL  3=TIMEOUT  4=API_ERROR
        """,
    )
    parser.add_argument("--server", default=DEFAULT_SERVER, help=f"NPM server URL (default: {DEFAULT_SERVER})")

    # Only add --server once (it's already in the main parser)
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # run command
    run_p = subparsers.add_parser("run", help="Run a blueprint")
    run_p.add_argument("--blueprint", required=True, help="Blueprint ID to run")
    run_p.add_argument("--var", action="append", metavar="KEY=VALUE", help="Variable (can be repeated)")
    run_p.add_argument("--wait", action="store_true", help="Wait for completion and exit with status code")
    run_p.add_argument("--timeout", type=int, default=120, help="Timeout in seconds when --wait is used (default: 120)")

    # status command
    status_p = subparsers.add_parser("status", help="Check execution status")
    status_p.add_argument("--execution", required=True, help="Execution ID")

    # blueprints command
    bp_p = subparsers.add_parser("blueprints", help="Manage blueprints")
    bp_sub = bp_p.add_subparsers(dest="subcommand")
    bp_sub.add_parser("list", help="List all blueprints")
    bp_get = bp_sub.add_parser("get", help="Get a blueprint by ID")
    bp_get.add_argument("id", help="Blueprint ID")

    # schedules command
    sched_p = subparsers.add_parser("schedules", help="Manage schedules")
    sched_sub = sched_p.add_subparsers(dest="subcommand")
    sched_sub.add_parser("list", help="List all schedules")

    # health command
    subparsers.add_parser("health", help="Check server health")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    command_map = {
        "run": cmd_run,
        "status": cmd_status,
        "blueprints": cmd_blueprints,
        "schedules": cmd_schedules,
        "health": cmd_health,
    }

    handler = command_map.get(args.command)
    if handler:
        return handler(args)
    else:
        parser.print_help()
        return 0


if __name__ == "__main__":
    sys.exit(main())
