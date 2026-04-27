#!/usr/bin/env python3
"""
Bedlam daily status writer — generates a human-readable markdown summary.

Spawned by the InternalScheduler running inside the Bedlam server. Reads
state via the Bedlam API and writes a markdown digest to a configurable
output directory.

This is generic: it discovers companies, agents, and projects via the API.
You don't need to edit this file with your IDs — just configure the
environment variables below.

CONFIGURATION (environment variables):

  BEDLAM_API_BASE        Bedlam API endpoint
                         default: http://127.0.0.1:3100/api

  BEDLAM_STATUS_OUT_DIR  Where to write the markdown digest
                         default: /tmp/bedlam-status

  BEDLAM_COMPANY_ID      Specific company UUID to report on
                         default: report on all companies, one section each

USAGE:

  Standalone:    python3 daily-status.py
  From scheduler: spawned automatically every 30 minutes if
                 BEDLAM_DAILY_STATUS_SCRIPT points to this file

OUTPUT:

  $OUT_DIR/{date}-status.md      dated snapshot
  $OUT_DIR/CURRENT.md            stable filename (always latest)

This script does not require any non-stdlib dependencies. It reads the
Bedlam API over loopback and writes plain markdown. No LLM calls, no
heavy I/O — runs fast (typically <2s).
"""

import json
import os
import sys
import urllib.request
import urllib.error
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

API_BASE = os.environ.get("BEDLAM_API_BASE", "http://127.0.0.1:3100/api")
OUT_DIR = Path(os.environ.get("BEDLAM_STATUS_OUT_DIR", "/tmp/bedlam-status"))
COMPANY_ID_FILTER = os.environ.get("BEDLAM_COMPANY_ID")


def fetch(path: str) -> object:
    """Fetch JSON from the Bedlam API. Returns parsed object or raises."""
    url = f"{API_BASE}{path}"
    with urllib.request.urlopen(url, timeout=15) as r:
        return json.loads(r.read())


def parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def hours_ago(dt: datetime | None, now: datetime) -> float:
    return (now - dt).total_seconds() / 3600 if dt else 999.0


def short_id(uuid_str: str | None) -> str:
    return (uuid_str or "")[:8] or "?"


def render_company(company: dict, agents: list, projects: list,
                   issues_list: list, now: datetime) -> list[str]:
    """Render one company's status section as a list of markdown lines."""
    name_by_agent = {a["id"]: a.get("name", short_id(a["id"])) for a in agents}
    name_by_project = {p["id"]: p.get("name", short_id(p["id"])) for p in projects}

    def agent_name(aid: str | None) -> str:
        return name_by_agent.get(aid or "", short_id(aid))

    def project_name(pid: str | None) -> str:
        return name_by_project.get(pid or "", "no-project")

    # Bucket by status
    by_status: dict[str, list] = defaultdict(list)
    for i in issues_list:
        by_status[i.get("status", "?")].append(i)
    counts = {s: len(items) for s, items in by_status.items()}

    cutoff_24h = now - timedelta(hours=24)
    cutoff_7d = now - timedelta(days=7)

    shipped_24h = [
        i for i in by_status.get("done", [])
        if (parse_dt(i.get("completedAt") or i.get("updatedAt")) or now) > cutoff_24h
    ]
    shipped_24h.sort(key=lambda x: parse_dt(x.get("completedAt") or x.get("updatedAt")) or now,
                     reverse=True)
    shipped_7d = [
        i for i in by_status.get("done", [])
        if (parse_dt(i.get("completedAt") or i.get("updatedAt")) or now) > cutoff_7d
    ]

    active = list(by_status.get("in_progress", []))
    in_review = list(by_status.get("in_review", []))
    in_review.sort(key=lambda x: parse_dt(x.get("updatedAt") or "") or now, reverse=True)

    stuck_blocked = []
    for i in by_status.get("blocked", []):
        updated = parse_dt(i.get("updatedAt"))
        if updated and hours_ago(updated, now) >= 48:
            stuck_blocked.append((hours_ago(updated, now), i))
    stuck_blocked.sort(key=lambda x: -x[0])

    needs_human = [i for i in issues_list if i.get("needsHumanAt")]
    needs_human.sort(key=lambda x: parse_dt(x.get("needsHumanAt") or "") or now)

    stale_review = [
        i for i in in_review
        if (parse_dt(i.get("updatedAt")) and hours_ago(parse_dt(i.get("updatedAt")), now) >= 24)
    ]

    agents_working: Counter = Counter()
    for i in active:
        agents_working[i.get("assigneeAgentId")] += 1

    lines: list[str] = []
    lines.append(f"## {company.get('name', short_id(company['id']))}")
    lines.append("")
    lines.append(f"_Company ID: `{company['id']}`_")
    lines.append("")
    lines.append("### Top line")
    lines.append("")
    lines.append(f"- **Shipped last 24h:** {len(shipped_24h)} issues")
    lines.append(f"- **Shipped last 7d:** {len(shipped_7d)} issues")
    lines.append(
        f"- **Active right now:** {len(active)} issues in progress, "
        f"{sum(agents_working.values())} agents working"
    )
    lines.append(f"- **In review:** {len(in_review)} ({len(stale_review)} stale >24h)")
    lines.append(f"- **Blocked:** {counts.get('blocked', 0)} ({len(stuck_blocked)} stuck >48h)")
    lines.append(f"- **Needs human:** {len(needs_human)} issues")
    lines.append("")

    if needs_human:
        lines.append(f"### ⚠️ Needs human attention ({len(needs_human)})")
        lines.append("")
        for i in needs_human:
            ident = i.get("identifier", short_id(i["id"]))
            title = (i.get("title") or "")[:80]
            reason = i.get("needsHumanReason") or "_no reason set_"
            flagged = parse_dt(i.get("needsHumanAt"))
            age_h = hours_ago(flagged, now) if flagged else 0
            lines.append(f"- **{ident}** ({age_h:.0f}h) {title}")
            lines.append(f"  - reason: {reason}")
            lines.append(f"  - assignee: {agent_name(i.get('assigneeAgentId'))}")
        lines.append("")

    if active:
        lines.append(f"### Active right now ({len(active)})")
        lines.append("")
        for i in active:
            ident = i.get("identifier", short_id(i["id"]))
            title = (i.get("title") or "")[:90]
            agent = agent_name(i.get("assigneeAgentId"))
            started = parse_dt(i.get("startedAt"))
            age_h = hours_ago(started, now) if started else 0
            lines.append(f"- **{ident}** ({agent}, {age_h:.1f}h) {title}")
        lines.append("")

    if shipped_24h:
        lines.append(f"### Shipped last 24h ({len(shipped_24h)})")
        lines.append("")
        for i in shipped_24h[:30]:
            ident = i.get("identifier", short_id(i["id"]))
            title = (i.get("title") or "")[:90]
            agent = agent_name(i.get("assigneeAgentId"))
            lines.append(f"- **{ident}** ({agent}) {title}")
        if len(shipped_24h) > 30:
            lines.append(f"- _...and {len(shipped_24h) - 30} more_")
        lines.append("")

    if in_review:
        lines.append(f"### In review ({len(in_review)})")
        lines.append("")
        for i in in_review[:15]:
            ident = i.get("identifier", short_id(i["id"]))
            title = (i.get("title") or "")[:80]
            updated = parse_dt(i.get("updatedAt"))
            age_h = hours_ago(updated, now) if updated else 0
            stale_marker = " ⚠️ stale" if age_h > 24 else ""
            lines.append(f"- **{ident}** ({age_h:.0f}h{stale_marker}) {title}")
        if len(in_review) > 15:
            lines.append(f"- _...and {len(in_review) - 15} more_")
        lines.append("")

    if stuck_blocked:
        lines.append(f"### Stuck blocked >48h ({len(stuck_blocked)})")
        lines.append("")
        lines.append(
            "These are still listed as blocked but haven't moved in days. "
            "The stale_blocked_escalator should be flagging them with `needsHumanAt`. "
            "Anything here without that flag may be misclassified."
        )
        lines.append("")
        for age_h, i in stuck_blocked[:20]:
            ident = i.get("identifier", short_id(i["id"]))
            title = (i.get("title") or "")[:80]
            agent = agent_name(i.get("assigneeAgentId"))
            blocker_ids = i.get("blockedByIssueIds") or []
            reason = i.get("blockedReason") or ""
            blocker_str = (
                f" blocked-by={len(blocker_ids)} issues" if blocker_ids else ""
            )
            reason_str = f" — {reason[:60]}" if reason else ""
            lines.append(f"- **{ident}** ({agent}, {age_h / 24:.0f}d){blocker_str}{reason_str}")
            lines.append(f"  - {title}")
        if len(stuck_blocked) > 20:
            lines.append(f"- _...and {len(stuck_blocked) - 20} more_")
        lines.append("")

    lines.append("### Status breakdown")
    lines.append("")
    for s in [
        "in_progress", "in_review", "todo", "blocked",
        "backlog", "done", "cancelled",
    ]:
        if counts.get(s):
            lines.append(f"- {s}: {counts[s]}")
    lines.append("")

    proj_active: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for i in issues_list:
        if i.get("status") in ("in_progress", "in_review", "todo", "blocked"):
            proj_active[project_name(i.get("projectId"))][i.get("status")] += 1
    if proj_active:
        lines.append("### Active by project")
        lines.append("")
        lines.append("| Project | in_progress | in_review | todo | blocked |")
        lines.append("|---|---|---|---|---|")
        for p, statuses in sorted(proj_active.items(), key=lambda x: -sum(x[1].values())):
            ip = statuses.get("in_progress", 0)
            ir = statuses.get("in_review", 0)
            to = statuses.get("todo", 0)
            bl = statuses.get("blocked", 0)
            lines.append(f"| {p} | {ip} | {ir} | {to} | {bl} |")
        lines.append("")

    return lines


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")

    try:
        all_companies = fetch("/companies")
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
        sys.stderr.write(f"daily-status: cannot reach Bedlam API at {API_BASE}: {e}\n")
        return 1

    if not isinstance(all_companies, list):
        sys.stderr.write(f"daily-status: unexpected response from /companies: {all_companies!r}\n")
        return 1

    if COMPANY_ID_FILTER:
        all_companies = [c for c in all_companies if c.get("id") == COMPANY_ID_FILTER]

    if not all_companies:
        sys.stderr.write("daily-status: no companies to report on\n")
        return 0

    output_lines: list[str] = []
    output_lines.append(f"# Bedlam daily status — {today}")
    output_lines.append("")
    output_lines.append(
        f"_Generated {now.strftime('%Y-%m-%d %H:%M %Z')} from Bedlam API._"
    )
    output_lines.append("")
    output_lines.append(
        f"_{len(all_companies)} companies. Configure with "
        "`BEDLAM_COMPANY_ID` to limit to one._"
    )
    output_lines.append("")

    for company in all_companies:
        cid = company["id"]
        try:
            agents = fetch(f"/companies/{cid}/agents")
            projects = fetch(f"/companies/{cid}/projects")
            issues_list = fetch(f"/companies/{cid}/issues")
        except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
            output_lines.append(
                f"## {company.get('name', cid[:8])}\n\n"
                f"_Failed to fetch state: {e}_\n"
            )
            continue

        if not isinstance(agents, list):
            agents = []
        if not isinstance(projects, list):
            projects = []
        if not isinstance(issues_list, list):
            issues_list = []

        output_lines.extend(render_company(company, agents, projects, issues_list, now))
        output_lines.append("---")
        output_lines.append("")

    output_lines.append(
        "_This document is auto-generated by the Bedlam InternalScheduler. "
        "See `server/src/services/internal-scheduler.ts` and "
        "`scripts/daily-status.py`._"
    )

    output = "\n".join(output_lines)
    dated_path = OUT_DIR / f"{today}-status.md"
    current_path = OUT_DIR / "CURRENT.md"
    dated_path.write_text(output)
    current_path.write_text(output)

    print(f"Wrote {dated_path}")
    print(f"Wrote {current_path}")
    print(f"Length: {len(output)} chars, {len(output_lines)} lines")
    return 0


if __name__ == "__main__":
    sys.exit(main())
