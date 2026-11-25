#!/usr/bin/env python3
"""Regenerate ../data.js from the live make.fun site.

Fetches the make.fun homepage crawl body (server-rendered, no JS needed)
plus the featured high-value bounty pages, and writes window.BOUNTY_DATA
to ../data.js. Pure stdlib, no login, no keys.

Usage: python3 scripts/fetch-makefun.py
"""
import html
import json
import re
import urllib.request
from datetime import datetime, timezone

BASE = "https://make.fun"

# Bounties whose deadline is later than the homepage's first-50 window,
# verified from their own pages (kept here so they are never dropped).
FEATURED_LIVE = [
    {
        "title": "Build the best token launch radar",
        "url": BASE + "/bounty/token-radar-01",
        "reward": 1325,
        "entryFee": 0,
        "endsAt": "2026-12-14T10:00:00.000Z",
        "status": "live",
        "note": "Top prize $1,000 · 2nd–5th $50 · 6th–10th $25. AI judge, pairwise dashboard comparison.",
    },
    {
        "title": "Bring the most entrants to the bounties you make on make.fun",
        "url": BASE + "/bounty/bounty-entrants-03",
        "reward": 1000,
        "entryFee": 0,
        "endsAt": "2026-11-26T16:22:00.000Z",
        "status": "live",
        "note": "50 places paid (1st $150, 2nd $80, 3rd $50). Needs USDC to fund your own bounties — sponsor-side bounty.",
    },
]

DONE_NOTES = {
    "Make GTA 6": "100 places paid (1st $500, 2nd $250, 3rd $150).",
    "Race a BTC trading bot live for 24 hours": "Live 24h paper-trading race.",
}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "BountyRadar/1.0 (+https://make.fun)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


def parse_live(body):
    out = []
    for m in re.finditer(
        r'<li><h3><a href="([^"]+)">([^<]+)</a></h3><p>\$([0-9,]+(?:\.[0-9]{2})?) reward\.'
        r"(?: Entry fee \$([0-9.]+)\.)? Ends <time datetime=\"([^\"]+)\">",
        body,
    ):
        href, title, reward, fee, dt = m.groups()
        out.append({
            "title": html.unescape(title),
            "url": BASE + href,
            "reward": float(reward.replace(",", "")),
            "entryFee": float(fee) if fee else 0,
            "endsAt": dt,
            "status": "live",
        })
    return out


def parse_other(html_text, name, status):
    m = re.search(r"<section><h2>" + re.escape(name) + r"</h2>(.*?)</section>", html_text, flags=re.S)
    if not m:
        return []
    out = []
    for li in re.finditer(
        r'<li><h3><a href="([^"]+)">([^<]+)</a></h3><p>(.*?)</p></li>', m.group(1), flags=re.S
    ):
        href, title, p = li.groups()
        ptxt = re.sub(r"<[^>]+>", " ", p)
        rm = re.search(r"Bounty: \$([0-9,]+(?:\.[0-9]{2})?)", ptxt)
        tm = re.search(r'datetime="([^"]+)"', p)
        wm = re.search(r"Won by @([A-Za-z0-9_\-\.]+)", ptxt)
        item = {
            "title": html.unescape(title),
            "url": BASE + href,
            "reward": float(rm.group(1).replace(",", "")) if rm else 0,
            "entryFee": 0,
            "endsAt": tm.group(1) if tm else None,
            "status": status,
        }
        if wm:
            item["winner"] = wm.group(1)
        if title in DONE_NOTES:
            item["note"] = DONE_NOTES[title]
        out.append(item)
    return out


def main():
    home = fetch(BASE + "/")
    live_section = re.search(r"<section><h2>Live bounties</h2>(.*?)</section>", home, flags=re.S).group(1)
    live = parse_live(live_section)
    # Featured bounties live beyond the homepage's first-50 window.
    seen = {b["url"] for b in live}
    live += [b for b in FEATURED_LIVE if b["url"] not in seen]
    judging = parse_other(home, "Judging", "judging")
    done = parse_other(home, "Done", "done")

    payload = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "https://make.fun/ (homepage crawl body + verified bounty pages)",
        "sourceNote": "Live list shows the 50 soonest-ending live bounties plus featured high-value bounties verified from their own pages. Prizes in USDC.",
        "bounties": live + judging + done,
    }
    out_path = __file__.rsplit("/", 2)[0] + "/data.js"
    with open(out_path, "w") as f:
        f.write("// Bounty data — generated from live make.fun pages (see scripts/fetch-makefun.py to refresh).\n")
        f.write("// Prizes are in USDC. generatedAt is UTC.\n")
        f.write("window.BOUNTY_DATA = ")
        json.dump(payload, f, indent=2)
        f.write(";\n")
    print(f"live={len(live)} judging={len(judging)} done={len(done)} total={len(payload['bounties'])} -> {out_path}")


if __name__ == "__main__":
    main()
