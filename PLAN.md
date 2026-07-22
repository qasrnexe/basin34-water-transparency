# Basin 34 Water Transparency — Plan

**Repo:** `qasrnexe/basin34-water-transparency`  
**Live:** https://water.bnm.farm (private — same family Caddy login as farm.bnm.farm)  
**Deploy:** `~/projects/tv-remote/homelab/scripts/deploy-water.sh` on the media box  

**Purpose:** Single source of truth. On the media-box agent say: “read PLAN.md and do the next build slice.”

---

## North star

A **public accountability / transparency tool** for Water District 34 (Big Lost River) that is:

1. **Fast enough to use** in a meeting (not a 26MB stutter-fest)
2. **Clear enough** that a neighbor can see: lower river goes dry; senior surface rights sit there; later development expanded upstream / off-corridor
3. **Exportable** — ranked tables + CSV, not only a map
4. **Careful** — evidence and methodology, no accusations; **do not feature private families as the default “example”** in Story captions/presets. Owner names from IDWR stay in the data, search, tables, and CSV.

> Think “receipts + rankings + map,” not “heavy GIS for its own sake.”

**Tone:** Neutral, sourced. Geometric / priority / gage proxies — not court findings.

---

## Current state (2026-07-22)

- [x] Live at water.bnm.farm (private family login); POD-first Explore default; calm stars; dry-reach CSV; Story; mobile sheet
- [x] F0 data refresh (ETL re-run; see manifest `asOf`)
- [ ] F1 “Water moved farther” / lined-canals story still half-told
- [ ] Explore sidebar still dense

---

## Build order (next)

```text
F0. Data refresh (re-run ETL, bump manifest)           ← DONE (this pass)
F1. “Water moved farther” lens (lined canals + transfers + new ground)
F2. Sidebar IA (insight-first, power tools nested)
F3. Optional: mapped waterbodies / aerial change cues
E.  Later: WD34 curtailment/accounting, live USGS
```

---

### F0 — Data freshness

**Do**

1. Re-run `scripts/etl/fetch_idwr_pods_wells.py` (pods, wells, pou)
2. Re-run `scripts/etl/fetch_nhd_canals.py` + `fetch_nhd_mainstem.py` + `fetch_nwi_riparian.py`
3. Commit updated GeoJSON + `manifest.json` with new `asOf`
4. Spot-check: dry-reach count, transfer count, canal/pipeline segment counts before/after

**Caveat:** NHD and IDWR lag real dirt work. Brand-new lined canals may show on satellite weeks/months before GIS. The app should say **“data as of …”** prominently and never imply live construction inventory.

**Done when:** manifest date is current; app data-as-of chip matches; no silent count regressions.

---

### F1 — Story: lined canals, water moved farther ← NEXT

**Local reality (product language):** The egregious diversions that created “east side of the river” / “west side of the river” designations are **lined canals** carrying water to **new ground** broken out in the last ~10–15 years — not “lined ponds.” Prefer that wording in Story, captions, and lens copy.

**What we already have (underused)**

| Signal | Layer / lens | Honesty |
|---|---|---|
| POD far from POU | Transfers analysis + purple connectors | Geometric proxy, not a filing |
| POU off corridor | “New ground” orange fills in transfers | Geometric vs NHD+NWI corridor |
| Canal / pipe geometry | `nhd-canals-pipelines` (canal/ditch + pipeline fcodes) | NHD inventory; incomplete & lagged; does not mark “lined” |
| Named diversions | Diversions layer | Aggregated from POD rates |

**What we barely have**

- Explicit “lined” attribute: not in NHD; satellite / local knowledge for Story captions
- Clean east/west-of-river designation polygons from IDWR (if they exist as public GIS — investigate after F0)
- “New this year” construction: not in these extracts

**Recommended product shape (one lens, not five new toggles)**

**Lens name:** **Water moved farther** (neutral)

1. **Map:** NHD canals emphasized for the east/west new-ground story; pipelines still available; transfers + new-ground POUs on; optional POD↔POU lines for transfer set only  
2. **Panel:** ranked table + CSV — distance POD→POU, corridor distance, owner, year, cfs — same accountability pattern as dry-reach  
3. **Story step:** one guided step after dry-reach / GW: “Lined canals and re-authorization moved water onto new ground east and west of the river — here is the public-geometry evidence”  
4. **Satellite:** keep as basemap; caption points at lined canal corridors visually; do **not** invent a liner inventory layer

**Possible later data (only if F0 + F1 still feel thin)**

- Admin / diversion-district polygons if IDWR publishes east/west designations  
- NHD waterbodies (reservoir/pond fcodes) as optional quiet layer — separate from lined-canal story  
- NAIP / recent imagery swipe (heavy; optional)  
- IDWR transfer / water-supply bank tables if a clean public extract exists  

**Tone:** “moved farther / off corridor / lined canal to new ground” — not “stolen.”

---

### F2 — Sidebar easier without losing insight

**Principle:** one primary path stays sacred — **tap ★ → purple diversion↔fields**. Everything else is a labeled lens.

**Proposed IA**

```text
Explore (default)
├── Always visible
│   ├── Hint: tap ★ for purple links
│   ├── Owner search
│   ├── Basemap
│   └── Layers: POD ★ / wells / channel / pipes (short list)
├── Insight lenses (one active) — big buttons / select
│   ├── Downstream seniors + CSV
│   ├── Water moved farther + CSV   ← new
│   ├── River shrink chart
│   ├── GW boom vs seniors
│   └── Development timeline
└── Advanced (collapsed)
    ├── Reach filter, year eras, rate threshold
    ├── Show all POU fills
    ├── Riparian / admin reaches / diversions
    └── Reset
```

Story mode stays the guided tour; Explore is the workshop. Do **not** delete analysis views — nest them.

**Mobile:** keep bottom sheet; Insight lenses in the peek; Advanced only when expanded.

---

### F3 — Optional waterbody / change cues (only after F0–F2)

- Optional NHD reservoir/pond polygons as a quiet layer (“Mapped waterbodies — NHD”) — separate from the lined-canal / east–west story  
- If useful: a “compare eras” note pointing at satellite + then/now channel, not a fake change-detection product  

---

### E — Later (highest evidence, hardest data)

- WD34 curtailment / accounting (“who shut off when”)
- Live USGS instantaneous values
- Fresher ETL on a calendar (quarterly?)

---

## Working loop

1. Talk to **media-box** water agent (stay in `basin34-water-transparency`; rebuild `dist/` only — see `tv-remote/homelab/AGENT_COORDINATION.md`)  
2. Agent builds, `git push` `qasrnexe/basin34-water-transparency`  
3. Rebuild water `dist/` for https://water.bnm.farm  

---

## Success criteria

In under five minutes **on a phone**, a visitor can:

1. Tap a ★ and see purple diversion↔field lines  
2. See the lower river dry in the modern record  
3. Open ranked **dry-reach seniors** CSV  
4. Open ranked **water moved farther** evidence (pipes + off-corridor POUs) without drowning in sidebar chrome  
5. Trust the **data-as-of** date  

### Phone / map notes

- POD-first Explore default; calm stars (no glow)  
- Selection purple lines work even when “all POU fills” are off  
- Heavy layers (NWI, full POU fills, canals) stay deferred until needed  
