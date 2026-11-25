# Bounty Radar

Live dashboard of AI agent coding bounties on [make.fun](https://make.fun/) — real prizes in USDC, real deadlines with live countdowns. Built for the **KaneCLI Online Hackathon** (TestMu AI, 12–26 Nov 2026).

## What it does

- **105 real bounties** in the snapshot (52 live, 3 judging, 50 done), scraped from live make.fun pages on 2026-11-25 ~00:59 UTC.
- **Summary header**: live prize pool ($2,659.03 at snapshot), live bounty count, next deadline.
- **Filters**: text search, minimum prize ($5/$20/$50/$100/$500+), status (live / all / judging / done).
- **Sort**: prize high→low or low→high, deadline soonest or latest first.
- **Live countdowns** ticking every second; a bounty that passes its deadline flips to “Ended”.
- **Click any card** for a detail modal (prize, entry fee, deadline, winner for done bounties, notes) with a link to the bounty on make.fun.

Featured bounties (verified from their own pages, not just the homepage list):
- **Build the best token launch radar** — $1,325, ends Dec 14, 2026 10:00 UTC
- **Bring the most entrants to the bounties you make on make.fun** — $1,000, ends Nov 26, 2026 16:22 UTC (sponsor-side: needs USDC to fund your own bounties)
- **Make GTA 6** — $1,666, **ended Nov 24** (shown as Done, won by @zor-vink)
- **Race a BTC trading bot live for 24 hours** — $50, **ended Nov 24** (shown as Done, won by @calm-raven-17-3308)

## Run it

Static files only — no build step, no backend, no login, no tracking.

```sh
cd kane-bounty-radar
python3 -m http.server 8123
# open http://localhost:8123/
```

Or open `index.html` directly in a browser (all paths are relative).

## Refresh the data

```sh
python3 scripts/fetch-makefun.py   # re-scrapes live make.fun, rewrites data.js
```

The homepage crawl body lists the 50 soonest-ending live bounties; the script also re-verifies the featured high-value bounties from their own pages. `data.js` records `generatedAt` and the source; the app displays both.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page structure + controls |
| `style.css` | Dark theme, responsive grid, mobile-friendly |
| `app.js` | Render, filter, search, sort, countdown ticker, detail modal. Pure helpers are exposed as `window.BountyRadar` for testing. |
| `data.js` | Bounty snapshot (generated, see above) |
| `scripts/fetch-makefun.py` | Data refresh script (stdlib only) |
| `scripts/bounty_data_snapshot.json` | Raw snapshot copy |

## Verification done

- `node --check` passes on `data.js` and `app.js`.
- Logic tests in Node: live count/pool, min-prize filter, text search, both sorts, countdown math (including the ended case), judging/done filters — all pass.
- Real-browser test in headless Chrome (Osaka): page renders, search “radar” → 1 result, min $100 → 4 results, sort by soonest deadline, status “all” → 105, card click opens the detail modal with the correct make.fun link, modal closes, countdown ticks every second. Screenshots verified visually.

## Kane CLI (for the hackathon submission)

The app is a static site, so Kane CLI can verify it end-to-end once deployed (or against a local server): flows in plain English, e.g. “open the page and confirm the token launch radar card shows $1,325”, “type ‘radar’ in search and confirm one result”, “set minimum prize to $100 and confirm 4 results”, “click the first card and confirm the detail dialog opens with a make.fun link”. Running Kane CLI needs a TestMu AI account (10,000 free credits) — that step is for the entrant, not in this repo.
