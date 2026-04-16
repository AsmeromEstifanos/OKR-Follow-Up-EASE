from __future__ import annotations

import argparse
from dataclasses import asdict
import json

from .auth import MicrosoftAuthClient
from .config import Settings
from .server import run_server


def main() -> None:
    parser = argparse.ArgumentParser(description="Local SharePoint admin MCP server.")
    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("serve", help="Run the MCP server over stdio.")

    login_parser = subparsers.add_parser("login", help="Run device login and cache tokens.")
    login_parser.add_argument(
        "--resource",
        choices=["graph", "graph-admin", "sharepoint", "all"],
        required=True,
        help="Resource to authenticate.",
    )
    login_parser.add_argument(
        "--hostname",
        help="Required for SharePoint login. Example: easeint1.sharepoint.com",
    )

    start_login_parser = subparsers.add_parser(
        "start-login",
        help="Start device login and persist the flow for completion in a second step.",
    )
    start_login_parser.add_argument(
        "--resource",
        choices=["graph", "graph-admin", "sharepoint"],
        required=True,
        help="Resource to authenticate.",
    )
    start_login_parser.add_argument(
        "--hostname",
        help="Required for SharePoint login. Example: easeint1.sharepoint.com",
    )

    finish_login_parser = subparsers.add_parser(
        "finish-login",
        help="Complete a previously started device login flow.",
    )
    finish_login_parser.add_argument(
        "--resource",
        choices=["graph", "graph-admin", "sharepoint"],
        required=True,
        help="Resource to authenticate.",
    )
    finish_login_parser.add_argument(
        "--hostname",
        help="Required for SharePoint login. Example: easeint1.sharepoint.com",
    )

    subparsers.add_parser("status", help="Print configuration and token-cache status.")

    args = parser.parse_args()
    command = args.command or "serve"

    if command == "serve":
        run_server()
        return

    if command == "status":
        settings = Settings.load()
        payload = {"configuration": settings.auth_summary()}
        try:
            auth = MicrosoftAuthClient(settings)
            payload["auth_status"] = asdict(auth.status())
        except Exception as exc:  # pragma: no cover - setup diagnostics
            payload["auth_status"] = None
            payload["auth_error"] = str(exc)
        print(
            json.dumps(payload, indent=2)
        )
        return

    settings = Settings.load()
    auth = MicrosoftAuthClient(settings)

    if command == "login":
        if args.resource in {"graph", "all"}:
            print(json.dumps({"graph": auth.login("graph")}, indent=2))
        if args.resource in {"graph-admin", "all"}:
            print(json.dumps({"graph-admin": auth.login("graph-admin")}, indent=2))
        if args.resource in {"sharepoint", "all"}:
            print(
                json.dumps(
                    {
                        "sharepoint": auth.login(
                            "sharepoint",
                            hostname=args.hostname,
                        )
                    },
                    indent=2,
                )
            )
        return

    if command == "start-login":
        print(
            json.dumps(
                {
                    args.resource: auth.start_login(
                        args.resource,
                        hostname=args.hostname,
                    )
                },
                indent=2,
            )
        )
        return

    if command == "finish-login":
        print(
            json.dumps(
                {
                    args.resource: auth.finish_login(
                        args.resource,
                        hostname=args.hostname,
                    )
                },
                indent=2,
            )
        )
        return

    parser.error(f"Unsupported command: {command}")


if __name__ == "__main__":
    main()
