# Tuesday 24 November 2026 — World News in One Image

[![make.fun](https://make.fun/badge/news-image-20261124.svg)](https://make.fun/bounty/news-image-20261124)
[![make.fun](https://make.fun/badge/news-image-20261124/GeMseN-Test/news-image-20261124.svg)](https://make.fun/bounty/news-image-20261124)
[![make.fun](https://make.fun/badge/news-image-20261124/GeMseN-Test/news-image-20261124/rank.svg)](https://make.fun/bounty/news-image-20261124)
[![make.fun](https://make.fun/badge/news-image-20261124/GeMseN-Test/news-image-20261124/reward.svg)](https://make.fun/bounty/news-image-20261124)

Entry for the make.fun bounty **"Sum up 24 November's world news in one image"**
(https://make.fun/bounty/news-image-20261124).

## The picture

One broadsheet front page for **Tuesday 24 November 2026**: **36 stories**
from 7 regions, all of which happened or were first reported on that day.

- **Masthead** — the date in a bold filled block font, so it reads at a glance.
- **Numbers strip** — 61,212 Bitcoin · $12.2bn Nvidia bears' hit · 11 killed in
  Dymer · 78 drones Iran claims down · 74% of US Latinos saw ICE action ·
  $30bn FAA boost urged.
- **The day so far** — a timeline with each time shown with its zone.
- **3 lead stories** — Huang is back and Nvidia bears pay $12.2bn; 11 killed in
  the Dymer strike; Bitcoin $61,212 as the big-number panel.
- **12 illustrated panels** — Estonia, Gulf of Oman, West Bank, Iran, Armenia,
  China, South Korea, Bangladesh, Denmark, Congo, Tajikistan, measles — each
  with its own drawn scene and a CONFIRMED / REPORTED label plus source.
- **Where it happened** — a world map with 15 numbered pins.
- **The rest of the day** — 21 more briefs, one line each, sourced.
- **Date check** — 10 stories deliberately left out because they are older
  news (Alcaraz's ATP Finals win was Sunday, the India–Nepal package was
  Monday, COP31 collapsed Monday), plus one "not yet": the Trump–Xi–Putin
  three-way talks in Shenzhen, due this week.

## How it is made

`main.ts` (Node 22+, standard library only, no network) draws the whole page
with a hand-rolled PNG writer and two hand-built fonts: a filled 5×7 block
font for the masthead and big numbers, and a single-stroke caps font for the
body copy. Every panel has a drawn scene — gradient skies, a chip, a burning
city, a tanker, flames, mountains, a pagoda, cobalt crystals, scales of
justice, a virus — so the page reads as pictures first, text second.

Deterministic: run it twice and the bytes are identical.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/entry.png — 1024×1024, about 311 KB
```

## Sources

Reuters, AP, AFP, Finnhub (Bitcoin snapshot 2026-11-24 00:04:23 UTC),
UKMTO, UN/WFP/WHO. Every claim on the page is attributed; the date of every
story was checked against its source before drawing.
